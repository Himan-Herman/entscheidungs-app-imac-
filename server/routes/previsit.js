import express from 'express';
import multer from 'multer';
import { generatePreVisitDoctorVersion } from '../services/preVisitOpenAiClient.js';
import { runSymptomsAdaptiveTurn } from '../services/preVisitIntakeAdaptiveClient.js';
import { runAdaptiveIntakeStep } from '../services/preVisitAdaptiveIntakeClient.js';
import { summarizePreVisitHistoryDiff } from '../services/preVisitHistoryDiffClient.js';
import {
  parseSpeakRequest,
  synthesizePreVisitSpeech,
  transcribePreVisitAudio,
} from '../services/preVisitAudioService.js';
import {
  previsitAudioSpeakLimiter,
  previsitAudioTranscribeLimiter,
  previsitDoctorVersionLimiter,
  previsitHistoryDiffLimiter,
} from '../middleware/ipRateLimit.js';

const router = express.Router();

/** Allowed upload MIME types for Pre-Visit transcription (OpenAI-compatible). */
const PREVISIT_AUDIO_MIMES = new Set([
  'audio/webm',
  'video/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/oga',
]);

const uploadPrevisitAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype && PREVISIT_AUDIO_MIMES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    const err = new Error('UNSUPPORTED_AUDIO_TYPE');
    err.code = 'UNSUPPORTED_AUDIO_TYPE';
    cb(err);
  },
});

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
 * POST /audio/speak (mounted at /api/previsit)
 *
 * Audio processing sends user text to OpenAI for speech generation.
 * No audio is stored by this endpoint.
 *
 * Body JSON: { text, language? }
 *
 * Rate limit: protects OpenAI cost and availability (see ipRateLimit).
 */
router.post('/audio/speak', previsitAudioSpeakLimiter, async (req, res) => {
  try {
    const params = parseSpeakRequest(req.body || {});
    const { buffer, contentType } = await synthesizePreVisitSpeech(params);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buffer);
  } catch (err) {
    const status =
      err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const safe =
      err.safeMessage ||
      (status >= 500
        ? 'Something went wrong. Please try again later.'
        : 'Invalid request.');

    if (!err.statusCode || status >= 500) {
      console.error('[previsit/audio/speak] failed');
    }

    return res.status(status).json({ error: safe });
  }
});

/**
 * POST /audio/transcribe (mounted at /api/previsit)
 *
 * Audio processing sends user audio to OpenAI for transcription.
 * No audio is stored by this endpoint.
 *
 * multipart/form-data: field "audio" (file), optional field "language"
 *
 * Rate limit runs before multer: blocks abuse before large uploads; protects OpenAI cost.
 */
router.post(
  '/audio/transcribe',
  previsitAudioTranscribeLimiter,
  (req, res, next) => {
    uploadPrevisitAudio.single('audio')(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large.' });
      }
      if (err.code === 'UNSUPPORTED_AUDIO_TYPE' || err.message === 'UNSUPPORTED_AUDIO_TYPE') {
        return res.status(400).json({ error: 'Unsupported audio format.' });
      }
      return res.status(400).json({ error: 'Invalid audio upload.' });
    });
  },
  async (req, res) => {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'Audio file is required.' });
      }

      const language =
        req.body?.language != null ? String(req.body.language) : undefined;

      const { text } = await transcribePreVisitAudio({
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        language,
      });

      return res.json({ text });
    } catch (err) {
      const status =
        err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
      const safe =
        err.safeMessage ||
        (status >= 500
          ? 'Something went wrong. Please try again later.'
          : 'Invalid request.');

      if (!err.statusCode || status >= 500) {
        console.error('[previsit/audio/transcribe] failed');
      }

      return res.status(status).json({ error: safe });
    }
  }
);

export default router;
