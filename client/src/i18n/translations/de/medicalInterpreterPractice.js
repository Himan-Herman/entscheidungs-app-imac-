/** Medical Interpreter — B2B Praxis/Klinik UI (Phase 4.2+). */
export default {
  chrome: {
    moduleTitle: "Dolmetscher für Praxen",
    backToPractice: "Zurück zur Praxis-Übersicht",
    backToInterpreter: "Zurück zum Dolmetscher",
  },
  safety: {
    communicationOnly:
      "Nur Kommunikationshilfe — keine Diagnose, Triage oder Behandlungsempfehlung.",
  },
  hubCard: {
    title: "Medizinischer Dolmetscher",
    description: "Mehrsprachige Kommunikation — nur Gesprächshilfe, keine Diagnose.",
    badge: "Kommunikation",
    ariaLabel: "Medizinischen Dolmetscher für diese Praxis öffnen",
  },
  hub: {
    pageTitle: "Medizinischer Dolmetscher — Praxis",
    heading: "Medizinischer Dolmetscher",
    intro:
      "Unterstützt Patientinnen, Patienten und Behandlungsteams bei der Verständigung in verschiedenen Sprachen. Gespräche bleiben unter Patientenkontrolle, bis eine Freigabe erfolgt.",
    placeholder: "Praxis-Funktionen für den Dolmetscher werden vorbereitet.",
    openDashboard: "Dashboard öffnen",
    openInvites: "Einladungslinks verwalten",
  },
  invites: {
    pageTitle: "Dolmetscher-Einladungen — Praxis",
    heading: "Einladungslinks",
    intro:
      "Erstellen Sie sichere Links oder QR-Codes, damit Patientinnen und Patienten den Dolmetscher im Praxiskontext öffnen können. Beitritt und Freigabe sind noch nicht aktiv.",
    navAria: "Navigation Einladungslinks Dolmetscher",
    backToDashboard: "Zurück zum Dashboard",
    actionsHeading: "Einladung erstellen",
    placeholderNote:
      "Patientinnen und Patienten können Links zum Dolmetscher öffnen. Gesprächstexte werden nur nach ausdrücklicher Einwilligung geteilt.",
    copyLink: "Link kopieren",
    copySuccess: "Link in die Zwischenablage kopiert.",
    copyError: "Link konnte nicht kopiert werden.",
    qrHeading: "QR-Code",
    qrAlt: "QR-Code für Einladungslink",
    qrFallback: "Wenn der QR-Code nicht funktioniert, nutzen Sie den Textlink oben.",
    generateButton: "Einladungslink erstellen",
    generating: "Wird erstellt…",
    managePermissionRequired:
      "Ihre Rolle darf keine Einladungen erstellen oder widerrufen. Bitte wenden Sie sich an die Praxis-Administration.",
    createdHeading: "Neuer Einladungslink",
    createdOnceWarning:
      "Kopieren Sie diesen Link jetzt. Das vollständige Token kann später nicht erneut angezeigt werden.",
    listHeading: "Einladungslinks",
    listLoading: "Einladungslinks werden geladen…",
    listEmpty: "Noch keine Einladungslinks.",
    unnamedInvite: "Einladungslink",
    expiresLabel: "Läuft ab",
    statusActive: "Aktiv",
    statusRevoked: "Widerrufen",
    statusExpired: "Abgelaufen",
    statusUnknown: "Unbekannt",
    statusBadgeAria: "Status: {status}",
    revokeButton: "Link widerrufen",
    revokeDialogTitle: "Einladungslink widerrufen?",
    revokeDialogBody:
      "Patientinnen und Patienten können diesen Link danach nicht mehr nutzen. Dies lässt sich nicht rückgängig machen.",
    revokeDialogCancel: "Abbrechen",
    revokeDialogConfirm: "Widerrufen",
  },
  dashboard: {
    pageTitle: "Dolmetscher-Dashboard — Praxis",
    heading: "Dolmetscher-Dashboard",
    intro:
      "Organisatorische Übersicht für Dolmetscher-Kommunikationshilfe in Ihrer Praxis. Noch keine Patientengespräche in der Liste.",
    placeholder: "Dashboard wird geladen…",
    navAria: "Navigation Dolmetscher-Dashboard",
    overview:
      "Dieser Bereich dient dem Praxis-Workflow. Patientinnen und Patienten behalten die Kontrolle über Dolmetscher-Gespräche, bis sie eine Freigabe wählen.",
    cardsHeading: "Übersicht",
    cardStatusTitle: "Dolmetscher-Status",
    statusLoading: "Status wird geprüft",
    statusLoadingDetail: "Verfügbarkeit des Praxis-Dolmetschers wird geladen.",
    statusOff: "Praxis-Ebene aus",
    statusOffDetail: "Medizinischer Dolmetscher für Praxen ist auf dem Server nicht aktiviert.",
    statusModuleOffDetail:
      "Das Dolmetscher-Modul ist nicht aktiviert. Bitte wenden Sie sich an Ihre Administration.",
    statusActive: "Verfügbar",
    statusActiveDetail:
      "Ihre Praxis kann Dolmetscher-Werkzeuge nutzen. Listen erscheinen, wenn Patienten eine Freigabe wählen.",
    statusLimited: "Eingeschränkter Zugang",
    statusLimitedDetail:
      "Ihre Rolle umfasst keinen vollen Dolmetscher-Zugang für diese Praxis.",
    cardSessionsTitle: "Künftige Praxis-Gespräche",
    cardSessionsBody:
      "Geteilte Dolmetscher-Gespräche erscheinen hier, wenn Patienten zustimmen. Es wird nichts automatisch angezeigt.",
    cardSessionsMeta: "Geteilte Gespräche anzeigen",
    openSessions: "Geteilte Gesprächsdokumentation",
    cardConsentTitle: "Einwilligung erforderlich",
    cardConsentBody:
      "Praxis-Teams können Gesprächstexte nicht ohne ausdrückliche Patienteneinwilligung einsehen. Die Einwilligung ist von allgemeinen Behandlungsbeziehungs-Einstellungen getrennt.",
    cardSafetyTitle: "Nur Kommunikationshilfe",
    cardSafetyBody:
      "Dieses Werkzeug unterstützt Sprache und Verständigung im Gespräch. Keine Diagnose, Triage, Behandlungsempfehlung oder Medikamentenberatung.",
    futureSessionsHeading: "Praxis-Gespräche",
    futureSessionsIntro:
      "Sobald verfügbar, erscheinen von Patienten geteilte Gespräche hier — nur mit Datum und Sprach-Metadaten.",
    futureSessionsEmptyTitle: "Noch keine geteilten Gespräche",
    futureSessionsEmptyBody:
      "Nach Patientenfreigabe erscheinen Dokumentationen in der Gesprächsliste mit Metadaten und Übersetzungstext.",
    privacyHeading: "Datenschutz und Grenzen",
    privacyNoDiagnosis: "Keine Diagnose oder klinische Bewertung.",
    privacyNoTriage: "Keine Dringlichkeits- oder Triage-Einstufung.",
    privacyNoTreatment: "Keine Behandlungs- oder Medikamentenempfehlungen.",
    privacyNoHiddenAccess: "Kein verdeckter Zugriff auf Patientendaten des Dolmetschers.",
    privacyPatientControl: "Patienten steuern Freigabe und können den Zugriff widerrufen.",
    openInvites: "Einladungslinks",
  },
  sessions: {
    pageTitle: "Dolmetscher-Gespräche — Praxis",
    heading: "Geteilte Gesprächsdokumentation",
    intro:
      "Gespräche erscheinen nur nach ausdrücklicher Patienteneinwilligung. Dies ist keine Patientenakte.",
    navAria: "Navigation Dolmetscher-Gespräche",
    backToDashboard: "Zurück zum Dashboard",
    loading: "Geteilte Gespräche werden geladen…",
    empty: "Noch keine geteilten Gespräche. Patienten entscheiden über die Freigabe.",
    sharedBadge: "Mit Einwilligung geteilt",
    languageUnknown: "Sprachen nicht angegeben",
  },
  sessionDetail: {
    pageTitle: "Gesprächsdokumentation — Praxis",
    heading: "Gesprächsdokumentation",
    documentationLabel: "Übersetztes Gesprächsprotokoll (Kommunikationshilfe)",
    navAria: "Navigation Gesprächsdokumentation",
    backToList: "Zurück zur Liste",
    loading: "Dokumentation wird geladen…",
    loadError: "Dokumentation nicht verfügbar oder Einwilligung widerrufen.",
    turnsHeading: "Gesprächsbeiträge",
    speakerPatient: "Patient",
    speakerDoctor: "Behandlungsteam",
  },
  empty: {
    moduleDisabled: "Medizinischer Dolmetscher für Praxen ist nicht aktiviert.",
    serverDisabled: "Praxis-Dolmetscher ist auf dem Server nicht verfügbar.",
    missingPracticeContext:
      "Bitte wählen Sie zuerst ein Praxisprofil in der Praxis-Übersicht, dann öffnen Sie den Dolmetscher.",
    permissionUnavailable:
      "Ihre Rolle umfasst keinen Zugang zum Dolmetscher in dieser Praxis.",
  },
};
