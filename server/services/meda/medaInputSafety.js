import { MEDA_MAX_INPUT_CHARS } from "../../config/medaEnv.js";

const BLOCKED_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+prompt/i,
  /jailbreak/i,
  /du\s+bist\s+jetzt/i,
  /act\s+as\s+(a\s+)?doctor/i,
  /diagnose\s+(me|mich)/i,
  /what\s+do\s+i\s+have/i,
  /welche\s+krankheit\s+habe\s+ich/i,
  /\b(cocaine|heroin|meth)\b/i,
  /how\s+to\s+(make|synthesize)\s+(drugs|bombs)/i,
];

const DIAGNOSIS_ATTEMPT = [
  /habe\s+ich\s+(eine|ein)?\s*/i,
  /habe\s+ich\s+\w+/i,
  /do\s+i\s+have\s+/i,
  /ist\s+das\s+(gefährlich|krebs|tumor)/i,
  /should\s+i\s+take\s+\w+/i,
  /welches\s+medikament/i,
  /what\s+is\s+wrong\s+with\s+me/i,
  /was\s+habe\s+ich/i,
];

/**
 * @param {string} text
 */
export function validateMedaInput(text) {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, code: "validation_empty" };
  if (raw.length > MEDA_MAX_INPUT_CHARS) {
    return { ok: false, code: "validation_too_long" };
  }

  for (const re of BLOCKED_PATTERNS) {
    if (re.test(raw)) return { ok: false, code: "validation_blocked" };
  }

  const diagnosisAttempt = DIAGNOSIS_ATTEMPT.some((re) => re.test(raw));
  return { ok: true, text: raw, diagnosisAttempt };
}
