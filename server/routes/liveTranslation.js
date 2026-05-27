import express from "express";
import { isLiveMedicalTranslationEnabled } from "../config/featureFlags.js";
import { LIVE_TRANSLATION_VOICE_PROFILE } from "../config/liveTranslationEnv.js";
import {
  buildRealtimeClientSecretsPayload,
  exchangeRealtimeSdp,
  mintRealtimeClientSecret,
} from "../services/liveTranslation/liveTranslationRealtimeService.js";

const router = express.Router();

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
 * Session metadata + optional ephemeral secret (legacy). Prefer realtime-call for SDP.
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
  const built = buildRealtimeClientSecretsPayload(validated);

  logLiveTranslation(req, "realtime_session_start", {
    patientLanguage,
    doctorLanguage,
    activeSpeaker,
    model: built.realtimeModel,
    voice: built.voice,
  });

  logLiveTranslation(req, "realtime_session_payload", {
    model: built.realtimeModel,
    voice: built.voice,
    transcriptionModel: built.transcriptionModel,
    transcriptionLanguage: built.transcriptionLanguage || "auto",
    sourceLanguage: built.routing.sourceLanguage,
    hasInstructions: Boolean(built.payload.session.instructions),
  });

  try {
    const minted = await mintRealtimeClientSecret(apiKey, built.payload, {
      userId: req.user?.userId,
    });

    const _s = built.payload?.session ?? {};
    console.log(
      JSON.stringify({
        tag: "[MedaRealtimePayloadClean]",
        model: built.realtimeModel,
        sessionType: _s.type ?? null,
        outputModalities: _s.output_modalities ?? null,
        voice: _s.audio?.output?.voice ?? null,
        hasTurnDetection: Boolean(_s.turn_detection),
        transcriptionModel: _s.input_audio_transcription?.model ?? null,
        transcriptionLanguage: _s.input_audio_transcription?.language ?? "auto",
        debugMinimal: process.env.REALTIME_DEBUG_MINIMAL === "true",
        openaiStatus: minted.openaiStatus,
        openaiErrorCode: minted.openaiErrorCode ?? null,
        openaiErrorMessage: minted.openaiErrorMessage ?? null,
        openaiErrorParam: minted.openaiErrorParam ?? null,
        ok: minted.ok,
        ephemeralSecretReturned: minted.ok && typeof minted.clientSecret === "string",
      }),
    );

    logLiveTranslation(req, "openai_client_secrets_response", {
      ok: minted.ok,
      openaiStatus: minted.openaiStatus,
      hasEphemeralSecret: minted.ok,
      expiresAt: minted.expiresAt || null,
      openaiErrorParam: minted.openaiErrorParam,
      openaiErrorCode: minted.openaiErrorCode,
    });

    if (!minted.ok) {
      return res.status(502).json({
        ok: false,
        error: "realtime_session_failed",
        openaiStatus: minted.openaiStatus,
        openaiErrorParam: minted.openaiErrorParam,
        openaiErrorMessage: minted.openaiErrorMessage,
      });
    }

    return res.json({
      ok: true,
      clientSecret: minted.clientSecret,
      expiresAt: minted.expiresAt,
      model: built.realtimeModel,
      voice: built.voice,
      voiceProfile: LIVE_TRANSLATION_VOICE_PROFILE,
      outputSpeed: built.payload.session.audio?.output?.speed ?? 1,
      transcriptionModel: built.transcriptionModel,
      ...built.routing,
    });
  } catch (err) {
    logLiveTranslation(req, "realtime_session_exception", {
      ok: false,
      errorName: err && typeof err === "object" && "name" in err ? String(err.name) : "Error",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return res.status(502).json({ ok: false, error: "realtime_session_failed" });
  }
});

/**
 * POST /api/live-translation/realtime-call
 * Server-side WebRTC SDP exchange (same-origin; avoids browser CORS to api.openai.com).
 * Query: patientLanguage, doctorLanguage, activeSpeaker
 * Body: raw SDP offer (application/sdp)
 */
router.post(
  "/realtime-call",
  express.raw({ type: ["application/sdp", "text/plain"], limit: "512kb" }),
  async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ ok: false, error: "openai_not_configured" });
    }

    const validated = validateSessionInput({
      patientLanguage: req.query?.patientLanguage,
      doctorLanguage: req.query?.doctorLanguage,
      activeSpeaker: req.query?.activeSpeaker,
    });

    if (validated.error) {
      return res.status(400).json({ ok: false, error: validated.error });
    }

    const offerSdp =
      typeof req.body === "string"
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString("utf8")
          : "";

    if (!offerSdp.trim()) {
      return res.status(400).json({ ok: false, error: "sdp_offer_required" });
    }

    const built = buildRealtimeClientSecretsPayload(validated);

    logLiveTranslation(req, "realtime_call_start", {
      patientLanguage: validated.patientLanguage,
      doctorLanguage: validated.doctorLanguage,
      activeSpeaker: validated.activeSpeaker,
      model: built.realtimeModel,
      offerBytes: offerSdp.length,
    });

    try {
      const result = await exchangeRealtimeSdp(apiKey, offerSdp, built.payload, {
        userId: req.user?.userId,
      });

      if (!result.ok) {
        logLiveTranslation(req, "realtime_call_failed", {
          phase: result.phase,
          openaiStatus: result.openaiStatus,
          openaiErrorParam: result.openaiErrorParam,
          openaiErrorCode: result.openaiErrorCode,
          openaiErrorMessage: result.openaiErrorMessage,
        });
        return res.status(502).json({
          ok: false,
          error: "sdp_exchange_failed",
          phase: result.phase,
          openaiStatus: result.openaiStatus,
          openaiErrorParam: result.openaiErrorParam,
          openaiErrorMessage: result.openaiErrorMessage,
        });
      }

      logLiveTranslation(req, "realtime_call_ok", {
        openaiStatus: result.openaiStatus,
        answerBytes: result.answerSdp.length,
      });

      res.setHeader("Content-Type", "application/sdp");
      return res.status(200).send(result.answerSdp);
    } catch (err) {
      logLiveTranslation(req, "realtime_call_exception", {
        errorName: err && typeof err === "object" && "name" in err ? String(err.name) : "Error",
      });
      return res.status(502).json({ ok: false, error: "sdp_exchange_failed" });
    }
  },
);

export default router;
