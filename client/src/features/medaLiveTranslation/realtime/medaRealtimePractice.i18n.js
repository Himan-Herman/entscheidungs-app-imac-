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
    qrTitle:       'QR-Code für Praxis-Meda',
    qrShow:        'QR-Code anzeigen',
    qrIntro:       'Scannen Sie diesen Code, um Meda Live-Dolmetscher für diese Praxis zu öffnen.',
    qrNoData:      'Der QR-Code enthält keine Gesprächsinhalte und keine Patientendaten.',
    qrAuthOnly:    'Die Seite ist nur für berechtigte Praxisnutzer zugänglich.',
    qrCopy:        'Link kopieren',
    qrCopied:      'Link wurde kopiert',
    qrDownload:    'QR als PNG herunterladen',
    qrPrint:       'Drucken',
    qrClose:       'Schließen',
    qrNoPractice:  'Bitte wählen Sie zuerst ein Praxisprofil aus.',
    qrError:       'QR-Code konnte nicht erzeugt werden.',
    qrAlt:         'QR-Code, der die Praxis-Meda-Startseite öffnet.',
  },
  en: {
    title:        'Meda Live Interpreter for Practices',
    subtitle:     'Language mediation for structured doctor–patient conversations',
    chipLocalOnly: 'Local session only',
    chipNoAudio:   'Audio is not stored',
    chipTwoLang:   'Two-language mode active',
    qrTitle:       'QR code for practice Meda',
    qrShow:        'Show QR code',
    qrIntro:       'Scan this code to open Meda Live Interpreter for this practice.',
    qrNoData:      'The QR code contains no conversation content and no patient data.',
    qrAuthOnly:    'The page is only accessible to authorised practice users.',
    qrCopy:        'Copy link',
    qrCopied:      'Link copied',
    qrDownload:    'Download QR as PNG',
    qrPrint:       'Print',
    qrClose:       'Close',
    qrNoPractice:  'Please select a practice profile first.',
    qrError:       'Could not generate the QR code.',
    qrAlt:         'QR code that opens the practice Meda start page.',
  },
  fr: {
    title:        'Interprète en direct Meda pour les cabinets',
    subtitle:     'Médiation linguistique pour des consultations médecin-patient structurées',
    chipLocalOnly: 'Session locale uniquement',
    chipNoAudio:   "L'audio n'est pas enregistré",
    chipTwoLang:   'Mode bilingue actif',
    qrTitle:       'Code QR pour Meda du cabinet',
    qrShow:        'Afficher le code QR',
    qrIntro:       "Scannez ce code pour ouvrir l'interprète en direct Meda pour ce cabinet.",
    qrNoData:      'Le code QR ne contient aucun contenu de conversation ni donnée de patient.',
    qrAuthOnly:    'La page est accessible uniquement aux utilisateurs autorisés du cabinet.',
    qrCopy:        'Copier le lien',
    qrCopied:      'Lien copié',
    qrDownload:    'Télécharger le QR en PNG',
    qrPrint:       'Imprimer',
    qrClose:       'Fermer',
    qrNoPractice:  "Veuillez d'abord sélectionner un profil de cabinet.",
    qrError:       "Impossible de générer le code QR.",
    qrAlt:         "Code QR qui ouvre la page d'accueil Meda du cabinet.",
  },
  it: {
    title:        'Interprete dal vivo Meda per gli studi medici',
    subtitle:     'Mediazione linguistica per colloqui medico-paziente strutturati',
    chipLocalOnly: 'Solo sessione locale',
    chipNoAudio:   "L'audio non viene salvato",
    chipTwoLang:   'Modalità bilingue attiva',
    qrTitle:       'Codice QR per Meda dello studio',
    qrShow:        'Mostra codice QR',
    qrIntro:       "Scansiona questo codice per aprire l'interprete dal vivo Meda per questo studio.",
    qrNoData:      'Il codice QR non contiene contenuti della conversazione né dati del paziente.',
    qrAuthOnly:    'La pagina è accessibile solo agli utenti autorizzati dello studio.',
    qrCopy:        'Copia link',
    qrCopied:      'Link copiato',
    qrDownload:    'Scarica QR come PNG',
    qrPrint:       'Stampa',
    qrClose:       'Chiudi',
    qrNoPractice:  'Seleziona prima un profilo dello studio.',
    qrError:       'Impossibile generare il codice QR.',
    qrAlt:         'Codice QR che apre la pagina iniziale Meda dello studio.',
  },
  es: {
    title:        'Intérprete en directo Meda para consultas',
    subtitle:     'Mediación lingüística para conversaciones médico-paciente estructuradas',
    chipLocalOnly: 'Solo sesión local',
    chipNoAudio:   'El audio no se almacena',
    chipTwoLang:   'Modo bilingüe activo',
    qrTitle:       'Código QR para Meda de la consulta',
    qrShow:        'Mostrar código QR',
    qrIntro:       'Escanee este código para abrir el intérprete en directo Meda de esta consulta.',
    qrNoData:      'El código QR no contiene contenido de conversación ni datos del paciente.',
    qrAuthOnly:    'La página solo es accesible para usuarios autorizados de la consulta.',
    qrCopy:        'Copiar enlace',
    qrCopied:      'Enlace copiado',
    qrDownload:    'Descargar QR como PNG',
    qrPrint:       'Imprimir',
    qrClose:       'Cerrar',
    qrNoPractice:  'Seleccione primero un perfil de consulta.',
    qrError:       'No se pudo generar el código QR.',
    qrAlt:         'Código QR que abre la página de inicio Meda de la consulta.',
  },
};

/** @param {string} language ISO code from useLanguage(); falls back to English. */
export function getPracticeChromeMessages(language) {
  return practiceChromeI18n[language] ?? practiceChromeI18n.en;
}
