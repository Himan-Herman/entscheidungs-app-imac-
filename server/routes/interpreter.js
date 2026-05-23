/**
 * Medical Interpreter API (B2C patient).
 *
 * Scope: multilingual communication support only (transcription, translation,
 * conversation documentation, language simplification). This module must NOT
 * provide diagnosis, triage, urgency guidance, or treatment recommendations.
 *
 * Endpoints are flag-gated via MEDICAL_INTERPRETER_ENABLED (default off).
 */

import express from "express";
import {
  isInterpreterNearRealtimeTranslationEnabled,
  isInterpreterStreamingSttEnabled,
  isInterpreterStreamingTtsEnabled,
  isInterpreterTtsEnabled,
  isMedicalInterpreterEnabled,
} from "../config/featureFlags.js";
import {
  interpreterSharedLimiter,
  interpreterSimplifyLimiter,
  interpreterSpeakLimiter,
  interpreterTranscribeLimiter,
  interpreterTranslateLimiter,
} from "../middleware/interpreterRateLimit.js";
import { uploadInterpreterAudio } from "../middleware/uploadInterpreterAudio.js";
import {
  validateAudioUploadBuffer,
  validateInterpreterSimplifyInput,
  validateInterpreterSpeakInput,
  validateInterpreterTranslateInput,
} from "../services/interpreter/interpreterInputSafety.js";
import { simplifyInterpreterText } from "../services/interpreter/interpreterSimplifyService.js";
import { synthesizeInterpreterSpeech } from "../services/interpreter/interpreterSpeakService.js";
import { transcribeInterpreterAudio } from "../services/interpreter/interpreterTranscribeService.js";
import { translateInterpreterTurn } from "../services/interpreter/interpreterTranslateService.js";
import { isInterpreterCloudEnabled } from "../config/featureFlags.js";
import { getCloudStorageStatus } from "../services/interpreter/interpreterCloudStatus.js";
import interpreterCloudSessionsRouter from "./interpreterCloudSessions.js";
import interpreterCloudPreferenceRouter from "./interpreterCloudPreference.js";
import interpreterCloudExportRouter from "./interpreterCloudExport.js";
import interpreterPracticeRouter from "./interpreterPractice.js";
import interpreterInvitePatientRouter from "./interpreterInvitePatient.js";
import interpreterPatientSharingRouter from "./interpreterPatientSharing.js";
import interpreterStreamTranscribeRouter from "./interpreterStreamTranscribe.js";
import interpreterStreamSpeakRouter from "./interpreterStreamSpeak.js";
import interpreterNearRealtimeTranslateRouter from "./interpreterNearRealtimeTranslate.js";

const router = express.Router();

const DISABLED_BODY = {
  ok: false,
  error: "medical_interpreter_disabled",
  message: "Medical Interpreter is not available.",
};

const NOT_IMPLEMENTED_BODY = {
  ok: false,
  error: "not_implemented",
  message: "This endpoint is not implemented yet.",
};

function requireInterpreterEnabled(req, res, next) {
  if (!isMedicalInterpreterEnabled()) {
    return res.status(503).json(DISABLED_BODY);
  }
  return next();
}

const TTS_DISABLED_BODY = {
  ok: false,
  error: "interpreter_tts_disabled",
  message: "Speech playback is not available.",
};

function requireInterpreterTtsEnabled(req, res, next) {
  if (!isInterpreterTtsEnabled()) {
    return res.status(503).json(TTS_DISABLED_BODY);
  }
  return next();
}

function notImplemented(_req, res) {
  return res.status(501).json(NOT_IMPLEMENTED_BODY);
}

function logInterpreterError(event, err, req) {
  const requestId =
    typeof req?.requestId === "string" ? req.requestId : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      event,
      requestId,
      name: err?.name || "Error",
      code: err?.code || undefined,
    }),
  );
}

