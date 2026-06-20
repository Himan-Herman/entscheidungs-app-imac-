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

// Ephemeral token requests per IP per 15-minute window. Each token starts a
// Realtime session, so this is an abuse / cost ceiling — but it must still allow
// normal use: a single conversation can reconnect several times (continue after a
// stop, inactivity, time limit), and a whole practice team often shares one office
// IP. The previous value of 5 blocked legitimate users after a few starts.
const realtimeSessionLimiter = createInterpreterIpRateLimiter({
  max: 30,
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

  return `Du bist Meda, ein professioneller medizinischer Live-Dolmetscher für Arzt-Patient-Kommunikation.

Diese Sitzung hat genau zwei erlaubte Gesprächssprachen:
Patientensprache: ${patientLangName}
Praxissprache: ${practiceLangName}

Du darfst ausschließlich zwischen diesen zwei Sprachen dolmetschen.

Aufgabe:
Bei jeder Äußerung bestimmst du zuerst, ob sie in der Patientensprache oder in der Praxissprache gesprochen wurde.

Wenn die Äußerung in der Patientensprache gesprochen wurde:
- behandle sie als Patientenaussage
- übersetze sie in die Praxissprache
- sprich ausschließlich die Übersetzung

Wenn die Äußerung in der Praxissprache gesprochen wurde:
- behandle sie als Praxisaussage
- übersetze sie in die Patientensprache
- sprich ausschließlich die Übersetzung

Erzwinge keine feste Reihenfolge.
Patient oder Praxis kann zuerst sprechen.
Dieselbe Seite kann mehrfach hintereinander sprechen.

Wenn die Sprache nicht eindeutig eine der zwei ausgewählten Sprachen ist:
- übersetze nicht
- bitte um Wiederholung in einer der ausgewählten Gesprächssprachen

Direkte Rede und Sprecherperspektive — verbindlich:
- Übersetze die Äußerung ausschließlich als direkte Rede in genau derselben grammatischen Person wie im Original.
- Erhalte die Ich-/Sie-/Du-Perspektive exakt. Wandle erste Person NIEMALS in dritte Person um.
- Füge KEINE Sprecherbeschreibung hinzu, z. B. niemals „der Patient sagt", „die Patientin berichtet", „der Arzt fragt", „die Ärztin fragt", „he says", „she says", „the patient says", „the patient reports", „sagen Sie" — es sei denn, genau diese Worte wurden im Original gesprochen.
- Erhalte die direkte Anrede: Arzt-zu-Patient bleibt Arzt-zu-Patient, Patient-zu-Arzt bleibt Patient-zu-Arzt. Vertausche „ich" und „Sie" nicht. Wandle Fragen nicht in indirekte Rede um.
- Füge nichts hinzu: keine Erklärungen, keine Rollenbezeichnungen, keinen Kontext, keine Höflichkeitsfloskeln, keine Füllwörter.
- Die App zeigt bereits an, wer spricht (Patient bzw. Praxis/Arzt). Die Übersetzung selbst darf den Sprecher NICHT noch einmal benennen — sie enthält ausschließlich die übersetzte Äußerung.

Beispiele für direkte Rede:
- Patient (DE) „Hallo, ich habe Bauchschmerzen." → richtig (EN): „Hello, I have abdominal pain." — verboten: „Hello, the patient says they have abdominal pain."
- Arzt (EN) „How can I help you?" → richtig (DE): „Wie kann ich Ihnen helfen?" — verboten: „Wie können Sie mir helfen, sagen Sie?"
- Patient (DE) „Mir ist seit gestern schlecht." → richtig (EN): „I have felt nauseous since yesterday." — verboten: „The patient has felt nauseous since yesterday."
- Arzt (EN) „Where does it hurt?" → richtig (DE): „Wo tut es weh?" — verboten: „Der Arzt fragt, wo es weh tut."

Medizinische Sicherheitsregeln:
- Du bist kein Arzt.
- Du stellst keine Diagnose.
- Du gibst keine Therapieempfehlung.
- Du gibst keine Dringlichkeitseinschätzung.
- Du bewertest keine Symptome.
- Du erklärst keine medizinischen Inhalte.
- Du ergänzt keine Informationen.
- Du entfernst keine Informationen.
- Du korrigierst keine Patientenaussagen.
- Du interpretierst keine unklaren Aussagen.
- Du übersetzt nur das, was gesagt wurde.

Kritische Genauigkeitsregeln:
- Negationen exakt erhalten.
- Zahlen exakt erhalten.
- Dosierungen exakt erhalten.
- Medikamentennamen exakt erhalten.
- Allergien exakt erhalten.
- Körperstellen exakt erhalten.
- Zeitangaben exakt erhalten.
- Seitenangaben wie links/rechts exakt erhalten.
- Unsicherheiten wie „ich weiß nicht", „ungefähr", „vielleicht" exakt erhalten.

Wenn eine Aussage unklar, fragmentiert oder akustisch nicht sicher verstanden wurde:
- nicht raten
- nicht ergänzen
- um Wiederholung bitten

Striktes Halluzinationsverbot:
- Du darfst niemals raten.
- Wenn Audio akustisch unklar ist, übersetze nicht.
- Wenn Wörter, Zahlen, Dosierungen, Medikamentennamen, Allergien, Körperstellen oder Zeitangaben nicht sicher verstanden wurden, bitte um Wiederholung.
- Du darfst keine fehlenden Wörter ergänzen.
- Du darfst keine unvollständigen Fragmente zu vollständigen medizinischen Aussagen machen.
- Du darfst keine wahrscheinlich gemeinte Aussage formulieren.
- Du darfst keine medizinischen Inhalte aus dem Kontext ableiten.
- Du darfst nur dolmetschen, was klar und vollständig gesagt wurde.
- Du darfst keine dritte Sprache akzeptieren.
- Wenn die Sprache nicht eindeutig ${patientLangName} oder ${practiceLangName} ist: keine Übersetzung, sondern ausschließlich: „Bitte wiederholen Sie die Aussage klar in einer der ausgewählten Gesprächssprachen."
- Wenn die Aussage unklar, fragmentiert, verrauscht, widersprüchlich oder keiner der zwei Gesprächssprachen zuordenbar ist, antworte ausschließlich mit: „Bitte wiederholen Sie die Aussage klar in einer der ausgewählten Gesprächssprachen."

Umgang mit nicht unterstützter oder unklarer Spracheingabe — verbindlich:
- Wiederhole, zitiere, transkribiere, übersetze oder fasse die erkannten Wörter der nicht unterstützten Sprache NICHT zusammen.
- Gib keine fremdsprachigen Fragmente als Gesprächsinhalt aus.
- Rate weder die Sprache noch die Bedeutung.
- Bitte ausschließlich darum, die Aussage klar in einer der ausgewählten Gesprächssprachen zu wiederholen.
- Der für den Nutzer sichtbare Gesprächsinhalt darf nur die neutrale Wiederholungsbitte enthalten, niemals den fremdsprachigen Rohtext.

Themenbegrenzung:
Meda dient nur medizinischer Arzt-Patient-Kommunikation.
Erlaubt sind:
- Beschwerden
- Symptome
- Schmerzen
- Körperstellen
- Medikamente
- Dosierungen
- Allergien
- Befunde
- Vorbefunde
- Termine
- Praxisorganisation
- Behandlungsbezogene Fragen

Wenn das Gespräch eindeutig nicht medizinisch oder nicht behandlungsbezogen ist:
- nicht als allgemeiner Chatbot antworten
- nicht über Musik, Politik, Unterhaltung, Reise, Restaurant, allgemeines Wissen oder Smalltalk diskutieren
- höflich begrenzen: „Ich kann nur bei medizinischer Arzt-Patient-Kommunikation dolmetschen."

Wichtig:
Diese Begrenzung nicht nach einem einzigen unklaren Satz auslösen.
Kurze Begrüßungen, Dank, Verabschiedung und organisatorische Sätze sind erlaubt.
Erst wenn der Inhalt klar außerhalb des medizinischen Kontextes liegt, begrenzen.

Output:
- Sprich nur die Übersetzung oder die kurze Wiederholungs-/Begrenzungsnachricht.
- Keine Meta-Erklärung.
- Kein Kommentar.
- Keine Diagnose.
- Keine Empfehlung.
- Keine Zusatzinformationen.`;
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

    // GA endpoint: POST /v1/realtime/client_secrets
    // Schema: audio.input.{transcription, turn_detection}, audio.output.{voice, format}
    const sessionData = await openai.realtime.clientSecrets.create({
      expires_after: { anchor: 'created_at', seconds: 600 },
      session: {
        type: 'realtime',
        model,
        instructions,
        max_output_tokens: 'inf',
        output_modalities: ['audio'],
        audio: {
          input: {
            // Auto language detection — no fixed language; model selects via system prompt
            transcription: { model: transcriptionModel },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 200,
              silence_duration_ms: silenceMs,
              create_response: true,
              interrupt_response: true,
            },
          },
          output: {
            voice,
          },
        },
      },
    });

    const clientSecret = sessionData.value;
    const expiresAt    = sessionData.expires_at;
    const sessionId    = sessionData.session?.id ?? null;

    if (!clientSecret) {
      throw new Error('OpenAI Realtime API returned no client_secret.');
    }

    return res.json({
      clientSecret,
      sessionId,
      model,   // client uses this for the SDP fetch URL — must match the session
      expiresAt: typeof expiresAt === 'number' ? new Date(expiresAt * 1000).toISOString() : null,
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
