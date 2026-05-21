/**
 * Medical Interpreter — streaming / near-realtime TTS (Phase 5.5).
 * POST /api/interpreter/stream/speak
 *
 * Returns audio/mpeg in memory only — no storage, no text/audio logs.
 */

import express from "express";
import {
  isInterpreterStreamingTtsEnabled,
  isMedicalInterpreterEnabled,
} from "../config/featureFlags.js";
import {
  interpreterSharedLimiter,
  interpreterStreamSpeakLimiter,
} from "../middleware/interpreterRateLimit.js";
import { validateInterpreterStreamSpeakInput } from "../services/interpreter/interpreterInputSafety.js";
import { synthesizeInterpreterSpeech } from "../services/interpreter/interpreterSpeakService.js";

const router = express.Router();

const MODULE_DISABLED_BODY = {
  ok: false,
  error: "medical_interpreter_disabled",
  message: "Medical Interpreter is not available.",
};

const FEATURE_DISABLED_BODY = {
  ok: false,
  error: "interpreter_streaming_tts_disabled",
  message: "Streaming speech playback is not available.",
};

function requireInterpreterEnabled(_req, res, next) {
  if (!isMedicalInterpreterEnabled()) {
    return res.status(503).json(MODULE_DISABLED_BODY);
  }
  return next();
}

function requireStreamingTtsEnabled(_req, res, next) {
  if (!isInterpreterStreamingTtsEnabled()) {
    return res.status(503).json(FEATURE_DISABLED_BODY);
  }
  return next();
}

function getUserId(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function logStreamSpeakError(event, req) {
  const requestId =
    typeof req?.requestId === "string" ? req.requestId : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      event,
      requestId,
    }),
  );
}

router.use(requireInterpreterEnabled, requireStreamingTtsEnabled);
router.use(interpreterSharedLimiter);

/**
 * POST /api/interpreter/stream/speak
 * Body: { text, language, voicePreference? }
 */
router.post(
  "/speak",
  interpreterStreamSpeakLimiter,
  async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({
          ok: false,
          error: "unauthorized",
          message: "Authentication required.",
        });
      }

      const validated = validateInterpreterStreamSpeakInput(req.body || {});
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
      logStreamSpeakError("interpreter_stream_speak_error", req);
      return res.status(502).json({
        ok: false,
        error: "speech_failed",
        message: "Speech playback is temporarily unavailable. Please try again.",
      });
    }
  },
);

export default router;
