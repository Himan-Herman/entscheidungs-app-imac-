import express from 'express';
import { openai } from '../openaiClient.js';
import {
  getMedaRealtimeModel,
  getMedaRealtimeTranscriptionModel,
  getLiveTranslationVoice,
  getLiveTranslationVadSilenceMs,
} from '../config/openAiModels.js';
import { createInterpreterIpRateLimiter } from '../middleware/interpreterRateLimit.js';

const router = express.Router();

// All ISO 639-1 codes accepted by gpt-4o-transcribe (Whisper-based).
// Any pair of two different languages from this set is allowed.
const SUPPORTED_LANGUAGES = new Set([
  'de', 'en', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru',
  'ar', 'tr', 'ro', 'hr', 'uk', 'vi', 'zh', 'fa', 'sr', 'cs', 'sk',
]);

const LANGUAGE_NAMES = {
  de: 'Deutsch',
  en: 'Englisch',
  fr: 'Französisch',
  es: 'Spanisch',
  it: 'Italienisch',
  pt: 'Portugiesisch',
  nl: 'Niederländisch',
  pl: 'Polnisch',
  ru: 'Russisch',
  ar: 'Arabisch',
  tr: 'Türkisch',
  ro: 'Rumänisch',
  hr: 'Kroatisch',
  uk: 'Ukrainisch',
  vi: 'Vietnamesisch',
  zh: 'Chinesisch',
  fa: 'Persisch',
  sr: 'Serbisch',
  cs: 'Tschechisch',
  sk: 'Slowakisch',
};

// Max 5 ephemeral token requests per IP per rate-limit window.
// Each token starts a Realtime session — abuse ceiling to limit cost exposure.
const realtimeSessionLimiter = createInterpreterIpRateLimiter({
  max: 5,
  keyPrefix: 'meda:realtime:session',
});

/**
 * Builds the medical interpreter system instructions for the Realtime session.
 * Instructions are injected server-side — the client cannot override them.
 * @param {string} patientLanguage - ISO 639-1 code ("de" | "en")
 * @param {string} practiceLanguage - ISO 639-1 code ("de" | "en")
 * @returns {string}
 */
function buildInstructions(patientLanguage, practiceLanguage) {
  const patientLangName  = LANGUAGE_NAMES[patientLanguage]  ?? patientLanguage.toUpperCase();
  const practiceLangName = LANGUAGE_NAMES[practiceLanguage] ?? practiceLanguage.toUpperCase();

  return `Du bist ein professioneller medizinischer Live-Dolmetscher.

Diese Sitzung hat genau zwei erlaubte Sprachen:
Patientensprache: ${patientLangName}
Praxissprache: ${practiceLangName}

Du darfst ausschließlich zwischen diesen zwei Sprachen dolmetschen.

Bei jeder Äußerung:
1. Bestimme, ob die Äußerung in der Patientensprache (${patientLangName}) oder in der Praxissprache (${practiceLangName}) gesprochen wurde.
2. Wenn Patientensprache: übersetze vollständig in die Praxissprache.
3. Wenn Praxissprache: übersetze vollständig in die Patientensprache.
4. Erzwinge keine feste Reihenfolge. Patient oder Praxis kann zuerst sprechen. Dieselbe Seite kann mehrfach hintereinander sprechen.
5. Wenn die Sprache nicht eindeutig eine dieser zwei Sprachen ist: antworte NUR auf ${patientLangName} oder ${practiceLangName}: „Bitte in ${patientLangName} oder ${practiceLangName} wiederholen." Übersetze in diesem Fall nicht.
6. Akzeptiere keine dritte Sprache. Reagiere nicht auf Äußerungen in anderen Sprachen als einer Übersetzung, sondern ausschließlich mit der Bitte um Wiederholung in einer der zwei erlaubten Sprachen.

Strikte Dolmetscherregeln:
1. Übersetze ausschließlich das Gesagte — nichts mehr, nichts weniger.
2. FÜGE NICHTS HINZU: keine Diagnosen, Differentialdiagnosen, Therapievorschläge, Symptome, Körperstellen, Medikamente, Dringlichkeitsbewertungen oder medizinische Interpretationen.
3. ENTFERNE NICHTS: alle Inhalte der Originalaussage müssen vollständig in der Übersetzung vorhanden sein.
4. Bewahre exakt und unverändert: Zahlen, Dosierungen, Medikamentennamen, Zeitangaben, anatomische Körperstellen, Symptombeschreibungen und Unsicherheitsformulierungen.
5. NEGATIONEN (nicht, kein, nie, no, not, never ...) müssen zwingend erhalten bleiben — eine verlorene Negation ist ein kritischer medizinischer Fehler.
6. Übersetze Umgangssprache bedeutungstreu ohne Medikalisierung oder Aufwertung des Inhalts.
7. Interpretiere keine mehrdeutigen Aussagen — übersetze die wörtliche Bedeutung.
8. Kein Kommentar. Keine Erklärung. Keine Ergänzung. Keine Bewertung.

Du bist kein Arzt. Du stellst keine Diagnosen. Du gibst keine Empfehlungen. Du nennst keine Dringlichkeitseinschätzungen.

Verhalten bei unklarer oder zu kurzer Äußerung:
Wenn eine Aussage zu kurz, zu fragmentiert oder sprachlich nicht erkennbar ist, bitte auf ${patientLangName} oder ${practiceLangName} höflich um Wiederholung.
Übersetze nicht, wenn du dir der Bedeutung nicht sicher bist.

Verhalten bei nicht-medizinischem Inhalt:
Begrüßungen, Verabschiedungen, Danksagungen und kurze organisatorische Sätze rund um das Gespräch sind normaler Gesprächsbestandteil und werden übersetzt.
Wenn ein Gespräch eindeutig und anhaltend außerhalb des medizinischen Arzt-Patient-Kontexts liegt, antworte einmal höflich auf ${practiceLangName}: „Ich kann nur bei medizinischer Arzt-Patient-Kommunikation dolmetschen."
Wiederhole diesen Hinweis nicht bei jeder weiteren Äußerung.

Sprich klar, ruhig und in natürlichem Gesprächstempo.`;
}

