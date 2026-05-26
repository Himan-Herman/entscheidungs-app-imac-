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
 * @param {unknown} value
 * @returns {string}
 */
function pickText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/**
 * @param {Record<string, unknown> | null | undefined} part
 * @returns {string}
 */
function extractTextFromPart(part) {
  if (!part || typeof part !== "object") return "";

  const direct = [
    pickText(part.transcript),
    pickText(part.text),
    pickText(part.delta),
  ].find(Boolean);
  if (direct) return direct;

  const nestedTranscription =
    part.input_audio_transcription && typeof part.input_audio_transcription === "object"
      ? part.input_audio_transcription
      : null;

  return (
    pickText(nestedTranscription?.transcript) ||
    pickText(nestedTranscription?.text) ||
    (part.type === "input_audio" ? pickText(part.input_audio) : "")
  );
}

/**
 * @param {unknown} content
 * @returns {string}
 */
function extractTextFromContent(content) {
  if (!Array.isArray(content)) return "";
  for (const rawPart of content) {
    if (!rawPart || typeof rawPart !== "object") continue;
    const text = extractTextFromPart(/** @type {Record<string, unknown>} */ (rawPart));
    if (text) return text;
  }
  return "";
}

/**
 * @param {unknown} output
 * @returns {string}
 */
function extractTextFromResponseOutput(output) {
  if (!Array.isArray(output)) return "";
  for (const rawItem of output) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const item = /** @type {Record<string, unknown>} */ (rawItem);
    const direct = pickText(item.transcript) || pickText(item.text);
    if (direct) return direct;
    const fromContent = extractTextFromContent(item.content);
    if (fromContent) return fromContent;
  }
  return "";
}

/**
 * Extract translated text from assorted Realtime server event shapes.
 * @param {Record<string, unknown>} event
 */
export function extractTranslatedText(event) {
  if (!event || typeof event !== "object") return "";

  const direct =
    pickText(event.transcript) ||
    pickText(event.text) ||
    pickText(event.delta);
  if (direct) return direct;

  if (event.part && typeof event.part === "object") {
    const fromPart = extractTextFromPart(/** @type {Record<string, unknown>} */ (event.part));
    if (fromPart) return fromPart;
  }

  const item = event.item;
  if (item && typeof item === "object") {
    const itemText =
      pickText(item.transcript) ||
      pickText(item.text) ||
      extractTextFromContent(item.content);
    if (itemText) return itemText;
  }

  if (event.response && typeof event.response === "object") {
    const response = /** @type {Record<string, unknown>} */ (event.response);
    const responseText =
      pickText(response.transcript) ||
      pickText(response.text) ||
      extractTextFromResponseOutput(response.output);
    if (responseText) return responseText;
  }

  return "";
}

/**
 * Extract input transcription from Realtime server events.
 * @param {Record<string, unknown>} event
 */
export function extractOriginalText(event) {
  if (!event || typeof event !== "object") return "";

  const direct =
    pickText(event.transcript) ||
    pickText(event.text) ||
    pickText(event.delta);
  if (direct) return direct;

  const transcription =
    event.transcription && typeof event.transcription === "object"
      ? /** @type {Record<string, unknown>} */ (event.transcription)
      : null;
  if (transcription) {
    const nested = pickText(transcription.text) || pickText(transcription.transcript);
    if (nested) return nested;
  }

  if (event.part && typeof event.part === "object") {
    const fromPart = extractTextFromPart(/** @type {Record<string, unknown>} */ (event.part));
    if (fromPart) return fromPart;
  }

  const item = event.item;
  if (item && typeof item === "object") {
    const itemTranscript =
      pickText(item.transcript) ||
      pickText(item.text) ||
      extractTextFromContent(item.content);
    if (itemTranscript) return itemTranscript;
  }

  if (event.response && typeof event.response === "object") {
    const response = /** @type {Record<string, unknown>} */ (event.response);
    const responseText = extractTextFromResponseOutput(response.output);
    if (responseText) return responseText;
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
