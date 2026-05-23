import { authFetch } from "../../../api/authFetch.js";

/**
 * Streaming / preview TTS — flag-gated, max 600 chars server-side.
 *
 * @param {{ text: string, language: string, voicePreference?: string, voiceSpeed?: string }} params
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function speakStreamText(params, options = {}) {
  try {
    const res = await authFetch("/api/interpreter/stream/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: params.text,
        language: params.language,
        voicePreference: params.voicePreference ?? "neutral_medical",
        voiceSpeed: params.voiceSpeed ?? "normal",
      }),
      signal: options.signal,
    });

    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 503 && data.error === "interpreter_streaming_tts_disabled") {
        return { ok: false, code: "feature_disabled" };
      }
      const code =
        data.error === "speech_failed" ? "speak_failed" : data.error || "speak_failed";
      return { ok: false, code, message: data.message };
    }

    if (!res.ok) {
      return { ok: false, code: "speak_failed" };
    }

    const blob = await res.blob();
    return { ok: true, blob, contentType: contentType || "audio/mpeg" };
  } catch (err) {
    if (err?.name === "AbortError") {
      return { ok: false, code: "cancelled" };
    }
    return { ok: false, code: "network" };
  }
}
