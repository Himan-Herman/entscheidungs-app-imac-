/**
 * Client availability for Medical Interpreter (Phase 1).
 * Mirrors server MEDICAL_INTERPRETER_ENABLED — build-time via Vite.
 *
 * Server availability is checked at runtime via GET /api/interpreter/status (see useInterpreterServerStatus).
 */
function isTruthyEnvFlag(raw) {
  if (raw === true) return true;
  const s = String(raw ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

export function isMedicalInterpreterClientEnabled() {
  return (
    isTruthyEnvFlag(import.meta.env.VITE_MEDICAL_INTERPRETER_ENABLED) ||
    isTruthyEnvFlag(import.meta.env.MEDICAL_INTERPRETER_ENABLED)
  );
}
