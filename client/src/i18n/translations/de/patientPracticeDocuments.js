export default {
  pageTitle: "Praxisdokumente – MedScoutX",
  heading: "Praxisdokumente",
  intro: "Von Ihrer Praxis freigegebene Dokumente — nur zur Orientierung.",
  safetyNote:
    "Diese Dokumente wurden von Ihrer Praxis bereitgestellt. MedScoutX interpretiert keine Befunde und erstellt keine Diagnose.",
  backHub: "Zurück zu Meine Praxis",
  backList: "Zurück zur Übersicht",
  detailPageTitle: "Praxisdokument – MedScoutX",
  loading: "Wird geladen …",
  loadError: "Dokumente konnten nicht geladen werden.",
  documentNotFound: "Dokument nicht gefunden.",
  featureDisabled: "Praxisdokumente sind in dieser Umgebung noch nicht aktiviert.",
  empty: "Noch keine freigegebenen Praxisdokumente.",
  listCaption: "Praxisdokumente",
  fromPractice: "Ihre Praxis",
  sharedAt: "Freigegeben am {date}",
  openDocument: "Dokument öffnen",
  download: "Herunterladen",
  view: "Dokument ansehen",
  viewDocument: "Dokument ansehen",
  permissionDenied: "Sie haben keine Berechtigung für dieses Dokument.",
  linkExpired: "Der Download-Link ist abgelaufen.",
  linkRevoked: "Der Download-Link wurde widerrufen.",
  secureLinkHint: "Sichere Links sind zeitlich begrenzt.",
  typeReport: "Arztbrief / Untersuchungsergebnis",
  typeLab: "Laborbefund",
  typeImaging: "Bildgebungsbericht",
  typeReferral: "Überweisung",
  typeDischarge: "Entlassbrief",
  typePrescriptionInfo: "Rezeptinformation",
  typeOther: "Sonstiges",
  statusShared: "Freigegeben",
  filesHeading: "Dateien",
  noFiles: "Keine Dateien für dieses Dokument.",
  fileSize: "{size}",
  downloadError: "Download fehlgeschlagen.",
  notAvailable: "Dieses Dokument ist nicht mehr verfügbar.",
  askQuestion: "Rückfrage an die Praxis",
  questionSent: "Ihre Rückfrage wurde an die Praxis übermittelt.",
  questionError: "Rückfrage konnte nicht gesendet werden.",
  messagesLink: "Zum sicheren Nachrichtenbereich",
  translation: {
    heading: "Übersetzen & verständlicher lesen",
    subtitle:
      "Übersetze dieses Praxisdokument in eine andere Sprache oder lasse medizinische Fachsprache verständlicher formulieren.",
    sourceLanguageNote:
      "Derzeit für deutschsprachige Praxisdokumente vorgesehen.",

    fileLabel: "Datei",
    filePlaceholder: "Datei auswählen",

    modeLegend: "Art der Bearbeitung",
    modeStrictName: "Fachgetreu übersetzen",
    modeStrictDescription:
      "Überträgt den Dokumentinhalt möglichst genau in die gewählte Sprache. Medizinische Aussagen werden nicht ergänzt oder bewertet.",
    modePlainName: "Einfach erklärt",
    modePlainDescription:
      "Formuliert medizinische Fachsprache verständlicher, ohne neue medizinische Informationen oder Empfehlungen hinzuzufügen.",

    targetLanguageLabel: "Zielsprache",
    targetLanguagePlaceholder: "Sprache auswählen",

    hintSameLanguageStrict:
      "Das Dokument ist bereits auf Deutsch. Wähle eine andere Sprache oder nutze „Einfach erklärt“.",

    submit: "Übersetzung erstellen",
    submitBusy: "Wird erstellt …",
    statusRunning: "Dokument wird verarbeitet …",
    retry: "Erneut versuchen",

    aiNoticeStrict: "KI-generierte Übersetzung",
    aiNoticePlain: "KI-generierte sprachliche Vereinfachung",

    resultOriginalFile: "Originaldatei",
    resultMode: "Bearbeitung",
    resultSourceLanguage: "Ausgangssprache",
    resultTargetLanguage: "Zielsprache",
    resultGeneratedAt: "Erstellt am",

    originalAuthoritative:
      "Diese Ansicht wurde automatisch aus dem Praxisdokument erstellt. Maßgeblich bleibt das Originaldokument.",
    plainNotAdvice: "Die vereinfachte Fassung ersetzt keine medizinische Beratung.",

    viewOriginal: "Original anzeigen",
    downloadPdf: "Als PDF herunterladen",
    pdfUnavailableForLanguage:
      "Der PDF-Export ist für diese Sprache noch nicht verfügbar.",
    pdfTitle: "Übersetzung eines Praxisdokuments",
    pdfFileNameSuffix: "uebersetzung",

    errors: {
      generic: "Die Bearbeitung konnte nicht abgeschlossen werden. Bitte versuche es später erneut.",
      notAvailable: "Diese Funktion ist derzeit noch nicht verfügbar.",
      documentNotFound: "Dieses Dokument wurde nicht gefunden.",
      documentUnavailable: "Dieses Dokument steht nicht mehr zur Verfügung.",
      linkNotActive: "Die Verbindung zu dieser Praxis ist nicht mehr aktiv.",
      fileNotFound: "Diese Datei wurde nicht gefunden.",
      typeNotTranslatable: "Diese Art von Dokument kann derzeit nicht bearbeitet werden.",
      fileTypeUnsupported: "Dieser Dateityp wird derzeit nicht unterstützt.",
      textUnavailable: "Dieses Dokument enthält keinen zuverlässig auslesbaren Text.",
      structureUnsupported:
        "Die Struktur dieses Dokuments kann derzeit nicht sicher verarbeitet werden.",
      encrypted: "Dieses Dokument ist passwortgeschützt und kann nicht gelesen werden.",
      corrupt: "Diese Datei konnte nicht gelesen werden.",
      tooLarge: "Dieses Dokument ist zu umfangreich für die automatische Bearbeitung.",
      sourceLanguageUnsupported:
        "Diese Funktion ist derzeit nur für deutschsprachige Praxisdokumente verfügbar.",
      sourceLanguageUncertain:
        "Die Sprache dieses Dokuments konnte nicht eindeutig zugeordnet werden.",
      medicationUnverifiable:
        "Dieses Dokument enthält Medikationsangaben, die nicht sicher automatisch verarbeitet werden können. Bitte verwende das Originaldokument.",
      dosageUnverifiable:
        "Dieses Dokument enthält Dosierungsangaben, die nicht sicher automatisch verarbeitet werden können. Bitte verwende das Originaldokument.",
      targetLanguageUnsupported: "Diese Zielsprache wird nicht unterstützt.",
      modeInvalid: "Diese Bearbeitungsart ist nicht verfügbar.",
      providerUnavailable:
        "Die Bearbeitung ist derzeit nicht erreichbar. Bitte versuche es später erneut.",
      rateLimited:
        "Es läuft bereits eine Bearbeitung oder es wurden zu viele Anfragen gestellt. Bitte warte einen Moment.",
      timeout: "Die Bearbeitung hat zu lange gedauert. Bitte versuche es erneut.",
      invalidResponse:
        "Die Bearbeitung konnte nicht zuverlässig erstellt werden. Bitte verwende das Originaldokument.",
      integrityFailed:
        "Die Übersetzung konnte nicht zuverlässig erstellt werden. Bitte verwende das Originaldokument.",
    },
  },
};
