/**
 * POST /api/transcribe — voice input in the patient's own symptom modules.
 *
 * ── What this route is for ──────────────────────────────────────────────────
 * One client: the VoiceInput control, used in the symptom check, the
 * body-region flow, and beside an uploaded image. In each, a patient dictates a
 * description of their own symptoms. That is the whole surface — established by
 * inventory, and the reason this route can have a single purpose rather than a
 * purpose the caller announces.
 *
 * A client-supplied purpose would be no protection at all: anyone able to call
 * this could claim whichever one is allowed. Here the route IS the purpose, and
 * a future feature wanting to transcribe something else needs its own route and
 * its own approval.
 *
 * ── What changed ────────────────────────────────────────────────────────────
 * Until this phase the route ran on the shared OPENAI_API_KEY with no feature
 * flag and no endpoint allowlist: a key present for an unrelated feature was in
 * effect an approval to transmit spoken symptom descriptions. It now has its
 * own flag, its own credential, its own endpoint allowlist and its own bounds,
 * and refuses when any of them is absent.
 */

import express from "express";
import { uploadSymptomVoice } from "../middleware/uploadSymptomVoice.js";
import { symptomVoiceRouteLimiter } from "../middleware/ipRateLimit.js";
import { transcribeSymptomVoice } from "../services/symptomVoice/symptomVoiceService.js";
import {
  SYMPTOM_VOICE_ERRORS,
  SymptomVoiceError,
} from "../services/symptomVoice/symptomVoicePolicy.js";
import { trackAnalyticsEvent } from "../services/analyticsService.js";

const router = express.Router();

/** Maps a refusal onto a status, without disclosing anything about a provider. */
function statusFor(code) {
  if (code === SYMPTOM_VOICE_ERRORS.FEATURE_DISABLED) return 503;
  if (code === SYMPTOM_VOICE_ERRORS.PROVIDER_NOT_CONFIGURED) return 503;
  if (code === SYMPTOM_VOICE_ERRORS.AUDIO_TOO_LARGE) return 413;
  if (
    code === SYMPTOM_VOICE_ERRORS.NO_AUDIO ||
    code === SYMPTOM_VOICE_ERRORS.AUDIO_TOO_SHORT ||
    code === SYMPTOM_VOICE_ERRORS.UNSUPPORTED_AUDIO_TYPE ||
    code === SYMPTOM_VOICE_ERRORS.AUDIO_MALFORMED
  ) {
    return 400;
  }
  return 502;
}

router.post("/", symptomVoiceRouteLimiter, uploadSymptomVoice.single("audio"), async (req, res) => {
  try {
    // Authentication happens at the mount (`requireAuth`), and the payload is
    // already bounded by the middleware, so nothing large has been accepted on
    // trust before this point.
    const result = await transcribeSymptomVoice({ file: req.file });

    const uid = req.user?.userId;
    if (typeof uid === "string" && uid.length > 0) {
      // Counted, not described: that voice input was used, never what was said.
      void trackAnalyticsEvent({
        eventType: "speech_input_used",
        userId: uid,
        metadata: { usedSpeechInput: true },
      });
    }

    return res.json({ text: result.text, language: result.language });
  } catch (err) {
    const code = err instanceof SymptomVoiceError ? err.code : "transcription_failed";
    // The code and nothing else. The recording and the transcript never reach a
    // log line, and neither does anything about the provider.
    console.error("[transcribe]", code);
    return res.status(statusFor(code)).json({ error: code });
  }
});

export default router;
