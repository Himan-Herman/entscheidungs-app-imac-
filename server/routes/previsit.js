import express from 'express';
import { generatePreVisitDoctorVersion } from '../services/preVisitOpenAiClient.js';
import { generatePreVisitAssistantQuestions } from '../services/preVisitAssistantQuestionsClient.js';
import { runSymptomsAdaptiveTurn } from '../services/preVisitIntakeAdaptiveClient.js';
import { runAdaptiveIntakeStep } from '../services/preVisitAdaptiveIntakeClient.js';
import { summarizePreVisitHistoryDiff } from '../services/preVisitHistoryDiffClient.js';
import { speakPreVisitText } from '../services/preVisitVoiceOutput/preVisitVoiceOutputService.js';
import {
  PREVISIT_SPEECH_ERRORS,
  PreVisitSpeechError,
} from '../services/preVisitVoiceOutput/preVisitVoiceOutputPolicy.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { uploadPreVisitVoice } from '../middleware/uploadPreVisitVoice.js';
import { transcribePreVisitVoice } from '../services/preVisitVoice/preVisitVoiceService.js';
import {
  PREVISIT_VOICE_ERRORS,
  PreVisitVoiceError,
} from '../services/preVisitVoice/preVisitVoicePolicy.js';
import {
  previsitAudioSpeakLimiter,
  previsitAudioTranscribeLimiter,
  previsitDoctorVersionLimiter,
  previsitHistoryDiffLimiter,
  previsitAssistantQuestionsLimiter,
} from '../middleware/ipRateLimit.js';

const router = express.Router();

/**
 * Maps a refusal onto a status, without disclosing anything about a provider.
 *
 * The codes deliberately keep the wording the client already handles, so the
 * existing error display keeps working while the meanings behind it get
 * narrower.
 */
function previsitVoiceStatus(code) {
  if (
    code === PREVISIT_VOICE_ERRORS.FEATURE_DISABLED ||
    code === PREVISIT_VOICE_ERRORS.PROVIDER_NOT_CONFIGURED
  ) {
    return 503;
  }
  if (code === PREVISIT_VOICE_ERRORS.NOT_AUTHORIZED) return 403;
  if (code === PREVISIT_VOICE_ERRORS.AUDIO_TOO_LARGE) return 413;
  if (
    code === PREVISIT_VOICE_ERRORS.NO_AUDIO ||
    code === PREVISIT_VOICE_ERRORS.AUDIO_TOO_SHORT ||
    code === PREVISIT_VOICE_ERRORS.UNSUPPORTED_AUDIO_TYPE
  ) {
    return 400;
  }
  return 502;
}

/**
 * POST /doctor-version (mounted at /api/previsit)
 * Body: { patientLanguage, doctorLanguage, answers: { ... } }
 *
 * Rate limit: protects OpenAI cost and availability (see ipRateLimit).
 */
router.post('/doctor-version', previsitDoctorVersionLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const { patientLanguage, doctorLanguage, answers } = body;

    if (
      answers === undefined ||
      answers === null ||
      typeof answers !== 'object' ||
      Array.isArray(answers)
    ) {
      return res.status(400).json({
        error: 'Invalid request: a structured answers object is required.',
      });
    }

    const result = await generatePreVisitDoctorVersion({
      patientLanguage,
      doctorLanguage,
      answers,
    });

    return res.json(result);
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const safe =
      err.safeMessage ||
      (status >= 500
        ? 'Something went wrong. Please try again later.'
        : 'Invalid request.');

    if (!err.statusCode) {
      console.error('[previsit/doctor-version]', err);
    }

    return res.status(status).json({ error: safe });
  }
});

/**
 * POST /assistant-questions (mounted at /api/previsit)
 * Bilingual assistant-style orientation questions (2–7); questions only, no AI answers.
 */
