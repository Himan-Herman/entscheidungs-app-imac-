import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import OpenAI from 'openai';
import { kiOpenAiRouteLimiter } from '../middleware/ipRateLimit.js';
import { logServerError } from '../utils/safeApiError.js';
import { sanitizeAiOutput } from '../services/aiSafetySanitizer.js';
import { AI_MODULES } from '../config/aiSafetyPolicy.js';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', kiOpenAiRouteLimiter, async (req, res) => {
  const { base64Bild, verlauf } = req.body;
  const locale =
    typeof req.body?.patientLanguage === 'string' && req.body.patientLanguage.trim()
      ? req.body.patientLanguage
      : 'en';

  if (!verlauf || !Array.isArray(verlauf)) {
    return res.status(400).json({ fehler: 'Ungültiger Gesprächsverlauf.' });
  }

  try {
    const systemPrompt = {
      role: "system",
      content: `You support patients preparing for medical conversations.

You describe patient-provided images in neutral, everyday language and organize what the user shares.
You do NOT diagnose, detect diseases, assess urgency, recommend treatment or specialists, interpret images as a clinician, or claim certainty.

Use short clarifying questions only when needed (max one per reply unless the user asks for more detail).
End structured answers with a reminder that this is not a diagnosis and does not replace examination.`,
    };

    const messages = [systemPrompt, ...verlauf];

    if (base64Bild) {
      messages.push({
        role: "user",
        content: {
          type: "image_url",
          image_url: { url: base64Bild }
        }
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages
    });

    const raw = completion.choices[0].message.content || '';
    const module = base64Bild ? AI_MODULES.IMAGE_ANALYSIS : AI_MODULES.SYMPTOM_CHECK;
    const safe = sanitizeAiOutput(raw, { module, locale });
    res.json({ antwort: safe.text });

  } catch (error) {
    logServerError('ki/openai', error);
    res.status(500).json({ fehler: 'Die Verarbeitung konnte nicht abgeschlossen werden.' });
  }
});

export default router;
