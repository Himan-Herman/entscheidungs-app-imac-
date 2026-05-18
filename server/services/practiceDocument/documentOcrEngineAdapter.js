/**
 * OCR engine abstraction — organizational extraction only; no medical interpretation.
 */

import {
  isAiDocumentStructuringEnabled,
  isDocumentOcrEnabled,
  isLabStructuringEnabled,
} from "../../config/featureFlags.js";

const UNCLEAR_DE = "unklar";
const UNCLEAR_EN = "unclear";
const NOT_PROVIDED_DE = "nicht angegeben";
const NOT_PROVIDED_EN = "not provided";

/**
 * Parse simple lab-like lines: "Label: value unit (ref range)" or "Label\tvalue\tunit"
 * @param {string} text
 */
function parseLabLinesFromText(text) {
  const entries = [];
  const lines = text.split(/\r?\n/).slice(0, 200);
  let lineNo = 0;
  for (const raw of lines) {
    lineNo += 1;
    const line = raw.trim();
    if (!line || line.length < 3) continue;

    const colon = line.match(/^([^:]{2,80}):\s*([^\n]+)$/);
    if (colon) {
      const label = colon[1].trim();
      const rest = colon[2].trim();
      const refMatch = rest.match(/\(([^)]+)\)\s*$/);
      const referenceRangeText = refMatch ? refMatch[1].trim() : null;
      const valuePart = refMatch ? rest.replace(refMatch[0], "").trim() : rest;
      const parts = valuePart.split(/\s+/);
      let valueText = valuePart;
      let unit = null;
      if (parts.length >= 2 && /^[a-zA-Z%µ/°]+$/.test(parts[parts.length - 1])) {
        unit = parts[parts.length - 1];
        valueText = parts.slice(0, -1).join(" ");
      }
      if (!valueText) valueText = NOT_PROVIDED_DE;
      entries.push({
        label,
        valueText,
        unit,
        referenceRangeText,
        sourceLine: lineNo,
        confidence: 0.55,
      });
      continue;
    }

    const tab = line.split(/\t+/);
    if (tab.length >= 2) {
      entries.push({
        label: tab[0].trim(),
        valueText: tab[1].trim() || NOT_PROVIDED_DE,
        unit: tab[2]?.trim() || null,
        referenceRangeText: tab[3]?.trim() || null,
        sourceLine: lineNo,
        confidence: 0.5,
      });
    }
  }
  return entries.slice(0, 100);
}

/**
 * @param {string} engine
 */
export function getDocumentOcrEngine(engine = "local_stub") {
  const type = engine || "local_stub";

  return {
    type,
    async extract(ctx) {
      if (!isDocumentOcrEnabled() && !isLabStructuringEnabled() && !isAiDocumentStructuringEnabled()) {
        return { ok: false, error: "ocr_disabled" };
      }

      if (type === "ai_vision" && !isAiDocumentStructuringEnabled()) {
        return { ok: false, error: "ai_structuring_disabled" };
      }

      if (type === "external_ocr") {
        return { ok: false, error: "external_ocr_unavailable" };
      }

      const { buffer, mimeType, documentType, locale } = ctx;
      const lang = locale?.startsWith("en") ? "en" : "de";
      const unclear = lang === "en" ? UNCLEAR_EN : UNCLEAR_DE;
      const notProvided = lang === "en" ? NOT_PROVIDED_EN : NOT_PROVIDED_DE;

      let textSample = "";
      if (
        buffer &&
        (mimeType?.startsWith("text/") ||
          mimeType === "application/json" ||
          /^[\x09\x0a\x0d\x20-\x7e\u00a0-\ufffd]*$/.test(buffer.toString("utf8", 0, Math.min(buffer.length, 8000))))
      ) {
        textSample = buffer.toString("utf8", 0, Math.min(buffer.length, 500_000));
      }

      let entries = [];
      if (documentType === "lab" && isLabStructuringEnabled() && textSample) {
        entries = parseLabLinesFromText(textSample);
      }

      if (documentType === "lab" && isLabStructuringEnabled() && entries.length === 0) {
        entries = [
          {
            label: lang === "en" ? "Parameter (example)" : "Parameter (Beispiel)",
            valueText: unclear,
            unit: null,
            referenceRangeText: notProvided,
            sourceLine: 1,
            confidence: 0.2,
          },
        ];
      }

      const structured = {
        documentType,
        engine: type,
        organizationalOnly: true,
        noInterpretation: true,
        language: lang,
        entryCount: entries.length,
        autoDetectedDisclaimer: true,
      };

      return {
        ok: true,
        language: lang,
        confidence: entries.length ? 0.6 : 0.3,
        structuredJson: structured,
        entries,
        hasExtractedText: Boolean(textSample),
      };
    },
  };
}

export function resolveOcrEngine(requested) {
  if (requested === "ai_vision" && isAiDocumentStructuringEnabled()) return "ai_vision";
  if (requested === "external_ocr") return "external_ocr";
  return "local_stub";
}
