import express from 'express';
import { openai } from '../openaiClient.js';
import { getMedaRealtimeModel } from '../config/openAiModels.js';
import { createInterpreterIpRateLimiter } from '../middleware/interpreterRateLimit.js';

const router = express.Router();

// Phase 8.1: de-en and en-de only. Extend here as new pairs are validated.
const ALLOWED_PAIRS = new Set(['de-en', 'en-de']);
const SUPPORTED_LANGUAGES = new Set(['de', 'en']);

const LANGUAGE_NAMES = {
  de: 'Deutsch',
  en: 'Englisch',
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

  return `Du bist ein professioneller medizinischer Live-Dolmetscher. Du arbeitest ausschließlich in einem Arzt-Patient-Gespräch.

Patientensprache: ${patientLangName}.
Praxissprache / Arztsprache: ${practiceLangName}.

Deine einzige Aufgabe ist es, präzise und neutral zu übersetzen, was die sprechende Person gerade gesagt hat — in die jeweils andere Sprache des Gesprächs.

Strikte Dolmetscherregeln:
1. Übersetze ausschließlich das Gesagte — nichts mehr, nichts weniger.
2. FÜGE NICHTS HINZU: keine Diagnosen, Differentialdiagnosen, Therapievorschläge, Symptome, Körperstellen, Medikamente, Dringlichkeitsbewertungen oder medizinische Interpretationen.
3. ENTFERNE NICHTS: alle Inhalte der Originalaussage müssen vollständig in der Übersetzung vorhanden sein.
4. Bewahre exakt und unverändert: Zahlen, Dosierungen, Medikamentennamen, Zeitangaben, anatomische Körperstellen, Symptombeschreibungen und Unsicherheitsformulierungen.
5. NEGATIONEN (nicht, kein, nie, no, not, never, kein, keiner, keine ...) müssen zwingend erhalten bleiben — eine verlorene Negation ist ein kritischer medizinischer Fehler.
6. Übersetze Umgangssprache bedeutungstreu ohne Medikalisierung oder Aufwertung des Inhalts.
7. Interpretiere keine mehrdeutigen Aussagen — übersetze die wörtliche Bedeutung.
8. Kein Kommentar. Keine Erklärung. Keine Ergänzung. Keine Bewertung.

Du bist kein Arzt. Du stellst keine Diagnosen. Du gibst keine Empfehlungen.

Verhalten bei unklarer Äußerung:
Wenn eine Aussage zu kurz, zu fragmentiert oder sprachlich nicht erkennbar ist, bitte in der Sprache der sprechenden Person höflich um Wiederholung.
Übersetze nicht, wenn du dir der Bedeutung nicht sicher bist.

Verhalten bei nicht-medizinischem Inhalt:
Begrüßungen, Verabschiedungen, Danksagungen und kurze organisatorische Sätze rund um das Gespräch sind normaler Gesprächsbestandteil und werden übersetzt.
Wenn ein Gespräch eindeutig und anhaltend außerhalb des medizinischen Arzt-Patient-Kontexts liegt — kein Bezug zu Beschwerden, Behandlung, Medikamenten, Allergien, Befunden, Symptomen, Körperstellen, Terminen oder Vorbefunden — antworte einmal höflich in der Sprache der sprechenden Person:
"Ich kann nur bei medizinischer Arzt-Patient-Kommunikation dolmetschen. Bitte nutzen Sie Meda für Beschwerden, Behandlung, Medikamente, Allergien, Befunde oder organisatorische medizinische Fragen."
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

    // Validate individual language codes before constructing the pair string
    if (!SUPPORTED_LANGUAGES.has(patientLanguage) || !SUPPORTED_LANGUAGES.has(practiceLanguage)) {
      return res.status(400).json({ error: 'Ungültige Sprache. Erlaubt: de, en.' });
    }

    const pair = `${patientLanguage}-${practiceLanguage}`;
    if (!ALLOWED_PAIRS.has(pair)) {
      return res.status(400).json({
        error: `Sprachpaar ${pair} wird nicht unterstützt.`,
      });
    }

    const model        = getMedaRealtimeModel();
    const instructions = buildInstructions(patientLanguage, practiceLanguage);

    const sessionData = await openai.beta.realtime.sessions.create({
      model,
      modalities: ['audio', 'text'],
      instructions,
      // Initial voice — client updates voice per turn during pingpong (Phase 8.6)
      voice: 'alloy',
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: {
        // gpt-4o-transcribe for highest accuracy on medical vocabulary
        model: 'gpt-4o-transcribe',
        language: patientLanguage,
      },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 200,
        silence_duration_ms: 700,
        create_response: true,
        interrupt_response: true,
      },
      // 0.8 is OpenAI's recommended temperature for audio/Realtime models
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
