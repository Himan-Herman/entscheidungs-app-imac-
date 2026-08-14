/**
 * Test fixtures for document translation extraction.
 *
 * Everything is generated in memory from libraries already in the dependency
 * tree — pdf-lib for PDFs, jszip (via mammoth) for DOCX. No binary blobs are
 * committed, so a fixture can never contain real patient data by accident.
 */

import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";

/**
 * A PDF with a real text layer.
 * @param {string[][]} pages one array of lines per page
 * @returns {Promise<Buffer>}
 */
export async function textPdf(pages) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const lines of pages) {
    const page = doc.addPage([595, 842]);
    let y = 790;
    for (const line of lines) {
      page.drawText(line, { x: 50, y, size: 11, font });
      y -= 18;
    }
  }

  return Buffer.from(await doc.save());
}

/**
 * A PDF with pages but no text at all — the shape a scan without OCR takes.
 * @param {number} pageCount
 * @returns {Promise<Buffer>}
 */
export async function scannedPdf(pageCount = 3) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) doc.addPage([595, 842]);
  return Buffer.from(await doc.save());
}

/** Not a PDF at all. */
export function corruptPdf() {
  return Buffer.from("%PDF-1.4\nthis file is truncated and structurally invalid");
}

/**
 * A password-protected PDF.
 *
 * Built by hand: pdf-lib cannot write encrypted files. The /O and /U entries
 * are deliberately not derived from a real password, which is enough — pdf.js
 * runs the empty-password check, it fails, and PasswordException is raised.
 * That is exactly the "this document needs a password" signal under test.
 *
 * @returns {Buffer}
 */
export function encryptedPdf() {
  const pad = "x".repeat(32);
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>\nendobj\n",
    `4 0 obj\n<< /Filter /Standard /V 1 /R 2 /Length 40 /P -1 /O (${pad}) /U (${pad}) >>\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;

  const id = "<11223344556677889900aabbccddeeff>";
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 4 0 R ` +
    `/ID [${id} ${id}] >>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

/* ------------------------------------------------------------------ DOCX */

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdN" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`;

/** Escapes text for inclusion in WordprocessingML. */
function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** A paragraph, optionally carrying a style id. */
export function para(text, styleId) {
  const pPr = styleId ? `<w:pPr><w:pStyle w:val="${styleId}"/></w:pPr>` : "";
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

/** A numbered/bulleted list item. */
export function listItem(text) {
  return `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

/** A table cell, optionally spanning several grid columns. */
export function cell(text, gridSpan) {
  const tcPr = gridSpan ? `<w:tcPr><w:gridSpan w:val="${gridSpan}"/></w:tcPr>` : "";
  return `<w:tc>${tcPr}${para(text)}</w:tc>`;
}

/** @param {string[]} rows each already built from cell() */
export function table(rows) {
  return `<w:tbl>${rows.map((r) => `<w:tr>${r}</w:tr>`).join("")}</w:tbl>`;
}

/**
 * Assemble a .docx from WordprocessingML body fragments.
 * @param {string} bodyXml
 * @returns {Promise<Buffer>}
 */
export async function docx(bodyXml) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.folder("_rels").file(".rels", ROOT_RELS);

  const word = zip.folder("word");
  word.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`,
  );
  word.file("_rels/document.xml.rels", DOC_RELS);
  word.file("numbering.xml", NUMBERING);
  word.file("styles.xml", STYLES);

  return zip.generateAsync({ type: "nodebuffer" });
}

/** A .doc (legacy binary) — supported by nothing here, on purpose. */
export function legacyDoc() {
  // OLE2 compound file magic, enough to be recognisably not a zip.
  return Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
}

/** A minimal PNG. */
export function pngImage() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ]);
}
