/**
 * Wait until ICE candidate gathering completes so the SDP offer includes all candidates.
 * Required for reliable OpenAI Realtime WebRTC connections (especially off localhost).
 * @param {RTCPeerConnection} pc
 * @param {number} timeoutMs
 */
export function waitForIceGatheringComplete(pc, timeoutMs = 5000) {
  if (pc.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);

    const onStateChange = () => {
      if (pc.iceGatheringState === "complete") {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onStateChange);
    };

    pc.addEventListener("icegatheringstatechange", onStateChange);
  });
}

export const REALTIME_PEER_CONNECTION_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/**
 * Extract translated text from assorted Realtime server event shapes.
 * @param {Record<string, unknown>} event
 */
export function extractTranslatedText(event) {
  if (!event || typeof event !== "object") return "";

  const direct = event.transcript || event.text;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const item = event.item;
  if (item && typeof item === "object") {
    const content = item.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part && typeof part === "object") {
          const text = part.transcript || part.text;
          if (typeof text === "string" && text.trim()) return text.trim();
        }
      }
    }
  }

  return "";
}

/**
 * Extract input transcription from Realtime server events.
 * @param {Record<string, unknown>} event
 */
export function extractOriginalText(event) {
  if (!event || typeof event !== "object") return "";

  const direct = event.transcript ?? event.text ?? event.transcription;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (direct && typeof direct === "object") {
    const nested = direct.text ?? direct.transcript;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }

  const item = event.item;
  if (item && typeof item === "object") {
    const content = item.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (!part || typeof part !== "object") continue;
        const text =
          part.transcript ?? part.text ?? part.input_audio_transcription?.transcript;
        if (typeof text === "string" && text.trim()) return text.trim();
      }
    }
  }

  return "";
}

/**
 * Extract detected language code from Realtime transcription events (language-based routing).
 * @param {Record<string, unknown>} event
 */
export function extractDetectedLanguage(event) {
  if (!event || typeof event !== "object") return null;

  const candidates = [
    event.language,
    event.detected_language,
    event.transcription && typeof event.transcription === "object"
      ? event.transcription.language
      : null,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase();
    }
  }

  const item = event.item;
  if (item && typeof item === "object") {
    const itemLang = item.language;
    if (typeof itemLang === "string" && itemLang.trim()) {
      return itemLang.trim().toLowerCase();
    }
  }

  return null;
}