/** GET /api/interpreter/status — module availability (works when flag is off). */
router.get("/status", (_req, res) => {
  const cloud = getCloudStorageStatus();
  return res.json({
    ok: true,
    enabled: isMedicalInterpreterEnabled(),
    ttsEnabled: isInterpreterTtsEnabled(),
    cloudEnabled: isInterpreterCloudEnabled(),
    cloudAvailable: cloud.cloudAvailable,
    encryptionReady: cloud.encryptionReady,
    streamingSttEnabled: isInterpreterStreamingSttEnabled(),
    nearRealtimeTranslationEnabled: isInterpreterNearRealtimeTranslationEnabled(),
    streamingTtsEnabled: isInterpreterStreamingTtsEnabled(),
  });
});

/** Phase 5.3 — chunked streaming STT prototype (flag-gated). */
router.use("/stream", interpreterStreamTranscribeRouter);

/** Phase 5.5 — streaming / near-realtime TTS (flag-gated). */
router.use("/stream", interpreterStreamSpeakRouter);

/** Phase 5.4 — near-realtime translation preview (flag-gated). */
router.use("/near-realtime", interpreterNearRealtimeTranslateRouter);

/** B2B practice layer — separate from B2C; gated by MEDICAL_INTERPRETER_B2B_ENABLED. */
router.use("/practice", interpreterPracticeRouter);

router.use(interpreterCloudPreferenceRouter);
router.use(interpreterCloudExportRouter);
router.use(interpreterCloudSessionsRouter);

/**
 * POST /api/interpreter/transcribe
 * multipart/form-data: field "audio" (file), optional field "language" (hint)
 * Audio is held in memory only and discarded after processing.
 */
router.post(
  "/transcribe",
  requireInterpreterEnabled,
  interpreterSharedLimiter,
  interpreterTranscribeLimiter,
  (req, res, next) => {
    uploadInterpreterAudio.single("audio")(req, res, (err) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          ok: false,
          error: "validation_file_too_large",
          message: "Audio file is too large.",
        });
      }
      if (err.code === "UNSUPPORTED_AUDIO_TYPE") {
        return res.status(400).json({
          ok: false,
          error: "validation_unsupported_audio",
          message: "Unsupported audio format.",
        });
      }
      return res.status(400).json({
        ok: false,
        error: "validation_invalid_audio",
        message: "Invalid audio upload.",
      });
    });
  },
  async (req, res) => {
    let buffer = null;
    try {
      const audioCheck = validateAudioUploadBuffer(
        req.file?.buffer,
        req.file?.mimetype,
      );
      if (!audioCheck.ok) {
        return res.status(400).json({
          ok: false,
          error: audioCheck.code,
          message: audioCheck.message,
        });
      }

      buffer = req.file.buffer;
      const languageHint =
        req.body?.language != null ? String(req.body.language) : undefined;

      const result = await transcribeInterpreterAudio({
        buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        languageHint,
      });

      if (!result.ok) {
        return res.status(result.statusCode).json({
          ok: false,
          error: result.code,
          message: result.message,
        });
      }

      const payload = {
        ok: true,
        transcript: result.transcript,
      };
      if (result.language) payload.language = result.language;
      if (result.confidence) payload.confidence = result.confidence;

      return res.json(payload);
    } catch (err) {
      logInterpreterError("interpreter_transcribe_error", err, req);
      return res.status(502).json({
        ok: false,
        error: "transcription_failed",
        message: "Transcription could not be completed. Please try again.",
      });
    } finally {
      if (buffer) buffer.fill(0);
      if (req.file) {
        req.file.buffer = null;
      }
    }
  },
);

/**
 * POST /api/interpreter/translate
 * Body: { text, sourceLanguage, targetLanguage, speaker }
 */