router.post('/assistant-questions', previsitAssistantQuestionsLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const {
      patientLanguage,
      doctorLanguage,
      answers,
      caseTimeline,
      longitudinalSnippet,
    } = body;

    if (
      answers === undefined ||
      answers === null ||
      typeof answers !== 'object' ||
      Array.isArray(answers)
    ) {
      return res.status(400).json({
        error: 'Invalid request: a structured answers object is required.',
      });
    }

    const result = await generatePreVisitAssistantQuestions({
      patientLanguage,
      doctorLanguage,
      answers,
      caseTimeline,
      longitudinalSnippet,
    });

    return res.json(result);
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const safe =
      err.safeMessage ||
      (status >= 500
        ? 'Something went wrong. Please try again later.'
        : 'Invalid request.');

    if (!err.statusCode) {
      console.error('[previsit/assistant-questions]', err);
    }

    return res.status(status).json({ error: safe });
  }
});

/**
 * POST /symptoms-followup (mounted at /api/previsit)
 * Bounded adaptive follow-ups for selected Pre-Visit intake categories.
 */
router.post('/symptoms-followup', async (req, res) => {
  try {
    const body = req.body || {};
    const { patientLanguage, seedStatement, qaHistory, maxFollowUps, category } = body;

    if (seedStatement === undefined || seedStatement === null) {
      return res.status(400).json({ error: 'seedStatement is required.' });
    }

    const result = await runSymptomsAdaptiveTurn({
      category,
      patientLanguage,
      seedStatement,
      qaHistory,
      maxFollowUps,
    });

    return res.json(result);
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const safe =
      err.safeMessage ||
      (status >= 500
        ? 'Something went wrong. Please try again later.'
        : 'Invalid request.');

    if (!err.statusCode) {
      console.error('[previsit/symptoms-followup]', err);
    }

    return res.status(status).json({ error: safe });
  }
});

/**
 * POST /adaptive-intake (mounted at /api/previsit)
 * Unified bounded adaptive intake (non-diagnostic, non-triage).
 */
router.post('/adaptive-intake', async (req, res) => {
  try {
    const body = req.body || {};
    const {
      patientLanguage,
      categoryKey,
      categoryTitle,
      existingCategoryAnswer,
      currentPatientReply,
      previousReplies,
      recentQuestions,
      maxFollowups,
      previousSessionContext,
      compactContext,
      longitudinalCaseCompact,
    } = body;
    if (!categoryKey) {
      return res.status(400).json({ error: 'Invalid request.' });
    }
    const result = await runAdaptiveIntakeStep({
      patientLanguage,
      categoryKey,
      categoryTitle,
      existingCategoryAnswer,
      currentPatientReply,
      previousReplies,
      recentQuestions,
      maxFollowups,
      previousSessionContext,
      compactContext,
      longitudinalCaseCompact,
    });
    return res.json(result);
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const safe =
      err.safeMessage ||
      (status >= 500
        ? 'Something went wrong. Please try again later.'
        : 'Invalid request.');
    if (!err.statusCode) {
      console.error('[previsit/adaptive-intake]', err);
    }
    return res.status(status).json({ error: safe });
  }
});

/**
 * POST /history-diff (mounted at /api/previsit)
 * Factual longitudinal comparison of patient-provided statements only.
 */
router.post('/history-diff', previsitHistoryDiffLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const { previousAnswers, currentAnswers, patientLanguage, doctorLanguage } = body;
    if (
      !previousAnswers ||
      typeof previousAnswers !== 'object' ||
      Array.isArray(previousAnswers) ||
      !currentAnswers ||
      typeof currentAnswers !== 'object' ||
      Array.isArray(currentAnswers)
    ) {
      return res.status(400).json({ error: 'Invalid request.' });
    }
    const result = await summarizePreVisitHistoryDiff({
      previousAnswers,
      currentAnswers,
      patientLanguage,
      doctorLanguage,
    });
    return res.json(result);
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const safe =
      err.safeMessage ||
      (status >= 500
        ? 'Something went wrong. Please try again later.'
        : 'Invalid request.');
    if (!err.statusCode) {
      console.error('[previsit/history-diff]', err);
    }
    return res.status(status).json({ error: safe });
  }
});

/**
 * Maps a read-aloud refusal onto a status, without disclosing anything about a
 * provider.
 *
 * @param {string} code
 */
