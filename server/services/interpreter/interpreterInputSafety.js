import {
  INTERPRETER_MAX_TURN_CHARS,
  INTERPRETER_MAX_TRANSCRIPT_CHARS,
  INTERPRETER_MIN_AUDIO_BYTES,
  INTERPRETER_SUPPORTED_LANGUAGE_CODES,
} from "../../config/interpreterEnv.js";
import { NEAR_REALTIME_MAX_CHUNK_CHARS } from "../../config/interpreterNearRealtimeEnv.js";
import { STREAM_TTS_MAX_CHARS } from "../../config/interpreterStreamTtsEnv.js";

/** Strip HTML, control chars, bidi overrides, and zero-width characters. */
const HTML_TAG = /<[^>]+>/g;
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const BIDI_OVERRIDE = /[\u202A-\u202E\u2066-\u2069\u200B-\u200F\uFEFF]/g;
const ZERO_WIDTH_JOINER = /[\u200C\u200D]/g;

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior)\s+instructions/i,
  /forget\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+prompt/i,
  /developer\s+message/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /du\s+bist\s+jetzt/i,
  /ignoriere\s+(alle\s+)?(vorherigen|bisherigen)\s+anweisungen/i,
  /act\s+as\s+(a\s+)?(doctor|physician|clinician)/i,
  /you\s+are\s+now\s+(a\s+)?(doctor|physician)/i,
  /pretend\s+(you\s+are|to\s+be)\s+(a\s+)?doctor/i,
  /what\s+(is|are)\s+your\s+(system\s+)?prompt/i,
  /reveal\s+(the\s+)?(system|hidden)\s+prompt/i,
  /translate\s+the\s+following\s+instructions/i,
  /recommend\s+(a\s+)?(treatment|medication|medicine|therapy)/i,
  /what\s+(medication|medicine|drug)\s+should/i,
  /is\s+this\s+(serious|an\s+emergency|urgent)/i,
  /(empfehle|empfehlen)\s+(eine\s+)?(behandlung|medikament|therapie)/i,
  /welches\s+medikament/i,
  /ist\s+das\s+(ernst|gefährlich|notfall)/i,
  /<\s*script\b/i,
  /javascript\s*:/i,
  /on\w+\s*=\s*["']/i,
  /\[INST\]|\[\/INST\]|<<SYS>>|<\|im_start\|>/i,
];

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".webm",
  ".wav",
  ".m4a",
  ".mp4",
  ".mp3",
  ".ogg",
  ".oga",
]);

/**
 * @param {string} code
 */
export function isSupportedInterpreterLanguage(code) {
  const c = String(code || "")
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];
  return INTERPRETER_SUPPORTED_LANGUAGE_CODES.has(c);
}

/**
 * @param {string} code
 */
export function normalizeInterpreterLanguage(code) {
  const c = String(code || "")
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];
  return isSupportedInterpreterLanguage(c) ? c : null;
}

/**
 * @param {string} text
 */