router.post(
  "/translate",
  requireInterpreterEnabled,
  interpreterSharedLimiter,
  interpreterTranslateLimiter,
  async (req, res) => {
    try {
      const validated = validateInterpreterTranslateInput(req.body || {});
      if (!validated.ok) {
        return res.status(400).json({
          ok: false,
          error: validated.code,
          message: validated.message,
        });
      }

      const result = await translateInterpreterTurn({
        text: validated.text,
        sourceLanguage: validated.sourceLanguage,
        targetLanguage: validated.targetLanguage,
        speaker: validated.speaker,
      });

      if (result.error === "unsafe_medical_content") {
        return res.status(200).json({
          ok: false,
          error: result.error,
          message: result.message,
        });
      }

      if (!result.ok) {
        return res.status(result.statusCode || 502).json({
          ok: false,
          error: result.code || "translation_failed",
          message: result.message,
        });
      }

      const body = {
        ok: true,
        translatedText: result.translatedText,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        translationDirection: result.translationDirection,
      };
      if (result.confidence) body.confidence = result.confidence;
      if (result.uncertain === true) body.uncertain = true;
      if (result.terminologyWarning === true) body.terminologyWarning = true;
      if (result.unclearSource === true) body.unclearSource = true;
      return res.json(body);
    } catch (err) {
      logInterpreterError("interpreter_translate_error", err, req);
      return res.status(502).json({
        ok: false,
        error: "translation_failed",
        message: "Translation could not be completed. Please try again.",
      });
    }
  },
);

/**
 * POST /api/interpreter/simplify
 * Body: { text, language, speaker }
 */
router.post(
  "/simplify",
  requireInterpreterEnabled,
  interpreterSharedLimiter,
  interpreterSimplifyLimiter,
  async (req, res) => {
    try {
      const validated = validateInterpreterSimplifyInput(req.body || {});
      if (!validated.ok) {
        return res.status(400).json({
          ok: false,
          error: validated.code,
          message: validated.message,
        });
      }

      const result = await simplifyInterpreterText({
        text: validated.text,
        language: validated.language,
        speaker: validated.speaker,
      });

      if (result.error === "unsafe_medical_content") {
        return res.status(200).json({
          ok: false,
          error: result.error,
          message: result.message,
        });
      }

      if (!result.ok) {
        return res.status(result.statusCode || 502).json({
          ok: false,
          error: result.code || "simplification_failed",
          message: result.message,
        });
      }

      const body = {
        ok: true,
        simplifiedText: result.simplifiedText,
        language: result.language,
      };
      if (result.confidence) body.confidence = result.confidence;
      return res.json(body);
    } catch (err) {
      logInterpreterError("interpreter_simplify_error", err, req);
      return res.status(502).json({
        ok: false,
        error: "simplification_failed",
        message: "Simplification could not be completed. Please try again.",
      });
    }
  },
);

/**
 * POST /api/interpreter/speak
 * Body: { text, language, voicePreference?, voiceSpeed? }
 * Returns audio/mpeg (no storage). TTS only — no generative medical content.
 */
router.post(
  "/speak",
  requireInterpreterEnabled,
  requireInterpreterTtsEnabled,
  interpreterSharedLimiter,
  interpreterSpeakLimiter,
  async (req, res) => {
    try {
      const validated = validateInterpreterSpeakInput(req.body || {});
      if (!validated.ok) {
        return res.status(400).json({
          ok: false,
          error: validated.code,
          message: validated.message,
        });
      }

      const result = await synthesizeInterpreterSpeech({
        text: validated.text,
        language: validated.language,
        voicePreference: validated.voicePreference,
        voiceSpeed: validated.voiceSpeed,
      });

      if (!result.ok) {
        return res.status(result.statusCode).json({
          ok: false,
          error: result.code,
          message: result.message,
        });
      }

      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(result.buffer);
    } catch (err) {
      logInterpreterError("interpreter_speak_error", err, req);
      return res.status(502).json({
        ok: false,
        error: "speech_failed",
        message: "Speech playback is temporarily unavailable. Please try again.",
      });
    }
  },
);

/** Patient practice sharing + invite consent (auth required). */
router.use(interpreterInvitePatientRouter);
router.use(interpreterPatientSharingRouter);

export default router;
