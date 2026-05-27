import express from 'express';
import { openai } from '../openaiClient.js';
import { getMedaTranslationModel } from '../config/openAiModels.js';

const router = express.Router();

const ALLOWED_PAIRS = new Set(['de-en', 'en-de']);

const TRANSLATION_SYSTEM_PROMPT = `Du bist ein medizinischer Dolmetscher. Deine einzige Aufgabe ist die präzise Übersetzung des gegebenen Textes.

Regeln:
- Übersetze ausschließlich den gegebenen Text. Nichts weiter.
- Erfinde keine Symptome, Diagnosen, Medikationen, Körperstellen, Zeitangaben oder Schweregrade.
- Füge nichts hinzu. Entferne nichts. Erkläre nichts.
- Gib keine Empfehlungen und keine Dringlichkeitseinschätzung.
- Bewahre Unsicherheiten, Umgangssprache und Negationen unverändert.
- Übersetze medizinische Fachbegriffe neutral und präzise ohne eigene Bewertung.

Antworte ausschließlich mit einem JSON-Objekt ohne weiteren Text.

Wenn der Text klar und übersetzbar ist:
{"translation":"<Übersetzung>","needsClarification":false,"reason":null}

Wenn der Text zu fragmentiert, unverständlich oder sprachlich nicht eindeutig erkennbar ist:
{"translation":"","needsClarification":true,"reason":"unclear_input"}`;

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
        error: `Sprachpaar ${pair} wird nicht unterstützt.`,
      });
    }

    const response = await openai.chat.completions.create({
      model: getMedaTranslationModel(),
      messages: [
        { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
        { role: 'user', content: trimmed },
      ],
      temperature: 0.1,
      max_completion_tokens: 300,
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? '';

    let translation = '';
    let needsClarification = false;
    let reason = null;

    try {
      const parsed = JSON.parse(raw);
      const rawTranslation = typeof parsed.translation === 'string' ? parsed.translation.trim() : null;
      const rawNc = parsed.needsClarification === true;

      if (rawNc || rawTranslation === null || rawTranslation === '') {
        needsClarification = true;
        reason = rawNc
          ? (typeof parsed.reason === 'string' ? parsed.reason : 'unclear_input')
          : 'invalid_model_response';
      } else {
        translation = rawTranslation;
        reason = null;
      }
    } catch {
      needsClarification = true;
      reason = 'invalid_model_response';
    }

    return res.json({ translation, needsClarification, reason });
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
