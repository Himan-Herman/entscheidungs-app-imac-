import express from "express";
import { isLiveMedicalTranslationEnabled } from "../config/featureFlags.js";
import {
  LIVE_TRANSLATION_CLIENT_SECRET_TTL_SECONDS,
  LIVE_TRANSLATION_OUTPUT_SPEED,
  LIVE_TRANSLATION_REALTIME_MODEL,
  LIVE_TRANSLATION_TRANSCRIPTION_MODEL,
  LIVE_TRANSLATION_VAD_SILENCE_MS,
  LIVE_TRANSLATION_VOICE,
  LIVE_TRANSLATION_VOICE_PROFILE,
} from "../config/liveTranslationEnv.js";
import { buildLiveTranslationInstructions } from "../services/liveTranslation/liveTranslationPrompt.js";
import { buildLanguageRouting } from "../services/liveTranslation/liveTranslationRouting.js";
import {
  resolveOpenAiRealtimeVoice,
  resolveOpenAiTranscriptionLanguage,
  resolveOpenAiTranscriptionModel,
} from "../services/liveTranslation/openAiRealtimePayload.js";

const router = express.Router();
const OPENAI_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";

/** Structured debug logs — no transcripts, audio, tokens, or user content. */
function logLiveTranslation(req, event, fields = {}) {
  console.log(
    JSON.stringify({
      level: "info",
      component: "live-translation",
      event,
      requestId: req.requestId || null,
      ...fields,
    }),
  );
}

function sanitizeOpenAiError(data) {
  const err = data?.error;
  if (!err || typeof err !== "object") {
    return {
      openaiErrorType: null,
      openaiErrorCode: null,
      openaiErrorParam: null,
      openaiErrorMessage: null,
      openaiErrorBody: null,
    };
  }
  const sanitized = {
    type: typeof err.type === "string" ? err.type : null,
    code: typeof err.code === "string" ? err.code : null,
    param: typeof err.param === "string" ? err.param : null,
    message: typeof err.message === "string" ? err.message : null,
  };
  return {
    openaiErrorType: sanitized.type,
    openaiErrorCode: sanitized.code,
    openaiErrorParam: sanitized.param,
    openaiErrorMessage: sanitized.message,
    openaiErrorBody: sanitized,
  };
}

const SUPPORTED_LANGUAGE_CODES = new Set([
  "de", "en", "fr", "es", "it", "ru", "uk", "tr", "pt", "ar", "fa", "pl", "ro", "nl",
  "ckb", "ku", "el", "sq", "hr", "bs", "sr", "he", "ur",
]);

