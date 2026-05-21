/**
 * Client availability for Medical Interpreter B2B practice layer (Phase 4.2).
 * Mirrors server MEDICAL_INTERPRETER_B2B_ENABLED — build-time via Vite.
 */
function isTruthyEnvFlag(raw) {
  if (raw === true) return true;
  const s = String(raw ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

export function isMedicalInterpreterB2bClientEnabled() {
  return (
    isTruthyEnvFlag(import.meta.env.VITE_MEDICAL_INTERPRETER_B2B_ENABLED) ||
    isTruthyEnvFlag(import.meta.env.MEDICAL_INTERPRETER_B2B_ENABLED)
  );
}