function previsitSpeechStatus(code) {
  switch (code) {
    case PREVISIT_SPEECH_ERRORS.FEATURE_DISABLED:
    case PREVISIT_SPEECH_ERRORS.PROVIDER_NOT_CONFIGURED:
      return 503;
    case PREVISIT_SPEECH_ERRORS.NOT_AUTHORIZED:
      return 403;
    case PREVISIT_SPEECH_ERRORS.TEXT_REQUIRED:
    case PREVISIT_SPEECH_ERRORS.TEXT_TOO_LONG:
    case PREVISIT_SPEECH_ERRORS.UNEXPECTED_FIELD:
      return 400;
    default:
      return 502;
  }
}

/**
 * POST /audio/speak (mounted at /api/previsit)
 *
 * Reads the current preparation question back to the patient.
 *
 * Since this phase it is flag-gated, provider-gated with its own credential and
 * endpoint allowlist, and it requires proof of being inside a real Pre-Visit
 * context — which it previously did not: the mount carries no `requireAuth`, so
 * before this the route was reachable by anyone at all and spoke any text at
 * the deployment's expense.
 *
 * The guest flow is preserved deliberately, for the same reason as on the
 * dictation route: the toolbar is rendered on a page a patient can reach
 * through a practice's QR code without an account.
 *
 * No audio is stored by this endpoint.
 */
router.post(
  '/audio/speak',
  previsitAudioSpeakLimiter,
  // The mount carries no `requireAuth` because the Pre-Visit flow is open to
  // guests. This reads a token when there IS one, so a logged-in patient is
  // recognised as themselves instead of having to present a QR code.
  optionalAuth,
  async (req, res) => {
    try {
      const { audio, contentType } = await speakPreVisitText({
        userId: req.user?.userId ?? null,
        body: req.body ?? {},
      });

      // Our own Content-Type, from our own constant. A provider's response
      // headers are never echoed.
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(audio.length));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(audio);
    } catch (err) {
      const code =
        err instanceof PreVisitSpeechError ? err.code : PREVISIT_SPEECH_ERRORS.PROVIDER_FAILED;
      // The code and nothing else. The text that was to be spoken and
      // everything about the provider stay out of the log.
      console.error('[previsit/audio/speak]', code);
      return res.status(previsitSpeechStatus(code)).json({ error: code });
    }
  },
);

/**
 * POST /audio/transcribe (mounted at /api/previsit)
 *
 * Turns a Pre-Visit recording into text for the preparation form.
 *
 * Since this phase it is flag-gated, provider-gated with its own credential and
 * endpoint allowlist, and bounded — and it requires proof of being inside a
 * real Pre-Visit context, which it previously did not: the mount carries no
 * `requireAuth`, so before this the route was reachable by anyone at all.
 *
 * The guest flow is preserved deliberately. A patient reaching the preparation
 * through a practice's QR code has no account, and requiring one would remove
 * the flow rather than secure it — so a QR token that resolves to an active
 * practice target counts, and is checked against the database.
 *
 * No audio is stored by this endpoint.
 */
router.post(
  '/audio/transcribe',
  // The limiter runs before the upload: an abusive caller is stopped before a
  // large body is buffered, not after.
  previsitAudioTranscribeLimiter,
  // The mount carries no `requireAuth` because the Pre-Visit flow is open to
  // guests. This reads a token when there IS one, so a logged-in patient is
  // recognised as themselves instead of having to present a QR code.
  optionalAuth,
  (req, res, next) => {
    uploadPreVisitVoice.single('audio')(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: PREVISIT_VOICE_ERRORS.AUDIO_TOO_LARGE });
      }
      return res.status(400).json({ error: PREVISIT_VOICE_ERRORS.UNSUPPORTED_AUDIO_TYPE });
    });
  },
  async (req, res) => {
    try {
      const result = await transcribePreVisitVoice({
        file: req.file,
        language: req.body?.language,
        // Whichever of the two the caller actually has. The QR token is
        // resolved against the database, never trusted as presented.
        userId: req.user?.userId ?? null,
        qrToken: req.body?.qrToken,
      });
      return res.json({ text: result.text });
    } catch (err) {
      const code =
        err instanceof PreVisitVoiceError ? err.code : PREVISIT_VOICE_ERRORS.PROVIDER_FAILED;
      // The code and nothing else. The recording, the transcript and everything
      // about the provider stay out of the log.
      console.error('[previsit/audio/transcribe]', code);
      return res.status(previsitVoiceStatus(code)).json({ error: code });
    }
  },
);

export default router;
