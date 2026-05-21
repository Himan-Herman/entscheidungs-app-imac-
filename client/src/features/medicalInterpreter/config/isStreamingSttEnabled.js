/**
 * Client build-time flag for streaming STT prototype (Phase 5.3).
 * Runtime availability also requires server streamingSttEnabled from /status.
 */
export function isStreamingSttClientEnabled() {
  const raw = import.meta.env.VITE_MEDICAL_INTERPRETER_STREAMING_STT_ENABLED;
  return raw === "true" || raw === "1";
}

export function isStreamingSttBrowserSupported() {
  if (typeof navigator === "undefined") return false;
  return (
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}
