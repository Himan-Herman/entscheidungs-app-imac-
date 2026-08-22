/**
 * POST /api/tts — reads a symptom-module reply aloud.
 *
 * Mounted with requireAuth (see app.js). Every caller — the symptom check, the
 * body-region flow and the chat beside an uploaded image — sits behind
 * ProtectedRoute, so requiring a session takes nothing away.
 *
 * Before this phase there was no authentication, no feature flag, no length
 * limit and no dedicated credential: an OpenAI client was built at import time
 * from the shared key and would speak any text, for anyone who could reach the
 * server.
 */

import express from "express";

import {
  SYMPTOM_SPEECH_ERRORS,
  SymptomSpeechError,
} from "../services/symptomVoiceOutput/symptomVoiceOutputPolicy.js";
import { speakSymptomText } from "../services/symptomVoiceOutput/symptomVoiceOutputService.js";
import { SPEECH_OUTPUT_MIME } from "../services/speechOutput/speechAudioFormat.js";

const router = express.Router();

/** @param {string} code */
function symptomSpeechStatus(code) {
  switch (code) {
    case SYMPTOM_SPEECH_ERRORS.FEATURE_DISABLED:
    case SYMPTOM_SPEECH_ERRORS.PROVIDER_NOT_CONFIGURED:
      return 503;
    case SYMPTOM_SPEECH_ERRORS.NOT_AUTHORIZED:
      return 403;
    case SYMPTOM_SPEECH_ERRORS.TEXT_REQUIRED:
    case SYMPTOM_SPEECH_ERRORS.TEXT_TOO_LONG:
    case SYMPTOM_SPEECH_ERRORS.UNEXPECTED_FIELD:
      return 400;
    default:
      return 502;
  }
}

router.post("/", async (req, res) => {
  try {
    const { audio, contentType } = await speakSymptomText({
      userId: req.user?.userId ?? null,
      body: req.body ?? {},
    });

    // Our own Content-Type, from our own constant. A provider's response
    // headers are never echoed.
    res.setHeader("Content-Type", contentType || SPEECH_OUTPUT_MIME);
    res.setHeader("Content-Length", String(audio.length));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(audio);
  } catch (err) {
    const code = err instanceof SymptomSpeechError ? err.code : SYMPTOM_SPEECH_ERRORS.PROVIDER_FAILED;
    // The code only. Never the text that was to be spoken, never a provider's
    // response body, never a credential.
    console.error("[symptom/speech]", code);
    return res.status(symptomSpeechStatus(code)).json({ error: code });
  }
});

export default router;
