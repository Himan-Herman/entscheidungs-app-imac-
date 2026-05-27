import express from 'express';
import { openai } from '../openaiClient.js';
import { getOpenAiChatModel } from '../config/openAiModels.js';

const router = express.Router();

const ALLOWED_PAIRS = new Set(['de-en']);

const TRANSLATION_SYSTEM_PROMPT = `Du bist ein medizinischer Dolmetscher.
Übersetze nur den gegebenen Text.
Füge nichts hinzu.
Entferne nichts.
Erkläre nichts.
Keine Diagnose.
Keine Therapieempfehlung.
Keine Dringlichkeitseinschätzung.
Wenn etwas unklar ist, übersetze so wörtlich und neutral wie möglich.
Ausgabe nur die Übersetzung, kein Zusatztext.`;

router.post('/translate-text', async (req, res) => {
  try {
    const { text, sourceLanguage, targetLanguage } = req.body ?? {};

    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) {
      return res.status(400).json({ error: 'Text ist leer.' });
    }
    if (trimmed.length > 1000) {
      return res.status(400).json({ error: 'Text zu lang (max. 1000 Zeichen).' });
    }

    const pair = `${sourceLanguage}-${targetLanguage}`;
    if (!ALLOWED_PAIRS.has(pair)) {
      return res.status(400).json({
        error: `Sprachpaar ${pair} wird in Phase 3 nicht unterstützt.`,
      });
    }

    const response = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      messages: [
        { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
        { role: 'user', content: trimmed },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const translation = response.choices[0]?.message?.content?.trim() ?? '';
    return res.json({ translation });
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      context: 'medaLiveTranslation/translate-text',
      name: err?.name,
      message: err?.message,
      status: err?.status,
      code: err?.code,
      type: err?.type,
    }));
    return res.status(500).json({ error: 'Übersetzung fehlgeschlagen.' });
  }
});

export default router;
