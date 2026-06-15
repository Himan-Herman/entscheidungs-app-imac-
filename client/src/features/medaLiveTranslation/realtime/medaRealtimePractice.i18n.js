/**
 * Practice-variant chrome strings for the Meda Realtime page.
 *
 * Scope: ONLY the practice-specific header, subtitle and status chips that are
 * new to the practice variant. The rest of the Realtime page intentionally stays
 * German (matching the existing patient page) — this file is not a full page
 * translation, only the new B2B chrome.
 *
 * Pattern mirrors ../medaLiveTranslation.i18n.js (inline object + getter with
 * English fallback), consumed via useLanguage() from the global LanguageContext.
 */
const practiceChromeI18n = {
  de: {
    title:        'Meda Live-Dolmetscher für Praxen',
    subtitle:     'Sprachvermittlung für strukturierte Arzt-Patienten-Gespräche',
    chipLocalOnly: 'Nur lokale Sitzung',
    chipNoAudio:   'Audio wird nicht gespeichert',
    chipTwoLang:   'Zwei-Sprachen-Modus aktiv',
  },
  en: {
    title:        'Meda Live Interpreter for Practices',
    subtitle:     'Language mediation for structured doctor–patient conversations',
    chipLocalOnly: 'Local session only',
    chipNoAudio:   'Audio is not stored',
    chipTwoLang:   'Two-language mode active',
  },
  fr: {
    title:        'Interprète en direct Meda pour les cabinets',
    subtitle:     'Médiation linguistique pour des consultations médecin-patient structurées',
    chipLocalOnly: 'Session locale uniquement',
    chipNoAudio:   "L'audio n'est pas enregistré",
    chipTwoLang:   'Mode bilingue actif',
  },
  it: {
    title:        'Interprete dal vivo Meda per gli studi medici',
    subtitle:     'Mediazione linguistica per colloqui medico-paziente strutturati',
    chipLocalOnly: 'Solo sessione locale',
    chipNoAudio:   "L'audio non viene salvato",
    chipTwoLang:   'Modalità bilingue attiva',
  },
  es: {
    title:        'Intérprete en directo Meda para consultas',
    subtitle:     'Mediación lingüística para conversaciones médico-paciente estructuradas',
    chipLocalOnly: 'Solo sesión local',
    chipNoAudio:   'El audio no se almacena',
    chipTwoLang:   'Modo bilingüe activo',
  },
};

/** @param {string} language ISO code from useLanguage(); falls back to English. */
export function getPracticeChromeMessages(language) {
  return practiceChromeI18n[language] ?? practiceChromeI18n.en;
}