export function sanitizeInterpreterTurnText(text) {
  let s = String(text ?? "");
  s = s.replace(HTML_TAG, " ");
  s = s.replace(BIDI_OVERRIDE, "");
  s = s.replace(ZERO_WIDTH_JOINER, "");
  s = s.replace(CONTROL_CHARS, "");
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Server → client text (transcripts, translations).
 * @param {string} text
 * @param {number} [maxLen]
 */
export function sanitizeInterpreterOutputText(text, maxLen = INTERPRETER_MAX_TURN_CHARS) {
  const cleaned = sanitizeInterpreterTurnText(text);
  if (!cleaned) return "";
  return cleaned.slice(0, maxLen);
}

/**
 * @param {string} text
 */
export function hasPromptInjectionRisk(text) {
  const sample = String(text || "").slice(0, 4000);
  return PROMPT_INJECTION_PATTERNS.some((re) => re.test(sample));
}

/**
 * Safe filename for Whisper upload (no path segments).
 * @param {string | undefined} name
 */
export function sanitizeUploadFilename(name) {
  const raw = String(name || "recording.webm").trim();
  const base = raw.split(/[/\\]/).pop() || "recording.webm";
  const cleaned = base.replace(/[^\w.\-()+ ]/g, "_").slice(0, 64);
  const ext = cleaned.includes(".")
    ? cleaned.slice(cleaned.lastIndexOf(".")).toLowerCase()
    : ".webm";
  const stem = cleaned.includes(".")
    ? cleaned.slice(0, cleaned.lastIndexOf("."))
    : cleaned;
  const safeExt = ALLOWED_UPLOAD_EXTENSIONS.has(ext) ? ext : ".webm";
  const safeStem = stem.replace(/\.+/g, "_").slice(0, 48) || "recording";
  return `${safeStem}${safeExt}`;
}

/**
 * Reject empty/tiny blobs and obvious MIME/buffer mismatches (spoofing mitigation).
 * @param {Buffer | null | undefined} buffer
 * @param {string | undefined} mimetype
 */
export function validateAudioUploadBuffer(buffer, mimetype) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { ok: false, code: "validation_missing_audio", message: "Audio file is required." };
  }
  if (buffer.length < INTERPRETER_MIN_AUDIO_BYTES) {
    return {
      ok: false,
      code: "validation_audio_too_short",
      message: "Recording is too short. Please try again.",
    };
  }
  if (buffer.length > 5 * 1024 * 1024) {
    return {
      ok: false,
      code: "validation_file_too_large",
      message: "Audio file is too large.",
    };
  }

  const mt = String(mimetype || "").toLowerCase();
  if (mt.includes("webm") && buffer.length >= 4) {
    const sig = buffer.readUInt32BE(0);
    if (sig !== 0x1a45dfa3) {
      return {
        ok: false,
        code: "validation_unsupported_audio",
        message: "Unsupported audio format.",
      };
    }
  }
  if (mt.includes("ogg") && buffer.length >= 4) {
    if (buffer.toString("ascii", 0, 4) !== "OggS") {
      return {
        ok: false,
        code: "validation_unsupported_audio",
        message: "Unsupported audio format.",
      };
    }
  }
  if ((mt.includes("wav") || mt.includes("wave")) && buffer.length >= 12) {
    if (buffer.toString("ascii", 0, 4) !== "RIFF") {
      return {
        ok: false,
        code: "validation_unsupported_audio",
        message: "Unsupported audio format.",
      };
    }
  }

  return { ok: true };
}

/**
 * @param {unknown} body
 */
export function assertInterpreterJsonBody(body) {
  if (body == null) {
    return { ok: false, code: "validation_empty", message: "Request body is required." };
  }
  if (typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, code: "validation_invalid_body", message: "Invalid request body." };
  }
  const keys = Object.keys(body);
  if (keys.length > 12) {
    return { ok: false, code: "validation_invalid_body", message: "Invalid request body." };
  }
  return { ok: true };
}

/**
 * @param {{ text?: string, sourceLanguage?: string, targetLanguage?: string, speaker?: string }} body
 */
export function validateInterpreterTranslateInput(body) {
  const bodyCheck = assertInterpreterJsonBody(body);
  if (!bodyCheck.ok) return bodyCheck;

  const rawText = sanitizeInterpreterTurnText(body?.text);
  if (!rawText) {
    return { ok: false, code: "validation_empty", message: "Text is required." };
  }
  if (rawText.length > INTERPRETER_MAX_TURN_CHARS) {
    return {
      ok: false,
      code: "validation_too_long",
      message: `Text must be at most ${INTERPRETER_MAX_TURN_CHARS} characters.`,
    };
  }
  if (hasPromptInjectionRisk(rawText)) {
    return {
      ok: false,
      code: "validation_blocked",
      message: "This text cannot be processed.",
    };
  }

  const sourceLanguage = normalizeInterpreterLanguage(body?.sourceLanguage);
  const targetLanguage = normalizeInterpreterLanguage(body?.targetLanguage);
  if (!sourceLanguage) {
    return {
      ok: false,
      code: "validation_unsupported_language",
      message: "Unsupported or missing source language.",
    };
  }
  if (!targetLanguage) {
    return {
      ok: false,
      code: "validation_unsupported_language",
      message: "Unsupported or missing target language.",
    };
  }
  if (sourceLanguage === targetLanguage) {
    return {
      ok: false,
      code: "validation_same_language",
      message: "Source and target language must differ.",
    };
  }

  const speaker = String(body?.speaker || "")
    .trim()
    .toLowerCase();
  if (speaker !== "patient" && speaker !== "doctor") {
    return {
      ok: false,
      code: "validation_invalid_speaker",
      message: 'Speaker must be "patient" or "doctor".',
    };
  }

  return {
    ok: true,
    text: rawText,
    sourceLanguage,
    targetLanguage,
    speaker,
  };
}

