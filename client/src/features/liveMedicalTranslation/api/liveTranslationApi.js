import { authFetch } from "../../../api/authFetch.js";

/**
 * Mint ephemeral OpenAI Realtime client secret for WebRTC.
 * Same-origin /api/* (Vercel rewrite) — do not call api.medscout.app directly (CORS).
 * @param {{ patientLanguage: string; doctorLanguage: string; activeSpeaker: "patient" | "doctor" }} body
 */
export async function createLiveTranslationRealtimeSession(body) {
  const res = await authFetch("/api/live-translation/realtime-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Server-proxied WebRTC SDP answer (same-origin; no direct browser call to api.openai.com).
 * @param {string} offerSdp
 * @param {{ patientLanguage: string; doctorLanguage: string; activeSpeaker: "patient" | "doctor" }} params
 */
export async function exchangeLiveTranslationSdp(offerSdp, params) {
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
    return { res, answerSdp, data: {} };
  }
  const data = await res.json().catch(() => ({}));
  return { res, answerSdp: "", data };
}
