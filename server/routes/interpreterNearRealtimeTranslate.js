/**
 * Medical Interpreter — near-realtime translation preview (Phase 5.4).
 * POST /api/interpreter/near-realtime/translate
 *
 * Stateless preview only: no session history, no persistence, same AI safety as /translate.
 */

import express from "express";
import {
  isInterpreterNearRealtimeTranslationEnabled,
  isMedicalInterpreterEnabled,
} from "../config/featureFlags.js";
import {
  interpreterNearRealtimeTranslateLimiter,
  interpreterSharedLimiter,
} from "../middleware/interpreterRateLimit.js";
import { validateInterpreterNearRealtimeTranslateInput } from "../services/interpreter/interpreterInputSafety.js";
import { translateInterpreterTurn } from "../services/interpreter/interpreterTranslateService.js";

const router = express.Router();

const MODULE_DISABLED_BODY = {
  ok: false,
  error: "medical_interpreter_disabled",
  message: "Medical Interpreter is not available.",
};

const FEATURE_DISABLED_BODY = {
  ok: false,
  error: "interpreter_near_realtime_disabled",
  message: "Near-realtime translation preview is not available.",
};

function requireInterpreterEnabled(_req, res, next) {
  if (!isMedicalInterpreterEnabled()) {
    return res.status(503).json(MODULE_DISABLED_BODY);
  }
  return next();
}

function requireNearRealtimeEnabled(_req, res, next) {
  if (!isInterpreterNearRealtimeTranslationEnabled()) {
    return res.status(503).json(FEATURE_DISABLED_BODY);
  }
  return next();
}

function getUserId(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function logNearRealtimeError(event, req) {
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

router.use(requireInterpreterEnabled, requireNearRealtimeEnabled);
router.use(interpreterSharedLimiter);

/**
 * POST /api/interpreter/near-realtime/translate
 * Body: { text, sourceLanguage, targetLanguage, speaker }
 */
router.post(
  "/translate",
  interpreterNearRealtimeTranslateLimiter,
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

      const validated = validateInterpreterNearRealtimeTranslateInput(
        req.body || {},
      );
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
        preview: true,
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
      logNearRealtimeError("interpreter_near_realtime_translate_error", req);
      return res.status(502).json({
        ok: false,
        error: "translation_failed",
        message: "Preview translation could not be completed. Please try again.",
      });
    }
  },
);

export default router;
