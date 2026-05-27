import { authFetch } from "../../../api/authFetch.js";

/**
 * @deprecated Not used for WebRTC connect. Live sessions use exchangeLiveTranslationSdp only.
 */
export async function createLiveTranslationRealtimeSession(_body) {
  console.warn(
    "[MedaRealtimeConnect] createLiveTranslationRealtimeSession is deprecated — use exchangeLiveTranslationSdp (POST /realtime-call) only.",
  );
  return {
    res: { ok: false, status: 410 },
    data: { error: "deprecated_use_realtime_call" },
  };
}

/**
 * Server-proxied WebRTC SDP answer (same-origin; no direct browser call to api.openai.com).
 * Sole Realtime connect path: POST /realtime-call.
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
