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
