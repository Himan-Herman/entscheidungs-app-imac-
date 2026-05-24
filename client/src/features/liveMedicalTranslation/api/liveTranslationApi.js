import { authFetch } from "../../../api/authFetch.js";
import { API_BASE } from "../../../lib/api.js";

/**
 * Mint ephemeral OpenAI Realtime client secret for WebRTC.
 * @param {{ patientLanguage: string; doctorLanguage: string; activeSpeaker: "patient" | "doctor" }} body
 */
export async function createLiveTranslationRealtimeSession(body) {
  const res = await authFetch(`${API_BASE}/api/live-translation/realtime-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
