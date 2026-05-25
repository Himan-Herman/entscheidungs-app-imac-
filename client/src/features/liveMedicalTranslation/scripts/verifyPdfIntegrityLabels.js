/**
 * PDF transcript integrity label checks.
 * node client/src/features/liveMedicalTranslation/scripts/verifyPdfIntegrityLabels.js
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pdfSrc = readFileSync(
  join(__dirname, "../pdf/generateLiveTranslationPdf.js"),
  "utf8",
);

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(pdfSrc.includes("statusAcousticUncertain"), "acoustic uncertain label");
assert(pdfSrc.includes("Akustisch unsicher erkannt"), "DE acoustic label text");
assert(pdfSrc.includes("statusVerifiedOriginal"), "verified original label");
assert(pdfSrc.includes("Original bestätigt"), "DE verified label text");
assert(pdfSrc.includes("statusManuallyCorrected"), "manually corrected label");
assert(pdfSrc.includes("Manuell korrigiert"), "DE corrected label text");
assert(pdfSrc.includes("transcriptIntegrityLabel"), "integrity label helper");

console.log("verifyPdfIntegrityLabels: OK");