/**
 * Near-realtime preview translate — same fields as full translate, smaller max length, no history.
 * @param {{ text?: string, sourceLanguage?: string, targetLanguage?: string, speaker?: string }} body
 */
export function validateInterpreterNearRealtimeTranslateInput(body) {
  const bodyCheck = assertInterpreterJsonBody(body);
  if (!bodyCheck.ok) return bodyCheck;

  const rawText = sanitizeInterpreterTurnText(body?.text);
  if (!rawText) {
    return { ok: false, code: "validation_empty", message: "Text is required." };
  }
  if (rawText.length > NEAR_REALTIME_MAX_CHUNK_CHARS) {
    return {
      ok: false,
      code: "validation_too_long",
      message: `Preview text must be at most ${NEAR_REALTIME_MAX_CHUNK_CHARS} characters.`,
    };
  }
  if (hasPromptInjectionRisk(rawText)) {
    return {
      ok: false,
      code: "validation_blocked",
      message: "This text cannot be processed.",
    };
  }

  const sourceLanguage = normalizeInterpreterLanguage(body?.sourceLanguage);
  const targetLanguage = normalizeInterpreterLanguage(body?.targetLanguage);
  if (!sourceLanguage) {
    return {
      ok: false,
      code: "validation_unsupported_language",
      message: "Unsupported or missing source language.",
    };
  }
  if (!targetLanguage) {
    return {
      ok: false,
      code: "validation_unsupported_language",
      message: "Unsupported or missing target language.",
    };
  }
  if (sourceLanguage === targetLanguage) {
    return {
      ok: false,
      code: "validation_same_language",
      message: "Source and target language must differ.",
    };
  }

  const speaker = String(body?.speaker || "")
    .trim()
    .toLowerCase();
  if (speaker !== "patient" && speaker !== "doctor") {
    return {
      ok: false,
      code: "validation_invalid_speaker",
      message: 'Speaker must be "patient" or "doctor".',
    };
  }

  return {
    ok: true,
    text: rawText,
    sourceLanguage,
    targetLanguage,
    speaker,
  };
}

/**
 * @param {{ text?: string, language?: string, speaker?: string }} body
 */
export function validateInterpreterSimplifyInput(body) {
  const bodyCheck = assertInterpreterJsonBody(body);
  if (!bodyCheck.ok) return bodyCheck;

  const rawText = sanitizeInterpreterTurnText(body?.text);
  if (!rawText) {
    return { ok: false, code: "validation_empty", message: "Text is required." };
  }
  if (rawText.length > INTERPRETER_MAX_TURN_CHARS) {
    return {
      ok: false,
      code: "validation_too_long",
      message: `Text must be at most ${INTERPRETER_MAX_TURN_CHARS} characters.`,
    };
  }
  if (hasPromptInjectionRisk(rawText)) {
    return {
      ok: false,
      code: "validation_blocked",
      message: "This text cannot be processed.",
    };
  }

  const language = normalizeInterpreterLanguage(body?.language);
  if (!language) {
    return {
      ok: false,
      code: "validation_unsupported_language",
      message: "Unsupported or missing language.",
    };
  }

  const speaker = String(body?.speaker || "")
    .trim()
    .toLowerCase();
  if (speaker !== "patient" && speaker !== "doctor") {
    return {
      ok: false,
      code: "validation_invalid_speaker",
      message: 'Speaker must be "patient" or "doctor".',
    };
  }

  return { ok: true, text: rawText, language, speaker };
}

