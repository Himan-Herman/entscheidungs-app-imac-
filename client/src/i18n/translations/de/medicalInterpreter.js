/**
 * Medical Interpreter — B2C patient module (DE).
 * Communication support only; no diagnosis, triage, or treatment recommendations.
 */
export default {
  hub: {
    title: "Arztgespräch übersetzen",
    subtitle: "Live-Übersetzung für Patient:innen und Praxen",
    cta: "Gespräch starten",
    newConversation: "Neues Gespräch starten",
    trustLine:
      "Nur Kommunikationshilfe — keine Diagnose und keine Behandlungsempfehlung.",
    privacyLine:
      "Mikrofon nur mit Ihrer Erlaubnis. Gesprächsinhalte standardmäßig nur auf diesem Gerät.",
    ariaLabel: "Arztgespräch übersetzen öffnen",
  },

  chrome: {
    moduleTitle: "Arztgespräch übersetzen",
    backToHub: "Zurück zum Patientenbereich",
    backToInterpreterHome: "Zurück zur Dolmetscher-Startseite",
    backToSetup: "Zurück zur Vorbereitung",
  },

  safety: {
    strip:
      "Orientierungshilfe zur Kommunikation — keine medizinische Bewertung, keine Diagnose, keine Behandlungsempfehlung.",
    noDiagnosis: "Keine Diagnose",
    noTriage: "Keine Dringlichkeitseinschätzung",
    noTreatment: "Keine Behandlungsempfehlung",
    verifyTranslation:
      "Automatische Übersetzungen können Fehler enthalten. Bitte prüfen Sie wichtige Inhalte mit Ihrem Behandlungsteam.",
    communicationOnly:
      "Dieses Modul unterstützt Übersetzung und Dokumentation von Gesprächen — nicht die medizinische Beurteilung Ihrer Situation.",
  },

  start: {
    pageTitle: "MedScoutX — Gespräch vorbereiten",
    heading: "Arztgespräch übersetzen",
    intro:
      "Bereiten Sie ein mehrsprachiges Gespräch mit Ihrem Behandlungsteam vor. Die Einrichtung dauert nur wenige Schritte.",
    stepOf: "Schritt {{current}} von {{total}}",
    back: "Zurück",
    next: "Weiter",
    cancel: "Abbrechen",
    cancelConfirm: "Einrichtung wirklich abbrechen?",
  },

  languages: {
    heading: "Sprachen wählen",
    intro:
      "Nur die beiden Sprachen sind Pflicht. Alle weiteren Angaben können Sie überspringen.",
    requiredLegend: "Mit * gekennzeichnet = Pflichtfeld",
    patientLabel: "Ihre Sprache *",
    doctorLabel: "Sprache des Behandlungsteams *",
    patientHint: "Die Sprache, in der Sie sprechen",
    doctorHint: "Die Sprache, in der das Behandlungsteam spricht",
    required: "Bitte wählen Sie beide Sprachen.",
    selectEmpty: "Bitte wählen",
    loadingDefaults: "Standardsprachen werden geladen …",
    searchLabel: "Sprache finden",
    searchPlaceholder: "Nach Name oder Code suchen …",
    searchEmpty: "Keine Sprache entspricht der Suche.",
    mixedDirectionNote:
      "Dieses Gespräch nutzt rechts-nach-links- und links-nach-rechts-Sprachen. Bitte lesen Sie jeden Abschnitt in seiner eigenen Richtung.",
  },

  profile: {
    heading: "Profil für dieses Gespräch",
    intro:
      "Optional: Daten aus Ihrem Konto für dieses Gespräch verwenden (z. B. für eine spätere Dokumentation).",
    consentLabel: "Gespeicherte Profildaten für dieses Gespräch verwenden",
    consentHint:
      "Name, Geburtsdatum und Kontakt — nur wenn Sie zustimmen. Keine Gesundheitsdaten aus dem Gesundheitsprofil.",
    accountLink: "In den Kontoeinstellungen bearbeiten",
    loadError:
      "Profil konnte nicht geladen werden. Sie können ohne Profildaten fortfahren.",
    skipped: "Ohne Profildaten fortfahren",
  },

  doctorInfo: {
    heading: "Termin-Details (optional)",
    intro:
      "Diese Angaben helfen bei der Orientierung und späteren Dokumentation. Sie können alle Felder leer lassen.",
    toggleShow: "Details hinzufügen",
    toggleHide: "Details ausblenden",
    doctorName: "Name der behandelnden Person",
    doctorNamePlaceholder: "z. B. Dr. Schmidt",
    practiceName: "Praxis oder Klinik",
    practiceNamePlaceholder: "Name der Einrichtung",
    specialty: "Fachrichtung",
    specialtyPlaceholder: "z. B. Allgemeinmedizin",
    appointmentDate: "Termin (Datum)",
    conversationTitle: "Titel für dieses Gespräch",
    conversationTitlePlaceholder: "z. B. Kontrolltermin",
  },

  privacy: {
    heading: "Kurz bestätigen",
    body1:
      "Dieses Modul unterstützt Übersetzung und Dokumentation von Gesprächen zwischen Ihnen und Ihrem Behandlungsteam. Es stellt keine Diagnose dar und enthält keine Dringlichkeitseinschätzung oder Behandlungsempfehlung.",
    body2:
      "Automatische Übersetzungen und Spracherkennung können ungenau oder unvollständig sein. Bitte prüfen Sie wichtige Inhalte gemeinsam mit Ihrem Behandlungsteam.",
    body3:
      "Audio wird nur zur Spracherkennung übertragen, im Arbeitsspeicher verarbeitet und weder auf MedScoutX-Servern noch in dieser App gespeichert.",
    body4:
      "Gesprächsdaten bleiben in Phase 1 nur auf diesem Gerät (lokal). Es werden keine Server-Datensätze für Gesprächsinhalte angelegt.",
    storageLabel: "Gespräch auf diesem Gerät speichern",
    storageHint:
      "Ermöglicht Fortsetzung und erneutes Öffnen auf diesem Gerät. Sie können das Gespräch später löschen.",
    noStorageWarning:
      "Ohne Speicherung geht dieses Gespräch beim Verlassen der Seite verloren.",
    acceptLabel: "Ich habe die Hinweise gelesen und verstanden *",
    acceptRequired: "Bitte bestätigen Sie die Hinweise.",
    beginCta: "Gespräch beginnen",
    legalLinks:
      "Weitere Informationen finden Sie unter Datenschutz und rechtlichen Hinweisen.",
    linkPrivacy: "Datenschutz",
    linkDisclaimer: "Hinweise",
  },

  live: {
    mockOriginalPatient:
      "Ich möchte etwas Wichtiges besprechen.",
    mockOriginalDoctor:
      "Bitte fahren Sie in Ihren Worten fort.",
    mockTranslationPreview:
      "Übersetzungsvorschau — Verbindung zur Übersetzung folgt in einer späteren Version.",
    statusRegion: "Aufnahmestatus",
    currentTurn: "Aktuelle Äußerung",
  },

  room: {
    pageTitle: "MedScoutX — Live-Gespräch",
    heading: "Live-Gespräch",
    languagesLabel: "{{patient}} ↔ {{doctor}}",
    statusIdle: "Bereit",
    statusRecording: "Aufnahme …",
    statusUploading: "Aufnahme wird beendet …",
    statusTranscribing: "Sprache wird erkannt …",
    statusTranslating: "Wird übersetzt …",
    statusSimplifying: "Sprache wird vereinfacht …",
    statusSpeaking: "Audio wird wiedergegeben …",
    statusReadyForNext: "Bereit für die nächste Äußerung",
    statusEditingDraft: "Gesprochenen Text prüfen, dann übersetzen",
    statusBlocked: "Übersetzung blockiert — bitte Text anpassen",
    statusError: "Bei diesem Beitrag ist ein Fehler aufgetreten",
    speakerDirection: "Sie sprechen {{source}} · Übersetzung nach {{target}}",
    turnPatient: "Sie sprechen",
    turnClinician: "Behandlungsteam spricht",
    speakerTogglePatient: "Ich spreche",
    speakerToggleClinician: "Behandlungsteam spricht",
    disclaimerStrip:
      "Kommunikationsunterstützung — bitte wichtige Inhalte mit dem Behandlungsteam prüfen.",
  },

  transcript: {
    heading: "Gesprochener Text",
    placeholder: "Nach der Aufnahme erscheint hier der erkannte Text.",
    edit: "Text bearbeiten",
    saveEdit: "Änderung übernehmen",
    confirm: "Text bestätigen und übersetzen",
    editingHint: "Prüfen Sie den Text, bevor er übersetzt wird.",
    empty: "Noch keine Aufnahme in dieser Runde.",
    lowConfidenceInput:
      "Die Spracherkennung kann ungenau sein. Bitte prüfen und korrigieren Sie den Text vor der Übersetzung.",
    draftSavedHint:
      "Ihr Entwurf wird auf diesem Gerät gespeichert, während Sie bearbeiten.",
  },

  translation: {
    heading: "Übersetzung",
    placeholder: "Die Übersetzung erscheint nach Bestätigung des Textes.",
    empty: "Noch keine Übersetzung in dieser Runde.",
    lowConfidence:
      "Bitte prüfen: der gesprochene Text wurde möglicherweise nicht genau erkannt. Klären Sie wichtige Inhalte mit Ihrem Behandlungsteam.",
    uncertainLabel:
      "Ein Teil der Formulierung war unklar — die Übersetzung erfasst möglicherweise nicht alles. Bitte wichtige Details gemeinsam bestätigen.",
    terminologyWarning:
      "Medikamentennamen, Zahlen, Einheiten oder Verneinungen sollten geprüft werden. Bitte wichtige Begriffe mit medizinischem Fachpersonal abgleichen.",
    unclearSourceWarning:
      "Die ursprüngliche Formulierung klang unklar. Verlassen Sie sich bei wichtigen medizinischen Details nicht allein auf diese Übersetzung.",
    languagePairLimited:
      "Diese Sprachkombination wird in der App nicht vollständig unterstützt. Bitte wichtige Begriffe mit medizinischem Fachpersonal prüfen.",
    mixedDirectionSession:
      "In diesem Gespräch werden RTL- und LTR-Sprachen verwendet. Bitte jeden Textblock sorgfältig prüfen.",
    verifyTermsNotice:
      "Automatische Übersetzung kann ungenau sein. Bitte Medikamentennamen, Dosierungen, Allergien und andere wichtige Begriffe mit medizinischem Fachpersonal abgleichen.",
    blocked:
      "Die Übersetzung konnte nicht in einer sicheren Form ausgegeben werden. Bitte formulieren Sie neutraler oder besprechen Sie den Inhalt direkt.",
    replay: "Übersetzung erneut anzeigen",
  },

  speak: {
    listenTranslation: "Übersetzung abspielen",
    listenSimplified: "Vereinfachten Text abspielen",
    loading: "Audio wird vorbereitet …",
    stop: "Wiedergabe stoppen",
    playbackPlaying: "Audio wird wiedergegeben",
    playbackStopped: "Wiedergabe gestoppt",
    retry: "Wiedergabe erneut versuchen",
  },

  streamingTts: {
    heading: "Sprachausgabe (Nahe-Echtzeit)",
    experimentalBadge: "Optional — Audio startet nie automatisch.",
    privacyNote:
      "Audio wird nur auf Anfrage erzeugt und nur im Arbeitsspeicher dieses Geräts gehalten, bis Sie die Seite verlassen.",
    enablePreviewPlayback:
      "Wiedergabe der Übersetzungsvorschau erlauben (nur manueller Start)",
    playPreview: "Vorschau-Übersetzung abspielen",
    stopPlayback: "Wiedergabe stoppen",
    playPreviewAria: "Nahe-Echtzeit-Übersetzungsvorschau vorlesen",
    stopPlaybackAria: "Sprachausgabe stoppen",
    statusLoading: "Sprache wird vorbereitet …",
    statusPlaying: "Übersetzungs-Audio wird wiedergegeben",
    statusIdle: "Wiedergabe gestoppt",
    previewDisabledHint:
      "Aktivieren Sie oben die Vorschau-Wiedergabe, um die unbestätigte Übersetzung zu hören.",
    errorGeneric:
      "Wiedergabe konnte nicht starten. Sie können es erneut versuchen oder ohne Audio fortfahren.",
    staleBlockPlayback:
      "Vorschau-Text hat sich geändert — warten Sie auf eine aktualisierte Vorschau oder verwerfen Sie sie vor der Wiedergabe.",
  },

  simplify: {
    action: "Sprache vereinfachen",
    heading: "Vereinfachte Formulierung",
    note:
      "Nur Sprachvereinfachung — keine medizinische Beratung. Bitte prüfen Sie wichtige Informationen mit medizinischem Fachpersonal.",
    hide: "Vereinfachten Text ausblenden",
    loading: "Formulierung wird vereinfacht …",
  },

  pushToTalk: {
    record: "Zum Sprechen gedrückt halten",
    recordTap: "Tippen zum Sprechen",
    stop: "Aufnahme beenden",
    recording: "Aufnahme läuft",
    micTest: "Mikrofon testen",
    micTestHint: "Kurze Testaufnahme — es wird nichts übersetzt.",
    micDenied: "Mikrofon ist nicht verfügbar.",
    micDeniedGuidance:
      "Erlauben Sie den Mikrofon-Zugriff für diese Website in den Browser-Einstellungen und tippen Sie dann auf „Mikrofon erneut versuchen“. Sie können den Text auch oben eingeben.",
    micRetry: "Mikrofon erneut versuchen",
    tooShort:
      "Aufnahme zu kurz. Bitte etwas länger sprechen und erneut versuchen.",
    likelySilent:
      "Es wurde keine klare Sprache erkannt. Bitte Mikrofon prüfen und erneut versuchen.",
    preparing: "Mikrofon wird vorbereitet …",
    stopping: "Aufnahme wird beendet …",
    maxDurationHint: "Maximale Aufnahmedauer erreicht. Bitte Aufnahme beenden.",
    keyboardHint:
      "Tipp: Sprech-Button auswählen, dann Leertaste oder Eingabetaste.",
    liveHint:
      "Tippen, sprechen — nach etwa 2–3 Sekunden Pause wird automatisch übersetzt.",
    disabledDraft:
      "Bitte zuerst den aktuellen Text prüfen, bevor Sie neu aufnehmen.",
    disabledBusy: "Bitte warten, bis der aktuelle Schritt abgeschlossen ist.",
    disabledOffline: "Für Aufnahmen ist eine Internetverbindung nötig.",
  },

  streaming: {
    heading: "Streaming-Transkript-Vorschau (experimentell)",
    experimentalBadge:
      "Optionale Beta — Push-to-Talk bleibt der Standard und die sicherste Methode.",
    privacyNote:
      "Audio wird nur in kurzen Abschnitten zur Transkription gesendet. Auf unseren Servern wird kein Audio dauerhaft gespeichert. Der Text bleibt vorläufig, bis Sie ihn als Entwurf übernehmen und vor der Übersetzung bestätigen.",
    pttDefaultNote:
      "Für den Alltag nutzen Sie weiter Push-to-Talk oben. Streaming nur starten, wenn Sie diese Vorschau testen möchten.",
    captionsAria: "Vorläufige Streaming-Untertitel",
    captionsEmpty:
      "Noch kein vorläufiger Text. Streaming starten, um Untertitel hier zu sehen.",
    provisionalLabel: "Vorläufiger Entwurf (nicht bestätigt)",
    startButton: "Streaming-Vorschau starten",
    stopButton: "Streaming beenden",
    stopping: "Wird beendet …",
    cancelButton: "Abbrechen",
    useAsDraftButton: "Als Entwurf übernehmen (vor Übersetzung bearbeiten)",
    startAria: "Experimentelle Streaming-Transkript-Vorschau starten",
    stopAria: "Streaming-Transkript-Vorschau beenden",
    statusIdle: "Streaming inaktiv",
    statusConnecting: "Verbindung wird aufgebaut …",
    statusConnected: "Streaming — Mikrofon aktiv",
    statusProcessing: "Audio-Abschnitt wird verarbeitet …",
    statusFinalizing: "Transkript wird abgeschlossen …",
    previewReady:
      "Streaming beendet. Text prüfen und bei Bedarf als Entwurf übernehmen.",
    unsupportedBrowser:
      "Streaming-Vorschau wird in diesem Browser nicht unterstützt. Bitte Push-to-Talk nutzen.",
    errorGeneric:
      "Streaming konnte nicht fortgesetzt werden. Bitte beenden und Push-to-Talk nutzen.",
    backpressureError:
      "Audio kommt zu schnell an. Streaming wurde beendet — bitte Push-to-Talk nutzen oder langsamer erneut versuchen.",
    disabledWhileStreaming:
      "Bitte Streaming beenden, bevor Sie Push-to-Talk nutzen.",
    maxDurationReached:
      "Maximale Streaming-Dauer erreicht. Vorschau wurde abgeschlossen — als Entwurf übernehmen oder Push-to-Talk nutzen.",
    fallbackToPtt:
      "Wenn Vorschau-Modi nicht verfügbar sind, nutzen Sie Push-to-Talk oben — das bleibt der Standard.",
  },

  nearRealtime: {
    heading: "Nahe-Echtzeit-Übersetzungsvorschau",
    experimentalBadge:
      "Nur optionale Vorschau — wird erst gespeichert, wenn Sie einen Entwurf unten bestätigen.",
    privacyNote:
      "Es wird nur das aktuelle Transkript-Snippet übersetzt. Kein Gesprächsverlauf, kein Audio, und auf dem Server wird keine Sitzung gespeichert.",
    notConfirmedLabel: "Übersetzungsvorschau (nicht bestätigt)",
    previewAria: "Vorläufige Nahe-Echtzeit-Übersetzungsvorschau",
    previewEmpty:
      "Wenn das Streaming-Transkript stabil ist, kann hier eine Übersetzungsvorschau erscheinen.",
    statusIdle: "Nahe-Echtzeit-Vorschau inaktiv",
    statusWaiting: "Warte auf stabiles Transkript …",
    statusTranslating: "Übersetzungsvorschau wird erstellt …",
    statusReady: "Übersetzungsvorschau bereit — nicht gespeichert",
    confirmRequiredNote:
      "Nutzen Sie oben „Als Entwurf übernehmen“, bearbeiten Sie bei Bedarf, und bestätigen Sie die Übersetzung im Transkript-Bereich. Push-to-Talk bleibt der Standard.",
    discardButton: "Übersetzungsvorschau verwerfen",
    staleWarning:
      "Das Transkript hat sich geändert. Diese Vorschau passt möglicherweise nicht mehr — verwerfen oder auf eine neue Vorschau warten.",
    lowConfidenceWarning:
      "Diese Vorschau kann unsicher sein. Bitte sorgfältig prüfen, bevor Sie bestätigen.",
    unclearSourceWarning:
      "Die Ausgangssprache war unklar. Bitte Transkript bearbeiten, bevor Sie bestätigen.",
    errorGeneric:
      "Übersetzungsvorschau nicht verfügbar. Sie können mit Push-to-Talk und manueller Übersetzung fortfahren.",
  },

  history: {
    heading: "Gesprächsdokumentation auf diesem Gerät",
    privacyNote:
      "Phase 1: Gespräche werden nur auf diesem Gerät gespeichert — nicht auf MedScoutX-Servern. Es werden keine Audio- oder Mikrofonaufnahmen gespeichert. Dies ist Orientierungs- und Kommunikationsdokumentation, kein medizinischer Datensatz. Sie können einzelne Gespräche jederzeit löschen oder unten den gesamten Verlauf entfernen.",
    fallbackTitle: "Gespräch {{date}}",
    statusDraft: "Entwurf",
    statusActive: "Aktiv",
    statusEnded: "Abgeschlossen",
    continue: "Fortsetzen",
    review: "Ansehen",
    rename: "Umbenennen",
    clearAll: "Alle auf diesem Gerät löschen",
    clearAllConfirm:
      "Alle Dolmetscher-Gespräche auf diesem Gerät wirklich löschen? Dies kann nicht rückgängig gemacht werden.",
    renamePrompt: "Titel für dieses Gespräch",
    renameTitle: "Gespräch umbenennen",
    renameSave: "Titel speichern",
    renamed: "Titel aktualisiert.",
    deleted: "Gespräch gelöscht.",
    cleared: "Alle Gespräche gelöscht.",
    languagePair: "{{patient}} ↔ {{doctor}}",
    titleWithAppointment: "Gespräch am {{date}}",
    titleWithAppointmentPractice: "Gespräch am {{date}} · {{practice}}",
    titleWithAppointmentDoctor: "Gespräch am {{date}} · {{doctor}}",
    titleWithPractice: "Gespräch · {{practice}}",
    titleWithDoctor: "Gespräch · {{doctor}}",
    titleLanguagePair: "Übersetzung {{patient}} ↔ {{doctor}}",
    titleUnsafe:
      "Dieser Titel kann nicht verwendet werden. Bitte einen neutralen Namen ohne medizinische Bewertung oder Dringlichkeit wählen.",
    turnCount: "{{count}} dokumentierte Beiträge ({{translated}} übersetzt)",
    searchLabel: "Gespräche auf diesem Gerät durchsuchen",
    searchPlaceholder: "Titel, Praxis, Sprache …",
    searchHintLocal: "Die Suche erfolgt nur auf diesem Gerät. Es wird nichts an den Server gesendet.",
    searchResults: "{{count}} von {{total}} Gesprächen angezeigt",
    noSearchResults: "Keine Gespräche entsprechen der Suche.",
  },

  sections: {
    opening: "Gesprächsbeginn",
    patientStatements: "Patientenaussagen",
    clinicianStatements: "Hinweise des Behandlungsteams",
    closing: "Abschluss",
    middle: "Weiterer Austausch",
  },

  pdf: {
    documentTitle: "Medizin-Dolmetscher — Gesprächsdokumentation",
    documentSubtitle:
      "Zusammenfassung zur Kommunikationsunterstützung · übersetztes Gesprächsprotokoll",
    legalParagraph1:
      "Dieses Dokument unterstützt nur die Kommunikation. Es ist kein medizinischer Datensatz, kein Diagnosebericht, keine klinische Bewertung und keine Behandlungszusammenfassung.",
    legalParagraph2:
      "Es enthält keine Diagnose, keine Dringlichkeitseinschätzung und keine Behandlungsempfehlungen.",
    legalParagraph3:
      "Automatische Spracherkennung und Übersetzung können ungenau oder unvollständig sein.",
    sessionTitleLabel: "Titel des Gesprächs",
    generatedNote:
      "Lokal auf diesem Gerät erstellt · MedScoutX Medizin-Dolmetscher",
    footerPage: "Seite",
    filenamePrefix: "medscoutx-dolmetscher",
    exportLoading: "PDF wird erstellt …",
    exportSuccess: "PDF wurde auf Ihr Gerät heruntergeladen.",
    exportFailed: "PDF konnte nicht erstellt werden. Bitte erneut versuchen.",
    exportNoTurns: "Es gibt keine dokumentierten Beiträge zum Export.",
    rtlFontNotice:
      "Hinweis: Einige Schriften werden in diesem PDF ggf. erst mit erweiterter Schriftunterstützung vollständig dargestellt.",
    rtlLimitationDetail:
      "Der PDF-Export nutzt Standard-Schriften. Arabisch, Farsi, Kurdisch (Sorani) und andere RTL-Schriften können vereinfacht oder versetzt erscheinen. Nutzen Sie die Bildschirmansicht für die genaueste Lesbarkeit.",
    mixedScriptNotice:
      "Dieses Dokument enthält gemischte Schreibrichtungen. Bitte prüfen Sie Formulierungen auf dem Bildschirm, wenn etwas im PDF unklar wirkt.",
  },

  review: {
    pageTitle: "MedScoutX — Gesprächsdokumentation",
    heading: "Gesprächsdokumentation",
    notMedicalRecord:
      "Nur Orientierung und Kommunikationsdokumentation — kein medizinischer Datensatz.",
    metadataHeading: "Sitzungsdetails",
    turnsHeading: "Dokumentierte Beiträge",
    timelineHeading: "Gesprächsverlauf",
    documentationNotice:
      "Automatische Übersetzung kann ungenau sein. Bitte Medikamentennamen, Dosierungen, Allergien und andere wichtige Begriffe mit medizinischem Fachpersonal abgleichen.",
    summaryLine: "{{turns}} dokumentierte Beiträge · {{translated}} übersetzt",
    summaryDrafts: "{{count}} Entwurf/Entwürfe noch nicht übersetzt",
    summaryTurnsLabel: "Dokumentierte Beiträge",
    created: "Begonnen",
    ended: "Beendet",
    status: "Status",
    turnNumber: "Beitrag {{n}}",
    langDirection: "{{source}} → {{target}}",
    originalLabel: "Gesprochener Text",
    translatedLabel: "Übersetzung",
    simplifiedLabel: "Vereinfachte Formulierung",
    turnDraft: "Entwurf — noch nicht übersetzt",
    turnBlocked: "Übersetzung nicht verfügbar (Sicherheit)",
    turnError: "Dieser Beitrag konnte nicht abgeschlossen werden",
    backToList: "Alle Gespräche",
  },

  confirm: {
    deleteTitle: "Gespräch löschen?",
    deleteBody:
      "Das Gespräch wird nur auf diesem Gerät entfernt. Dies kann nicht rückgängig gemacht werden.",
    clearAllTitle: "Alle Gespräche löschen?",
    clearAllBody:
      "Alle Dolmetscher-Gespräche auf diesem Gerät wirklich löschen? Dies kann nicht rückgängig gemacht werden.",
    endTitle: "Gespräch beenden?",
    endBody:
      "Das Gespräch wird auf diesem Gerät als abgeschlossen markiert.",
    endWithDraftBody:
      "Es gibt gesprochenen Text, der noch nicht übersetzt wurde. Gespräch trotzdem beenden?",
    leaveTitle: "Live-Raum verlassen?",
    leaveBody:
      "Es gibt gesprochenen Text, der noch nicht bestätigt und übersetzt wurde. Sie können ihn verwerfen oder weiter bearbeiten.",
    discardDraft: "Verwerfen und verlassen",
    keepEditing: "Weiter bearbeiten",
    endAnyway: "Trotzdem beenden",
    confirmDelete: "Löschen",
    confirmClearAll: "Alle löschen",
    confirmEnd: "Gespräch beenden",
    cancel: "Abbrechen",
  },

  sessionActions: {
    heading: "Gespräch",
    end: "Gespräch beenden",
    endHint: "Gespräch als abgeschlossen markiert.",
    ended: "Gespräch beendet.",
    leave: "Raum verlassen",
    leaveConfirm:
      "Gespräch verlassen? Nicht gespeicherte Inhalte können verloren gehen.",
    delete: "Auf diesem Gerät löschen",
    deleteConfirm: "Gespräch wirklich von diesem Gerät löschen?",
    export: "PDF herunterladen",
    exportHint: "Gesprächsdokumentation als PDF auf diesem Gerät speichern.",
    exportUnavailable:
      "Mindestens ein dokumentierter Beitrag ist nötig, bevor exportiert werden kann.",
  },

  empty: {
    moduleDisabled:
      "Der Medizin-Dolmetscher ist derzeit nicht verfügbar.",
    noSession:
      "Kein Gespräch gefunden. Bitte starten Sie ein neues Gespräch.",
    noTurns:
      "Noch keine gesprochenen Beiträge. Halten Sie die Taste gedrückt, um zu beginnen.",
    historyEmpty:
      "Noch keine gespeicherten Gespräche auf diesem Gerät.",
    setupIncomplete:
      "Bitte schließen Sie die Einrichtung ab, bevor Sie den Live-Raum betreten.",
  },

  cloud: {
    heading: "Optionale Kontensicherung",
    lead:
      "Standardmäßig bleiben Gespräche nur auf diesem Gerät. Sie können optional eine verschlüsselte Kopie in Ihrem MedScoutX-Konto speichern, um sie auf einem anderen Gerät zu öffnen.",
    bulletLocalStill:
      "Der reine Geräte-Modus bleibt möglich — Kontensicherung ist nicht Pflicht.",
    bulletWhatStored:
      "Gespeichert werden können Gesprächstexte, Übersetzungen, vereinfachte Formulierungen und Metadaten (Sprachen, Titel, Terminangaben).",
    bulletNoAudio:
      "Audio und Mikrofonaufnahmen werden nie auf dem Server gespeichert.",
    bulletDeleteAnytime:
      "Sie können eine gespeicherte Kopie oder alle Kontodaten des Dolmetschers jederzeit löschen.",
    bulletNotMedicalRecord:
      "Dies ist Gesprächsdokumentation zur Orientierung — kein medizinischer Befund, keine Diagnose und kein Behandlungsplan.",
    acceptLabel:
      "Ich habe verstanden und möchte verschlüsselte Kontensicherung erlauben, wenn ich ein Gespräch dafür auswähle",
    acceptRequired: "Bitte bestätigen Sie die Kontensicherung.",
    enableAccount: "Kontensicherung aktivieren",
    accountEnabled:
      "Kontensicherung ist aktiv. Es wird nichts hochgeladen, bis Sie ein Gespräch speichern.",
    revokeConsent: "Künftige Kontensicherung beenden",
    revokeHint:
      "Stoppt neue Uploads. Vorhandene Kopien im Konto bleiben, bis Sie sie separat löschen.",
    consentGranted: "Kontensicherung aktiviert.",
    consentRevoked: "Künftige Kontensicherung beendet.",
    unavailable:
      "Kontensicherung ist hier nicht verfügbar. Gespräche bleiben nur auf diesem Gerät.",
    loading: "Kontensicherung wird geprüft …",
    setupHeading: "Kontensicherung (optional)",
    setupBody:
      "Sie können den Dolmetscher nutzen, während Gespräche nur auf diesem Gerät bleiben.",
    setupHint:
      "Kontensicherung aktivieren Sie danach in der Gesprächsliste — es wird nichts automatisch hochgeladen.",
    badgeLocal: "Nur auf diesem Gerät",
    badgeSynced: "Auch im Konto gespeichert",
    badgeStale: "Gerät neuer als Konto",
    saveToAccount: "Im Konto speichern",
    updateSavedCopy: "Gespeicherte Kopie aktualisieren",
    deleteCloudCopy: "Nur Kontokopie löschen",
    sessionLocalNote:
      "Löschen auf dem Gerät und Löschen der Kontokopie sind getrennte Schritte.",
    sessionNeedsConsent:
      "Aktivieren Sie die Kontensicherung oben, um Kopien zu speichern.",
    enableAccountFirst:
      "Bitte aktivieren Sie zuerst die Kontensicherung.",
    saveNeedsTurns:
      "Bitte mindestens einen gesprochenen Beitrag hinzufügen, bevor Sie im Konto speichern.",
    saveSuccess: "Gespräch im Konto gespeichert.",
    updateSuccess: "Kontokopie aktualisiert.",
    deleteCopySuccess: "Kontokopie gelöscht. Die Kopie auf dem Gerät bleibt.",
    deleteLocalOnlyBody:
      "Dieses Gespräch nur von diesem Gerät löschen? Eine Kontokopie wird nicht entfernt.",
    deleteCopyConfirmTitle: "Kontokopie löschen?",
    deleteCopyConfirmBody:
      "Verschlüsselte Kopie im Konto entfernen? Die Kopie auf dem Gerät bleibt.",
    deleteCopyConfirmAction: "Kontokopie löschen",
    deleteAllHeading: "Alle Kontodaten des Dolmetschers",
    deleteAllBody:
      "Alle Medical-Interpreter-Gespräche im Konto entfernen. Kopien auf diesem Gerät werden nicht gelöscht.",
    deleteAllAction: "Alle Kontodaten löschen",
    deleteAllConfirmTitle: "Alle Kontodaten löschen?",
    deleteAllConfirmBody:
      "Entfernt dauerhaft alle Dolmetscher-Gespräche im Konto. Gerätekopien bleiben unverändert.",
    deleteAllConfirmAction: "Alle Kontodaten löschen",
    deleteAllSuccess: "Alle Kontodaten gelöscht.",
    exportHeading: "Kontosicherung exportieren",
    exportBody:
      "Laden Sie eine JSON-Datei der im Konto gespeicherten Gespräche herunter. Audio ist nicht enthalten. Nur auf dem Gerät gespeicherte Gespräche sind nicht enthalten, sofern Sie sie nicht im Konto gespeichert haben.",
    exportAction: "JSON-Export herunterladen",
    exportSuccess: "Export wurde heruntergeladen.",
    dataControlHeading: "Ihre Dolmetscher-Daten",
    statusUnavailable:
      "Kontensicherung ist hier nicht verfügbar. Gespräche bleiben nur auf diesem Gerät.",
    statusSignInRequired:
      "Bitte anmelden, um die Kontensicherung für Dolmetscher-Gespräche zu verwalten.",
    statusLocalOnly:
      "Kontensicherung ist aus. Gespräche auf diesem Gerät werden nicht hochgeladen, bis Sie die Sicherung aktivieren.",
    statusAccountActive:
      "Kontensicherung ist an. {{count}} Gespräch(e) haben eine Kopie im Konto.",
    statusConsentNoSessions:
      "Kontensicherung ist an. Im Konto ist noch nichts gespeichert, bis Sie ein Gespräch speichern.",
    factLocal: "Auf diesem Gerät",
    factLocalBody: "Bleibt im Browser, bis Sie es löschen oder Website-Daten leeren.",
    factCloud: "In Ihrem Konto",
    factCloudBody: "Verschlüsselte Kopie, die Sie manuell speichern — optional, nie automatisch.",
    factAudio: "Audio",
    factAudioBody: "Wird nie auf dem Server gespeichert.",
    consentHistoryHeading: "Einwilligungsverlauf",
    historyGranted: "Sicherung aktiviert",
    historyRevoked: "Sicherung beendet",
    scopeNoUser: "Bitte anmelden, um die Kontensicherung zu nutzen.",
    scopeMismatch:
      "Ihre Anmeldung hat sich geändert. Bitte Seite aktualisieren, bevor Sie Kontodaten speichern oder löschen.",
    revokeDialogTitle: "Kontensicherung beenden?",
    revokeDialogIntro:
      "Künftige Speicherungen im Konto werden gestoppt. Wählen Sie, was mit vorhandenen Kontokopien passieren soll.",
    revokeKeepTitle: "Gespeicherte Kontokopien behalten",
    revokeKeepBody:
      "Stoppt nur neue Uploads. Kontokopien können Sie später hier löschen.",
    revokeDeleteTitle: "Sicherung beenden und alle Kontokopien löschen",
    revokeDeleteBody:
      "Entfernt {{count}} Gespräch(e) aus dem Konto. Kopien auf dem Gerät werden nicht gelöscht.",
    revokeDeleteConfirmTitle: "Alle Kontokopien löschen?",
    revokeDeleteConfirmBody:
      "Entfernt dauerhaft {{count}} Gespräch(e) aus dem Konto und beendet die Kontensicherung.",
    revokeDeleteConfirmAction: "Kontokopien löschen und Sicherung beenden",
    revokeBackToChoices: "Zurück zur Auswahl",
    consentRevokedKeepData:
      "Kontensicherung beendet. Vorhandene Kontokopien wurden behalten.",
    consentRevokedAndDeleted:
      "Kontensicherung beendet und alle Kontokopien wurden gelöscht.",
    errors: {
      generic: "Kontensicherung hat nicht geklappt. Bitte später erneut versuchen.",
      network: "Verbindungsproblem. Bitte erneut versuchen.",
      unauthorized: "Bitte melden Sie sich an, um fortzufahren.",
      rateLimited: "Zu viele Anfragen. Bitte kurz warten.",
      cloudDisabled: "Kontensicherung ist derzeit nicht verfügbar.",
      encryptionUnavailable: "Kontensicherung ist auf dem Server nicht eingerichtet.",
      consentRequired: "Einwilligung zur Kontensicherung ist erforderlich.",
      quotaExceeded: "Limit für Kontensicherung erreicht.",
      sessionNotFound: "Gespeicherte Kopie im Konto nicht gefunden.",
      validationRejected:
        "Dieses Gespräch konnte in der aktuellen Form nicht gespeichert werden.",
    },
  },

  reliability: {
    offlineBanner:
      "Sie scheinen offline zu sein. Spracheingabe und Übersetzung sind pausiert, bis die Verbindung wieder da ist.",
    reconnectedBanner: "Verbindung wiederhergestellt. Sie können fortfahren, wenn Sie bereit sind.",
    recoveryBody:
      "Der letzte Schritt konnte nicht abgeschlossen werden. Ihr Text ist noch da — Sie können es erneut versuchen.",
    retryAction: "Erneut versuchen",
    dismissRecovery: "Schließen",
    errorBoundaryBody:
      "In der Dolmetscher-Ansicht ist etwas schiefgelaufen. Andere Bereiche der App sind davon nicht betroffen.",
    errorBoundaryBack: "Zurück zur Dolmetscher-Startseite",
  },

  errors: {
    moduleDisabled: "Dieses Modul ist derzeit nicht verfügbar.",
    sessionNotFound:
      "Gespräch nicht gefunden. Bitte starten Sie ein neues Gespräch.",
    transcribeFailed:
      "Spracherkennung fehlgeschlagen. Bitte erneut versuchen.",
    translateFailed: "Übersetzung fehlgeschlagen. Bitte erneut versuchen.",
    simplifyFailed:
      "Vereinfachung fehlgeschlagen. Bitte erneut versuchen.",
    speakFailed: "Wiedergabe fehlgeschlagen. Bitte erneut versuchen.",
    ttsDisabled: "Wiedergabe ist derzeit nicht verfügbar.",
    rateLimited: "Zu viele Anfragen. Bitte kurz warten.",
    network: "Verbindungsproblem. Bitte erneut versuchen.",
    offline:
      "Sie scheinen offline zu sein. Bitte prüfen Sie die Verbindung und versuchen Sie es erneut.",
    transcribeTimeout:
      "Die Spracherkennung hat zu lange gedauert. Bitte eine kürzere Aufnahme versuchen.",
    requestTimeout: "Dieser Schritt hat zu lange gedauert. Bitte erneut versuchen.",
    speakUnsupported: "Audio-Wiedergabe wird in diesem Browser nicht unterstützt.",
    textTooLong: "Text ist zu lang. Bitte kürzen.",
    unauthorized: "Bitte melden Sie sich an, um fortzufahren.",
    generic: "Das hat nicht geklappt. Bitte später erneut versuchen.",
  },

  invite: {
    pageTitle: "MedScoutX — Praxiseinladung",
    heading: "Medizin-Dolmetscher beim Besuch",
    loading: "Einladungslink wird geprüft …",
    statusAriaPrefix: "Status der Einladung:",
    statusActive: "Einladungslink ist gültig",
    statusExpired: "Einladungslink ist abgelaufen",
    statusRevoked: "Einladungslink ist nicht mehr verfügbar",
    statusInvalid: "Einladungslink ist ungültig",
    statusUnavailable: "Einladungsprüfung ist nicht verfügbar",
    networkError:
      "Die Einladung konnte nicht geprüft werden. Bitte Verbindung prüfen und erneut versuchen.",
    moduleDisabled: "Der Medizin-Dolmetscher ist derzeit nicht verfügbar.",
    practiceLabel: "Praxis",
    communicationNotice:
      "Nur Kommunikationshilfe — keine Diagnose, Triage oder Behandlungsempfehlung.",
    noticeNoDiagnosis: "Keine medizinische Diagnose",
    noticeNoTriage: "Keine Dringlichkeits- oder Triage-Einschätzung",
    noticeNoTreatment: "Keine Behandlungs- oder Medikamentenempfehlungen",
    consentHeading: "Ihr Gespräch bleibt privat",
    consentNoAutoShare:
      "Dieser Praxislink teilt Ihr Gespräch nicht automatisch mit der Praxis.",
    consentExplicitStep:
      "Nach dem Gespräch können Sie separat entscheiden, ob Sie die Gesprächsdokumentation mit der Praxis teilen.",
    consentPatientControl:
      "Sie behalten die Kontrolle über Freigaben und können den Zugriff widerrufen.",
    languagesHeading: "Als Nächstes Sprachen wählen",
    languagesIntro:
      "Auf der nächsten Seite wählen Sie Ihre Sprache und die Sprache des Behandlungsteams, bevor das Gespräch startet.",
    continueLoggedIn: "Sprachen wählen und fortfahren",
    authRequired:
      "Bitte melden Sie sich an, um den Dolmetscher mit diesem Praxislink zu nutzen.",
    guestUnsupported:
      "Nutzung ohne Konto wird für den Dolmetscher noch nicht unterstützt (Repo-Verifikation ausstehend). Bitte anmelden oder Konto erstellen.",
    loginToContinue: "Anmelden und fortfahren",
    createAccount: "Konto erstellen",
    setupBannerTitle: "Praxislink",
    setupBannerBody:
      "Sie sind über eine Einladung für {practice} gestartet. Mit der Praxis wird nichts geteilt, bis Sie später ausdrücklich zustimmen.",
    setupPracticePrefill: "Praxisname aus Einladung (anpassbar)",
  },

  practiceShare: {
    heading: "Mit Praxis teilen (optional)",
    communicationNotice:
      "Nur Kommunikationshilfe — kein medizinischer Befund oder klinische Bewertung.",
    intro:
      "Sie können eine Kopie dieser Gesprächsdokumentation mit {practice} teilen. Audio wird nie geteilt.",
    noticeNoAudio: "Audioaufnahmen werden nicht mit der Praxis geteilt.",
    noticeDocumentation:
      "Es kann nur schriftliche Gesprächsdokumentation (Original- und Übersetzungstext) geteilt werden.",
    noticeRevoke: "Sie können den Praxiszugriff später widerrufen.",
    noticeNotMedicalRecord: "Dies ist keine Patientenakte.",
    consentLabel:
      "Ich willige ein, diese Gesprächsdokumentation mit der genannten Praxis zu teilen.",
    grantButton: "Dokumentation mit Praxis teilen",
    granting: "Wird geteilt…",
    grantSuccess:
      "Praxiszugriff erteilt. Sie können ihn in den Dolmetscher-Einstellungen widerrufen.",
    grantError: "Freigabe an die Praxis ist fehlgeschlagen. Bitte später erneut versuchen.",
    tokenMissing:
      "Öffnen Sie den Praxis-Einladungslink erneut, um die Freigabe von diesem Gerät zu ermöglichen.",
  },

  aria: {
    hubCard: "Medizin-Dolmetscher im Patientenbereich",
    startInterpreter: "Medizin-Dolmetscher starten",
    wizardProgress: "Fortschritt der Einrichtung",
    languagePatient: "Ihre Sprache auswählen",
    languageDoctor: "Sprache des Behandlungsteams auswählen",
    profileConsent: "Profildaten für dieses Gespräch verwenden",
    privacyAccept: "Hinweise gelesen und verstanden",
    privacyStorage: "Gespräch auf diesem Gerät speichern",
    liveRegion: "Aktuelle Übersetzung und Status",
    transcriptEditor: "Gesprochenen Text bearbeiten",
    translationRegion: "Übersetzungsbereich",
    speakerRole: "Wer spricht gerade",
    startRecording: "Spracheingabe starten",
    stopRecording: "Spracheingabe beenden",
    preparingMic: "Mikrofon wird vorbereitet",
    stoppingRecording: "Aufnahme wird beendet",
    replayTranslation: "Übersetzung anhören",
    replaySimplified: "Vereinfachten Text anhören",
    confirmTranscript: "Text bestätigen und übersetzen",
    simplifyLanguage: "Sprache der Übersetzung vereinfachen",
    simplifiedRegion: "Vereinfachte Formulierung",
    hideSimplified: "Vereinfachte Formulierung ausblenden",
    deleteSession: "Gespräch auf diesem Gerät löschen",
    exportConversation: "Gespräch exportieren",
    endSession: "Gespräch beenden",
    leaveRoom: "Live-Raum verlassen",
    turnList: "Verlauf der Gesprächsbeiträge",
    historyList: "Gespeicherte Gespräche auf diesem Gerät",
    reviewMetadata: "Gesprächsdetails",
    renameSession: "Gespräch umbenennen",
    clearAllHistory: "Gesamten Dolmetscher-Verlauf löschen",
    deleteAllCloudData: "Alle Kontodaten des Dolmetschers löschen",
    exportCloudData: "JSON-Export der Kontosicherung herunterladen",
    searchHistory: "Gespeicherte Gespräche durchsuchen",
    languageSearch: "Gesprächssprachen filtern",
  },
};
