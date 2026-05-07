import express from 'express';
import { generatePreVisitDoctorVersion } from '../services/preVisitOpenAiClient.js';

const router = express.Router();

/**
 * POST /doctor-version (mounted at /api/previsit)
 * Body: { patientLanguage, doctorLanguage, answers: { ... } }
 */
router.post('/doctor-version', async (req, res) => {
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

export default router;