function requireLiveTranslationFeature(_req, res, next) {
  if (!isLiveMedicalTranslationEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}

function normalizeLanguageCode(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function validateSessionInput(body) {
  const patientLanguage = normalizeLanguageCode(body?.patientLanguage);
  const doctorLanguage = normalizeLanguageCode(body?.doctorLanguage);
  const activeSpeaker = body?.activeSpeaker === "doctor" ? "doctor" : "patient";

  if (!patientLanguage || !doctorLanguage) {
    return { error: "languages_required" };
  }
  if (patientLanguage === doctorLanguage) {
    return { error: "languages_must_differ" };
  }
  if (!SUPPORTED_LANGUAGE_CODES.has(patientLanguage) || !SUPPORTED_LANGUAGE_CODES.has(doctorLanguage)) {
    return { error: "unsupported_language" };
  }

  return { patientLanguage, doctorLanguage, activeSpeaker };
}

router.use(requireLiveTranslationFeature);

/**
 * POST /api/live-translation/realtime-session
 * Mint ephemeral OpenAI Realtime client secret for WebRTC (never expose OPENAI_API_KEY).
 */
router.post("/realtime-session", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logLiveTranslation(req, "realtime_session_start", { ok: false, reason: "openai_not_configured" });
    return res.status(503).json({ ok: false, error: "openai_not_configured" });
  }

  const validated = validateSessionInput(req.body || {});
  if (validated.error) {
    logLiveTranslation(req, "realtime_session_start", { ok: false, reason: validated.error });
    return res.status(400).json({ ok: false, error: validated.error });
  }

  const { patientLanguage, doctorLanguage, activeSpeaker } = validated;
  logLiveTranslation(req, "realtime_session_start", {
    patientLanguage,
    doctorLanguage,
    activeSpeaker,
    model: LIVE_TRANSLATION_REALTIME_MODEL,
    voice: LIVE_TRANSLATION_VOICE,
  });
  const routing = buildLanguageRouting({ patientLanguage, doctorLanguage, activeSpeaker });
  const instructions = buildLiveTranslationInstructions({
    patientLanguage,
    doctorLanguage,
    activeSpeaker,
  });

  const voice = resolveOpenAiRealtimeVoice(LIVE_TRANSLATION_VOICE);
  const transcriptionModel = resolveOpenAiTranscriptionModel(LIVE_TRANSLATION_TRANSCRIPTION_MODEL);
  const transcriptionLanguage = resolveOpenAiTranscriptionLanguage(routing.sourceLanguage);

  logLiveTranslation(req, "realtime_session_payload", {
    model: LIVE_TRANSLATION_REALTIME_MODEL,
    voice,
    transcriptionModel,
    transcriptionLanguage: transcriptionLanguage || "auto",
    sourceLanguage: routing.sourceLanguage,
    vadSilenceMs: LIVE_TRANSLATION_VAD_SILENCE_MS,
    outputSpeed: LIVE_TRANSLATION_OUTPUT_SPEED,
    hasInstructions: Boolean(instructions),
  });

  const payload = {
    expires_after: {
      anchor: "created_at",
      seconds: LIVE_TRANSLATION_CLIENT_SECRET_TTL_SECONDS,
    },
    session: {
      type: "realtime",
      model: LIVE_TRANSLATION_REALTIME_MODEL,
      instructions,
      output_modalities: ["audio"],
      audio: {
        input: {
          turn_detection: {
            type: "server_vad",
            create_response: true,
            interrupt_response: true,
            silence_duration_ms: LIVE_TRANSLATION_VAD_SILENCE_MS,
          },
          transcription: {
            model: transcriptionModel,
            ...(transcriptionLanguage ? { language: transcriptionLanguage } : {}),
          },
        },
        output: {
          voice,
          speed: LIVE_TRANSLATION_OUTPUT_SPEED,
        },
      },
    },
  };

  try {
    const openaiRes = await fetch(OPENAI_CLIENT_SECRETS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(req.user?.userId
          ? { "OpenAI-Safety-Identifier": String(req.user.userId) }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await openaiRes.json().catch(() => ({}));
    const openAiErrorMeta = sanitizeOpenAiError(data);

    if (!openaiRes.ok) {
      logLiveTranslation(req, "openai_client_secrets_response", {
        ok: false,
        openaiStatus: openaiRes.status,
        ...openAiErrorMeta,
        hasEphemeralSecret: false,
      });
      return res.status(502).json({
        ok: false,
        error: "realtime_session_failed",
        openaiStatus: openaiRes.status,
        openaiErrorParam: openAiErrorMeta.openaiErrorParam,
        openaiErrorMessage: openAiErrorMeta.openaiErrorMessage,
        ...openAiErrorMeta,
      });
    }

    const clientSecret =
      data?.value ||
      data?.client_secret?.value ||
      data?.client_secret ||
      null;
    const expiresAt = data?.expires_at || data?.client_secret?.expires_at || null;
    const hasEphemeralSecret = typeof clientSecret === "string" && clientSecret.length > 0;

    logLiveTranslation(req, "openai_client_secrets_response", {
      ok: hasEphemeralSecret,
      openaiStatus: openaiRes.status,
      hasEphemeralSecret,
      expiresAt: expiresAt || null,
    });

    if (!hasEphemeralSecret) {
      return res.status(502).json({
        ok: false,
        error: "realtime_session_invalid",
        openaiStatus: openaiRes.status,
      });
    }

    return res.json({
      ok: true,
      clientSecret,
      expiresAt,
      model: LIVE_TRANSLATION_REALTIME_MODEL,
      voice,
      voiceProfile: LIVE_TRANSLATION_VOICE_PROFILE,
      outputSpeed: LIVE_TRANSLATION_OUTPUT_SPEED,
      transcriptionModel,
      ...routing,
    });
  } catch (err) {
    logLiveTranslation(req, "realtime_session_exception", {
      ok: false,
      errorName: err && typeof err === "object" && "name" in err ? String(err.name) : "Error",
    });
    return res.status(502).json({ ok: false, error: "realtime_session_failed" });
  }
});

export default router;
