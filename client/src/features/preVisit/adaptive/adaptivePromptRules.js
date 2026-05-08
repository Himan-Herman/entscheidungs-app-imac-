export const ALLOWED_SAFETY_FLAGS = new Set([
  "missing_information",
  "unclear_statement",
  "category_complete",
  "needs_patient_confirmation",
]);

export function sanitizeSafetyFlags(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x || "").trim())
    .filter((x) => ALLOWED_SAFETY_FLAGS.has(x))
    .slice(0, 4);
}

