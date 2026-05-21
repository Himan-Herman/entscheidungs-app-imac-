/**
 * Client availability for Medical Interpreter B2B practice layer (Phase 4.2).
 * Mirrors server MEDICAL_INTERPRETER_B2B_ENABLED — build-time via Vite.
 */
export function isMedicalInterpreterB2bClientEnabled() {
  const raw = import.meta.env.VITE_MEDICAL_INTERPRETER_B2B_ENABLED;
  return raw === "true" || raw === "1";
}