const ALLOWED_VOICE_PREFERENCES = new Set(["neutral"]);

/**
 * @param {{ text?: string, language?: string, voicePreference?: string }} body
 */
export function validateInterpreterSpeakInput(body) {
  const bodyCheck = assertInterpreterJsonBody(body);
  if (!bodyCheck.ok) return bodyCheck;

  const rawText = sanitizeInterpreterTurnText(body?.text);
  if (!rawText) {
    return { ok: false, code: "validation_empty", message: "Text is required." };
  }
  if (rawText.length > INTERPRETER_MAX_TURN_CHARS) {
    return {
      ok: false,
      code: "validation_too_long",
      message: `Text must be at most ${INTERPRETER_MAX_TURN_CHARS} characters.`,
    };
  }
  if (hasPromptInjectionRisk(rawText)) {
    return {
      ok: false,
      code: "validation_blocked",
      message: "This text cannot be processed.",
    };
  }

  const language = normalizeInterpreterLanguage(body?.language);
  if (!language) {
    return {
      ok: false,
      code: "validation_unsupported_language",
      message: "Unsupported or missing language.",
    };
  }

  let voicePreference;
  if (body?.voicePreference != null && String(body.voicePreference).trim()) {
    const v = String(body.voicePreference).trim().toLowerCase();
    if (!ALLOWED_VOICE_PREFERENCES.has(v)) {
      return {
        ok: false,
        code: "validation_unsupported_voice",
        message: "Unsupported voice preference.",
      };
    }
    voicePreference = v;
  }

  return { ok: true, text: rawText, language, voicePreference };
}

/**
 * Stream / near-realtime TTS — smaller max length, no persistence.
 * @param {{ text?: string, language?: string, voicePreference?: string }} body
 */
export function validateInterpreterStreamSpeakInput(body) {
  const bodyCheck = assertInterpreterJsonBody(body);
  if (!bodyCheck.ok) return bodyCheck;

  const rawText = sanitizeInterpreterTurnText(body?.text);
  if (!rawText) {
    return { ok: false, code: "validation_empty", message: "Text is required." };
  }
  if (rawText.length > STREAM_TTS_MAX_CHARS) {
    return {
      ok: false,
      code: "validation_too_long",
      message: `Text must be at most ${STREAM_TTS_MAX_CHARS} characters for playback.`,
    };
  }
  if (hasPromptInjectionRisk(rawText)) {
    return {
      ok: false,
      code: "validation_blocked",
      message: "This text cannot be processed.",
    };
  }

  const language = normalizeInterpreterLanguage(body?.language);
  if (!language) {
    return {
      ok: false,
      code: "validation_unsupported_language",
      message: "Unsupported or missing language.",
    };
  }

  let voicePreference;
  if (body?.voicePreference != null && String(body.voicePreference).trim()) {
    const v = String(body.voicePreference).trim().toLowerCase();
    if (!ALLOWED_VOICE_PREFERENCES.has(v)) {
      return {
        ok: false,
        code: "validation_unsupported_voice",
        message: "Unsupported voice preference.",
      };
    }
    voicePreference = v;
  }

  return { ok: true, text: rawText, language, voicePreference };
}

/**
 * @param {string | undefined} hint
 */
export function normalizeTranscribeLanguageHint(hint) {
  if (hint == null || !String(hint).trim()) return undefined;
  const norm = normalizeInterpreterLanguage(hint);
  return norm || undefined;
}

/**
 * Post-transcription safety gate before returning to client.
 * @param {string} transcript
 */
export function validateTranscriptOutput(transcript) {
  const cleaned = sanitizeInterpreterOutputText(
    transcript,
    INTERPRETER_MAX_TRANSCRIPT_CHARS,
  );
  if (!cleaned) {
    return {
      ok: false,
      code: "validation_empty",
      message: "No speech was recognized. Please try again.",
    };
  }
  if (hasPromptInjectionRisk(cleaned)) {
    return {
      ok: false,
      code: "validation_blocked",
      message: "Recognized text cannot be processed safely. Please rephrase.",
    };
  }
  return { ok: true, transcript: cleaned };
}
