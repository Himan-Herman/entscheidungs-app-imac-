import express from 'express';
import { openai } from '../openaiClient.js';
import { getMedaTranslationModel } from '../config/openAiModels.js';

const router = express.Router();

const ALLOWED_PAIRS = new Set(['de-en', 'en-de']);

// Allowed values for the reason field — prevents raw model strings leaking to clients.
const ALLOWED_REASONS = new Set(['unclear_input', 'invalid_model_response']);

// Human-readable direction labels for the user message so the model never has to
// guess the translation direction from the text alone.
const DIRECTION_LABELS = {
  'de-en': 'Translate from German to English',
  'en-de': 'Translate from English to German',
};

const TRANSLATION_SYSTEM_PROMPT = `Du bist ein professioneller medizinischer Dolmetscher. Deine einzige Aufgabe ist die präzise, neutrale Übersetzung des gegebenen Textes. Du bist kein Arzt und gibst keinerlei medizinische Einschätzung, Diagnose oder Empfehlung.

Strikte Übersetzungsregeln:
1. Übersetze ausschließlich den gegebenen Text — nichts mehr, nichts weniger.
2. FÜGE NICHTS HINZU: keine Diagnosen, Differentialdiagnosen, Therapievorschläge, Symptome, Körperstellen, Medikamente, Zeitangaben, Schweregrade oder Dringlichkeitsbewertungen.
3. ENTFERNE NICHTS: alle Inhalte des Originals müssen vollständig in der Übersetzung vorhanden sein.
4. Bewahre exakt und unverändert: Zahlen, Dosierungen, Medikamentennamen, Zeitangaben, anatomische Körperstellen und Unsicherheitsformulierungen.
5. NEGATIONEN (nicht, kein, nie, no, not, never …) müssen zwingend erhalten bleiben — eine verlorene Negation ist ein kritischer medizinischer Fehler.
6. Übersetze Umgangssprache bedeutungstreu ohne Medikalisierung oder Aufwertung.
7. Interpretiere keine mehrdeutigen Aussagen — übersetze die wörtliche Bedeutung.
8. Kommentiere nichts. Erkläre nichts. Ergänze keine Hintergrundinformationen.

Umgang mit unklarem Input:
Ist der Text zu fragmentiert, zu kurz für eine sichere Übersetzung, sprachlich nicht eindeutig erkennbar, widersprüchlich oder nicht sicher übersetzbar, gib needsClarification:true zurück.
Im Zweifel ist needsClarification:true sicherer als eine unsichere Übersetzung.

Ausgabeformat — ausschließlich gültiges JSON ohne jeglichen weiteren Text:
Klarer Text:   {"translation":"<Übersetzung>","needsClarification":false,"reason":null}
Unklarer Text: {"translation":"","needsClarification":true,"reason":"unclear_input"}`;

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

    // Include explicit direction so the model never guesses the translation pair.
    const directionLabel = DIRECTION_LABELS[pair];
    const userContent = `${directionLabel}:\n\n${trimmed}`;

    const response = await openai.chat.completions.create({
      model: getMedaTranslationModel(),
      messages: [
        { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
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
      const rawReason = typeof parsed.reason === 'string' ? parsed.reason.trim() : null;

      if (rawNc) {
        // Model explicitly flagged the input as unclear.
        needsClarification = true;
        reason = ALLOWED_REASONS.has(rawReason) ? rawReason : 'unclear_input';
      } else if (rawTranslation === null || rawTranslation === '') {
        // Model returned needsClarification:false but no usable translation — treat
        // as an invalid response rather than showing an empty string to the user.
        needsClarification = true;
        reason = 'invalid_model_response';
      } else {
        translation = rawTranslation;
        needsClarification = false;
        reason = null;
      }
    } catch {
      // Non-JSON output from the model — reject cleanly.
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
