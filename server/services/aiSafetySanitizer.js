/**
 * Runtime AI output sanitization — no PHI in logs.
 */
import {
  getOutputSafetyPatterns,
  getSafeFallback,
  normalizeUiLocale,
  PHRASE_REPLACEMENTS,
  AI_MODULES,
  STRUCTURED_FIELD_PLACEHOLDER,
} from "../config/aiSafetyPolicy.js";

function testPattern(re, text) {
  const s = String(text || "");
  re.lastIndex = 0;
  return re.test(s);
}

/**
 * @param {string} text
 * @param {string} [module='generic']
 */
export function detectForbiddenMedicalClaims(text, module = AI_MODULES.GENERIC) {
  const patterns = getOutputSafetyPatterns(module);
  const matchCodes = [];
  for (let i = 0; i < patterns.length; i++) {
    if (testPattern(patterns[i], text)) matchCodes.push(`p${i}`);
  }
  return { unsafe: matchCodes.length > 0, matchCodes };
}

/** @param {string} text */
export function replaceUnsafePhrases(text) {
  let s = String(text ?? "");
  for (const { re, replacement } of PHRASE_REPLACEMENTS) {
    s = s.replace(re, replacement);
  }
  return s.trim();
}

/**
 * After phrase replacement, still triggers concept regex → caller may regenerate or fallback.
 * @param {string} text
 * @param {string} [module]
 */
export function shouldRegenerateUnsafeOutput(text, module = AI_MODULES.GENERIC) {
  const step = replaceUnsafePhrases(text);
  return detectForbiddenMedicalClaims(step, module).unsafe;
}

/**
 * @param {{ unsafe_output_detected: boolean, sanitized: boolean, module: string, used_fallback?: boolean }} meta
 */
export function logAiSafetyEvent(meta) {
  console.info(
    JSON.stringify({
      event: "ai_output_safety",
      unsafe_output_detected: Boolean(meta.unsafe_output_detected),
      sanitized: Boolean(meta.sanitized),
      module: String(meta.module || "unknown"),
      used_fallback: Boolean(meta.used_fallback),
    }),
  );
}

/**
 * Full sanitization: phrase replace → detect → optional fallback.
 * @param {string} rawText
 * @param {{ module?: string, locale?: string }} [options]
 */
export function sanitizeAiOutput(rawText, options = {}) {
  const module = options.module || AI_MODULES.GENERIC;
  const locale = normalizeUiLocale(options.locale);
  const orig = String(rawText ?? "");
  const origUnsafe = detectForbiddenMedicalClaims(orig, module).unsafe;

  let text = replaceUnsafePhrases(orig);
  let det = detectForbiddenMedicalClaims(text, module);

  if (!det.unsafe) {
    const sanitized = text.trim() !== orig.trim() || origUnsafe;
    if (origUnsafe || text.trim() !== orig.trim()) {
      logAiSafetyEvent({
        module,
        unsafe_output_detected: origUnsafe,
        sanitized: true,
        used_fallback: false,
      });
    }
    return {
      text,
      unsafe_output_detected: origUnsafe,
      sanitized: sanitized && (origUnsafe || text !== orig),
      used_fallback: false,
    };
  }

  const fb = getSafeFallback(module, locale);
  logAiSafetyEvent({
    module,
    unsafe_output_detected: true,
    sanitized: true,
    used_fallback: true,
  });
  return {
    text: fb,
    unsafe_output_detected: true,
    sanitized: true,
    used_fallback: true,
  };
}

/**
 * Strip sentences that match any pattern (keeps surrounding safe text).
 * @param {string} text
 * @param {RegExp[]} patterns
 */
export function stripSentencesMatchingPatterns(text, patterns) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const parts = raw.split(/(?<=[.!?])\s+/);
  const kept = [];
  for (const p of parts) {
    let bad = false;
    for (const re of patterns) {
      if (testPattern(re, p)) {
        bad = true;
        break;
      }
    }
    if (!bad) kept.push(p);
  }
  return kept.join(" ").trim();
}

/**
 * Lenient field sanitization for structured JSON outputs (doctor transform, bullets).
 * @param {string} rawText
 * @param {{ module?: string, locale?: string }} [options]
 */
export function sanitizeStructuredPlainText(rawText, options = {}) {
  const module = options.module || AI_MODULES.PREVISIT_DOCTOR_TRANSFORM;
  const loc = normalizeUiLocale(options.locale);
  const patterns = getOutputSafetyPatterns(module);
  let t = replaceUnsafePhrases(rawText);
  t = stripSentencesMatchingPatterns(t, patterns);
  t = replaceUnsafePhrases(t);

  if (!detectForbiddenMedicalClaims(t, module).unsafe) {
    const changed = t !== String(rawText || "").trim();
    if (changed) {
      logAiSafetyEvent({
        module,
        unsafe_output_detected: true,
        sanitized: true,
        used_fallback: false,
      });
    }
    return t;
  }

  logAiSafetyEvent({
    module,
    unsafe_output_detected: true,
    sanitized: true,
    used_fallback: false,
  });
  return STRUCTURED_FIELD_PLACEHOLDER[loc] || STRUCTURED_FIELD_PLACEHOLDER.en;
}