/**
 * POST /api/meda-realtime/session
 *
 * Creates an OpenAI Realtime ephemeral session and returns the client secret.
 * The API key is never exposed — only the short-lived client_secret.value is returned.
 *
 * Body: { patientLanguage: "de", practiceLanguage: "en" }
 * Response: { clientSecret, sessionId, expiresAt, initialInputLang, patientLanguage, practiceLanguage }
 */
router.post('/session', realtimeSessionLimiter, async (req, res) => {
  try {
    const { patientLanguage, practiceLanguage } = req.body ?? {};

    if (typeof patientLanguage !== 'string' || typeof practiceLanguage !== 'string') {
      return res.status(400).json({ error: 'Ungültige Eingabe.' });
    }

    if (!SUPPORTED_LANGUAGES.has(patientLanguage) || !SUPPORTED_LANGUAGES.has(practiceLanguage)) {
      return res.status(400).json({ error: 'Nicht unterstützte Sprache.' });
    }

    if (patientLanguage === practiceLanguage) {
      return res.status(400).json({ error: 'Patientensprache und Praxissprache müssen verschieden sein.' });
    }

    const model              = getMedaRealtimeModel();
    const transcriptionModel = getMedaRealtimeTranscriptionModel();
    const voice              = getLiveTranslationVoice();
    const silenceMs          = getLiveTranslationVadSilenceMs();
    const instructions       = buildInstructions(patientLanguage, practiceLanguage);

    const sessionData = await openai.beta.realtime.sessions.create({
      model,
      modalities: ['audio', 'text'],
      instructions,
      voice,
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: {
        // Auto language detection (no fixed language) — model selects between
        // the two configured languages via the system prompt.
        model: transcriptionModel,
      },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 200,
        silence_duration_ms: silenceMs,
        create_response: true,
        interrupt_response: true,
      },
      temperature: 0.8,
      max_response_output_tokens: 'inf',
    });

    const clientSecret = sessionData.client_secret?.value;
    const expiresAt    = sessionData.client_secret?.expires_at;
    // id not in the official TS type but present in the actual API response
    const sessionId    = /** @type {any} */ (sessionData).id ?? null;

    if (!clientSecret) {
      throw new Error('OpenAI Realtime API returned no client_secret.');
    }

    return res.json({
      clientSecret,
      sessionId,
      model,   // client uses this for the SDP fetch URL — must match the session
      expiresAt: expiresAt != null ? new Date(expiresAt * 1000).toISOString() : null,
      initialInputLang: patientLanguage,
      patientLanguage,
      practiceLanguage,
    });
  } catch (err) {
    // Log technical error details — never log patient content, audio, or API keys
    console.error(JSON.stringify({
      level: 'error',
      context: 'medaRealtime/session',
      name: err?.name,
      message: err?.message,
      status: err?.status,
      code: err?.code,
      type: err?.type,
    }));
    return res.status(500).json({ error: 'Realtime-Session konnte nicht erstellt werden.' });
  }
});

export default router;
