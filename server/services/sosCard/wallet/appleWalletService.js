/**
 * Apple Wallet service — Phase 4B.
 *
 * Produces a real signed `.pkpass` when ALL Apple credentials are present AND the
 * `passkit-generator` library is installed. Without credentials → safe `not_configured`.
 * Without the library (not yet installed) → safe `not_implemented`. Never crashes the app:
 * the library is loaded via dynamic import only when a pass is actually built.
 *
 * Certificates/keys come from env at runtime and stay strictly server-side (in memory; the
 * library signs in-memory, nothing is written to disk). Nothing here is logged.
 *
 * LIBRARY: `passkit-generator` (the established .pkpass library). It is NOT installed yet —
 * install it server-side with:  cd server && npm install passkit-generator
 *
 * PRIVACY: the pass carries NO medical data — only title, neutral holder name/initials, a QR
 * with the emergency URL, and a self-reported notice. Blood type is intentionally NOT included.
 */
import zlib from "zlib";
import { appleWalletConfig } from "./walletConfig.js";

const SELF_REPORTED_NOTE =
  "Self-reported by the user. Not medically validated by MedScoutX.";

export function isAppleWalletConfigured() {
  return appleWalletConfig().configured;
}

/** Apple serialNumber / file-safe id part. */
function normalizeIdPart(value) {
  return String(value || "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 60) || "anon";
}

/* ---- Minimal solid-color PNG icon generated at runtime (no binary asset in the repo) ---- */
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function solidPng(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const p = rowStart + 1 + x * 3;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}
const ICON_PNG = solidPng(29, 185, 28, 28);
const ICON_2X_PNG = solidPng(58, 185, 28, 28);

/**
 * Pure builder for the pass.json properties + fields. Health-data-free by construction.
 * Exported for testing (no certificates / library required).
 * @param {object} payload  Minimal payload from sosWalletMapper.
 */
export function buildApplePassFields(payload) {
  return {
    props: {
      passTypeIdentifier: (process.env.APPLE_WALLET_PASS_TYPE_ID || "").trim(),
      teamIdentifier: (process.env.APPLE_WALLET_TEAM_ID || "").trim(),
      organizationName: (process.env.APPLE_WALLET_ORGANIZATION_NAME || "MedScoutX").trim(),
      description: "MedScoutX SOS",
      serialNumber: `sos-${normalizeIdPart(payload?.subjectId)}`,
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(185, 28, 28)",
      labelColor: "rgb(255, 255, 255)",
    },
    headerFields: [{ key: "title", label: "", value: "MedScoutX SOS" }],
    primaryFields: [{ key: "holder", label: "SOS", value: payload?.holder || "MedScoutX SOS" }],
    backFields: [{ key: "note", label: "Notice", value: SELF_REPORTED_NOTE }],
    // The barcode carries ONLY the emergency URL — never health data.
    barcode: {
      format: "PKBarcodeFormatQR",
      message: payload?.emergencyUrl || "",
      messageEncoding: "iso-8859-1",
    },
  };
}

/**
 * @param {object} payload  Minimal payload from sosWalletMapper (no health data surfaced).
 * @returns {Promise<Buffer>}  signed .pkpass bytes (Content-Type application/vnd.apple.pkpass)
 */
export async function buildApplePass(payload) {
  if (!isAppleWalletConfigured()) {
    const err = new Error("apple_wallet_not_configured");
    err.code = "not_configured";
    throw err;
  }

  let PKPass;
  try {
    ({ PKPass } = await import("passkit-generator"));
  } catch {
    // Library not installed yet — stay safe rather than emit a broken pass.
    const err = new Error("apple_pass_library_not_installed");
    err.code = "not_implemented";
    throw err;
  }

  const { props, headerFields, primaryFields, backFields, barcode } = buildApplePassFields(payload);

  const pass = new PKPass(
    { "icon.png": ICON_PNG, "icon@2x.png": ICON_2X_PNG },
    {
      wwdr: process.env.APPLE_WALLET_WWDR_PEM,
      signerCert: process.env.APPLE_WALLET_CERT_PEM,
      signerKey: process.env.APPLE_WALLET_CERT_KEY_PEM,
      signerKeyPassphrase: process.env.APPLE_WALLET_CERT_KEY_PASSPHRASE || undefined,
    },
    props,
  );

  pass.type = "generic";
  pass.headerFields.push(...headerFields);
  pass.primaryFields.push(...primaryFields);
  pass.backFields.push(...backFields);
  pass.setBarcodes(barcode);

  return pass.getAsBuffer();
}
