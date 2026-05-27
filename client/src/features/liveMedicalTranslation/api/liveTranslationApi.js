import { authFetch } from "../../../api/authFetch.js";

/**
 * Legacy: mint ephemeral client secret only (no WebRTC).
 * Live connect uses exchangeLiveTranslationSdp → POST /realtime-call (single architecture).
 * @param {{ patientLanguage: string; doctorLanguage: string; activeSpeaker: "patient" | "doctor" }} body
 */
export async function createLiveTranslationRealtimeSession(body) {
  console.info("[MedaRealtimeConnect]", { event: "realtime_session_requested" });
  const res = await authFetch("/api/live-translation/realtime-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  console.info("[MedaRealtimeConnect]", {
    event: "realtime_session_received",
    ok: res.ok,
    status: res.status,
    hasClientSecret: typeof data?.clientSecret === "string" && data.clientSecret.length > 0,
    clientSecretLength:
      typeof data?.clientSecret === "string" ? data.clientSecret.length : 0,
    model: data?.model ?? null,
    expiresAt: data?.expiresAt ?? null,
    error: data?.error ?? null,
    openaiStatus: data?.openaiStatus ?? null,
    openaiErrorCode: data?.openaiErrorCode ?? null,
    openaiErrorMessage: data?.openaiErrorMessage ?? null,
  });
  return { res, data };
}

/**
 * Server-proxied WebRTC SDP answer (same-origin; no direct browser call to api.openai.com).
 * @param {string} offerSdp
 * @param {{ patientLanguage: string; doctorLanguage: string; activeSpeaker: "patient" | "doctor" }} params
 */
export async function exchangeLiveTranslationSdp(offerSdp, params) {
  console.info("[MedaRealtimeConnect]", {
    event: "realtime_call_requested",
    architecture: "sdp_realtime_call_only",
  });
  const q = new URLSearchParams({
    patientLanguage: params.patientLanguage,
    doctorLanguage: params.doctorLanguage,
    activeSpeaker: params.activeSpeaker,
  });
  const res = await authFetch(`/api/live-translation/realtime-call?${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: offerSdp,
  });
  if (res.ok) {
    const answerSdp = await res.text();
    console.info("[MedaRealtimeConnect]", {
      event: "sdp_answer_received",
      ok: true,
      status: res.status,
      answerBytes: answerSdp.length,
    });
    return { res, answerSdp, data: {} };
  }
  const data = await res.json().catch(() => ({}));
  console.info("[MedaRealtimeConnect]", {
    event: "sdp_answer_received",
    ok: false,
    status: res.status,
    phase: data?.phase ?? null,
    error: data?.error ?? null,
    connectionErrorKind: data?.connectionErrorKind ?? null,
    openaiStatus: data?.openaiStatus ?? null,
    openaiErrorMessage: data?.openaiErrorMessage ?? null,
  });
  return { res, answerSdp: "", data };
}
