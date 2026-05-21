/**
 * Client availability for Medical Interpreter (Phase 1).
 * Mirrors server MEDICAL_INTERPRETER_ENABLED — build-time via Vite.
 *
 * Server availability is checked at runtime via GET /api/interpreter/status (see useInterpreterServerStatus).
 */
export function isMedicalInterpreterClientEnabled() {
  const raw = import.meta.env.VITE_MEDICAL_INTERPRETER_ENABLED;
  return raw === "true" || raw === "1";
}
