/**
 * PDF header/branding checks (run with node).
 * node client/src/features/liveMedicalTranslation/scripts/verifyLiveTranslationPdfHeader.js
 */
import { buildLiveTranslationPdfDocument } from "../pdf/generateLiveTranslationPdf.js";
import {
  computePdfLogoSizeMm,
  getMedScoutxPdfLogoCandidateUrls,
  MEDSCOUT_PDF_LOGO_FILENAME,
} from "../pdf/medScoutxPdfBranding.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const SAFETY_CORE_DE =
  "Dieses Dokument dient der Kommunikation und Übersetzung. Es ist keine Diagnose, keine Triage und keine Behandlungsempfehlung.";

const mockExport = {
  productName: "MedScoutX",
  sessionStartedAt: "2026-05-24T10:00:00.000Z",
  sessionEndedAt: "2026-05-24T10:30:00.000Z",
  patientName: "Test Patient",
  birthDate: "1990-01-15",
  patientLanguage: "fa",
  doctorLanguage: "de",
  autoSwitchSpeaker: true,
  practice: {},
  transcript: Array.from({ length: 18 }, (_, i) => ({
    id: `turn-${i}`,
    speaker: i % 2 === 0 ? "patient" : "doctor",
    sourceLanguage: i % 2 === 0 ? "fa" : "de",
    targetLanguage: i % 2 === 0 ? "de" : "fa",
    originalText: `Original statement ${i + 1}.`,
    translatedText: `Übersetzung ${i + 1}.`,
    timestamp: new Date(Date.parse("2026-05-24T10:00:00.000Z") + i * 60000).toISOString(),
    status: "translated",
  })),
};

const built = buildLiveTranslationPdfDocument(mockExport, "de", { logo: null });
assert(built, "pdf builds");
assert(built.usedLogoFallback, "uses wordmark fallback without logo asset");
assert(built.brandSource === "wordmark", "brand source is wordmark");

const pageCount = built.doc.internal.getNumberOfPages();
assert(pageCount >= 2, "multi-page transcript produces multiple pages");

const pdfString = built.doc.output("arraybuffer");
assert(pdfString.byteLength > 5000, "pdf has substantial content");

assert(
  getMedScoutxPdfLogoCandidateUrls().some((url) => String(url).includes(MEDSCOUT_PDF_LOGO_FILENAME)),
  "medscout-logo6 configured as primary logo",
);

const logoSize = computePdfLogoSizeMm({ naturalWidth: 1024, naturalHeight: 1024 });
assert(logoSize.widthMm === logoSize.heightMm, "square logo preserves aspect ratio");
assert(logoSize.heightMm <= 18, "logo height capped for header");

const builtEn = buildLiveTranslationPdfDocument(mockExport, "en", { logo: null });
assert(builtEn?.doc, "english pdf builds");

console.log("verifyLiveTranslationPdfHeader: OK");
console.log(`  pages: ${pageCount}`);
console.log(`  brand: ${built.brandSource} (logo asset: ${MEDSCOUT_PDF_LOGO_FILENAME})`);
console.log(`  safety core (DE): ${SAFETY_CORE_DE.slice(0, 48)}…`);
