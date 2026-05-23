export default {
  language: {
    pageTitle: "MedScoutX — Arztgespräch vorbereiten",
    eyebrow: "Pre-Visit",
    title: "Arztgespräch vorbereiten",
    explanation:
      "Dieses System hilft Ihnen dabei, Ihre Beschwerden und Fragen strukturiert für einen Arzttermin vorzubereiten. Es werden keine Diagnosen oder medizinischen Empfehlungen erstellt.",
    trust: "Alle Angaben beruhen ausschließlich auf Ihren eigenen Aussagen.",
    valueProp:
      "Bereiten Sie Beschwerden, Medikamente, Dokumente und Fragen strukturiert vor – in Ihrer Sprache.",
    languageLabel:
      "Sprache, in der Sie mit MedScoutX antworten möchten",
    languageHint:
      "Sie können Ihre Angaben in der Sprache machen, in der Sie sich am sichersten ausdrücken können.",
    continue: "Weiter",
  },
  qrLanding: {
    pageTitle: "MedScoutX — QR-Praxis-Kontext",
    title: "Praxis-Kontext bestätigen",
    loading: "QR-Kontext wird geladen …",
    invalid: "Dieser QR-Link ist ungültig oder nicht mehr verfügbar.",
    inactive: "Dieses QR-Ziel ist derzeit nicht aktiv.",
    cta: "Arztgespräch für diese Praxis vorbereiten",
  },
  chrome: {
    backHome: "Zurück zur MedScoutX-Startseite",
    backPatientHub: "Zurück zum Patientenbereich",
    moduleLabel: "Arztgespräch vorbereiten",
    safety:
      "Dieses Modul dient nur der Vorbereitung und Dokumentation Ihrer Angaben. Es ersetzt keine ärztliche Beratung.",
    navAria: "Pre-Visit-Navigation",
  },
  chat: {
    pageTitle: "MedScoutX — Arztgespräch vorbereiten",
    progressTemplate: "Schritt {{current}} von {{total}}",
    answerPlaceholder: "Ihre Angaben …",
    next: "Weiter",
    back: "Zurück",
    changeLanguage: "Sprache der Angaben ändern",
    sectionLabelQuestion: "Frage",
    sectionLabelAnswer: "Ihre Antwort",
    devInsertDemo: "Demo-Angaben einfügen",
    devOnlyNote: "Nur für lokale Entwicklung sichtbar.",
    adaptiveSeedHint:
      "Beschreiben Sie diesen Punkt bitte in eigenen Worten, möglichst konkret und neutral.",
    adaptiveFollowupLabel: "Nachfrage zur Vorbereitung",
    adaptiveSeedRequired: "Bitte geben Sie kurz in eigenen Worten an, worum es geht.",
    adaptiveAnswerRequired: "Bitte beantworten Sie die Nachfrage kurz.",
    adaptiveBusy: "Einen Moment …",
    adaptiveProgressMeta:
      "Nachfragen für diese Angabe: {{n}} von maximal {{max}}",
    adaptiveSkip: "Überspringen",
    adaptiveServiceError:
      "Die adaptive Frage konnte gerade nicht erstellt werden. Sie können fortfahren oder später bearbeiten.",
    audioHint:
      "Sie können die Frage vorlesen lassen oder Ihre Antwort diktieren.",
    audioPrivacy:
      "Für Vorlesen und Spracheingabe werden Text bzw. Audio zur Verarbeitung an den KI-Dienst übertragen. Es wird hierbei nichts dauerhaft gespeichert.",
    audioMicUnsupported:
      "Audioaufnahme wird von diesem Browser nicht unterstützt.",
    audioListenAria: "Frage vorlesen lassen",
    audioListenTitle: "Frage und Kurzhinweis vorlesen lassen",
    audioDictateAria: "Antwort diktieren",
    audioDictateTitle: "Aufnahme starten und erneut tippen zum Beenden",
    audioStatusLoading: "Audio wird vorbereitet …",
    audioStatusPlaying: "Wiedergabe …",
    audioStatusRecording: "Aufnahme … zum Beenden erneut tippen.",
    audioStatusTranscribing: "Sprache wird in Text umgewandelt …",
    audioErrorGeneric:
      "Die Sprachfunktion ist gerade nicht verfügbar. Bitte versuchen Sie es später erneut.",
    audioErrorPlayback: "Die Wiedergabe konnte nicht gestartet werden.",
    audioMicPermission:
      "Mikrofonzugriff wurde verweigert oder ist nicht verfügbar.",
    longitudinalCaseBanner:
      "Optional: Es ist ein Verlauf (Fall) verknüpft. Die Aufnahme nutzt nur Ihre eigenen früheren Angaben — ohne medizinische Bewertung.",
  },
  review: {
    pageTitle: "MedScoutX — Übersicht",
    title: "Übersicht Ihrer Angaben",
    intro:
      "So werden Ihre Einträge später für die ärztliche Vorbereitung verwendet. Sie können noch Anpassungen vornehmen.",
    empty: "nicht angegeben",
    edit: "Bearbeiten",
    clearField: "Angabe löschen",
    trustBeforeActions:
      "Sie können Ihre Angaben vor dem Erstellen des Dokuments jederzeit prüfen, bearbeiten oder löschen.",
    newSession: "Neue Sitzung starten",
    wipeSession: "Sitzung vollständig löschen",
    prepareDocument: "Dokument vorbereiten",
  },
  document: {
    pageTitle: "MedScoutX — Dokument",
    title: "Dokument für den Arzt vorbereiten",
    explanation:
      "Wählen Sie die Sprache, in der die strukturierte Arztversion erstellt werden soll.",
    doctorLangLabel: "Sprache für die Arztversion",
    doctorLangHint:
      "Wählen Sie die Sprache, in der der Arzt oder die Praxis das Dokument lesen soll.",
    practiceContextTitle: "Ausgewählter Praxis-Kontext",
    practiceContextPractice: "Praxis",
    practiceContextTarget: "Ziel",
    practiceContextDoctor: "Ärztin/Arzt",
    practiceContextSpecialty: "Fachrichtung",
    patientMetaSection: "Optionale Patientendaten",
    patientMetaNote:
      "Diese Angaben sind freiwillig und helfen der Praxis, das Dokument zuzuordnen.",
    patientNameLabel: "Name",
    patientEmailLabel: "E-Mail",
    patientDateOfBirthLabel: "Geburtsdatum",
    patientGenderOrSalutationLabel: "Geschlecht / Anrede",
    patientPhoneLabel: "Telefon (optional)",
    timelineSection: "Verlauf / Fallbezug",
    timelineHint:
      "Optional: Verknüpfen Sie diese Vorbereitung mit einem früheren ähnlichen Fall, um Änderungen nur auf Basis Ihrer Angaben zu vergleichen.",
    timelineTopicLabel: "Thema / Fallbezeichnung (optional)",
    timelineTopicPlaceholder: "z. B. wiederkehrende Beschwerden seit Frühjahr",
    timelineSelectLabel: "Frühere Vorbereitung auswählen",
    timelineSelectNone: "Keine frühere Vorbereitung ausgewählt",
    timelineUntitled: "Ohne Titel",
    timelineCompare: "Verlauf vergleichen",
    timelineComparing: "Vergleich läuft …",
    timelineResultTitle: "Faktischer Verlauf (ohne medizinische Bewertung)",
    timelineNewlyMentioned: "Neu erwähnt",
    timelineStillMentioned: "Weiterhin erwähnt",
    timelineNoLongerMentioned: "Nicht mehr erwähnt",
    timelineUnclear: "Unklar",
    timelinePatientAddedNewInformation: "Neue Angaben / ergänzte Information",
    timelinePatientDidNotMentionPrior:
      "Zuvor genannte Informationen in dieser Sitzung nicht erwähnt",
    timelineIncludePdf:
      "Ich möchte diese Verlaufszusammenfassung im Arzt-PDF aufnehmen.",
    timelineLoadError:
      "Frühere Vorbereitungen konnten nicht geladen werden.",
    timelineSummaryError:
      "Die Verlaufszusammenfassung konnte gerade nicht erstellt werden.",
    timelineSelectCaseFirst:
      "Bitte wählen Sie zuerst eine frühere Vorbereitung aus.",
    sectionStructured: "Strukturierte Arztversion",
    sectionOriginal: "Originalangaben des Patienten",
    disclaimer:
      "Die Arztversion basiert ausschließlich auf den Angaben des Patienten. Es werden keine Diagnosen, Empfehlungen oder Dringlichkeitseinschätzungen erstellt.",
    empty: "nicht angegeben",
    backReview: "Zurück zur Prüfung",
    pdfDisabled: "PDF erstellen",
    pdfLocalNote:
      "Die PDF-Datei wird lokal in Ihrem Browser erstellt. Es werden keine Daten übertragen.",
    qrShareButton: "QR-Code (Teilen ohne E-Mail)",
    qrShareTitle: "Teilen ohne E-Mail",
    qrShareIntro:
      "Dieser QR-Code enthält nur einen kurzen Hinweis und einen Link zu MedScoutX. Ihre Einträge und medizinischen Angaben sind nicht enthalten. Eine Person in der Nähe kann den Code von Ihrem Bildschirm scannen.",
    qrSharePayloadNote:
      "Mit MedScoutX vorbereitet — die PDF-Datei wurde auf diesem Gerät gespeichert.",
    qrShareClose: "Schließen",
    qrShareGenerateError:
      "Der QR-Code konnte nicht erstellt werden. Bitte versuchen Sie es erneut.",
    consentCheckbox:
      "Ich möchte diese Sitzung lokal im Browser speichern, um sie später erneut ansehen zu können.",
    consentExpl:
      "Die Speicherung erfolgt nur lokal in diesem Browser. Es werden keine Daten an MedScoutX übertragen.",
    saveLocal: "Sitzung lokal speichern",
    saveSuccess: "Die Sitzung wurde lokal gespeichert.",
    archiveNote:
      "Sie können gespeicherte Sitzungen später löschen. Diese Funktion ersetzt keine Patientenakte.",
    historyLink: "Gespeicherte Sitzungen anzeigen",
    consentSectionTitle: "Optionale lokale Kopie",
    createDoctorVersion: "Arztversion erstellen",
    creatingDoctorVersion: "Arztversion wird erstellt …",
    aiError:
      "Die Arztversion konnte gerade nicht erstellt werden. Sie können weiterhin die lokale PDF-Vorschau verwenden.",
    aiSuccessStatus:
      "Die Arztversion wurde auf Basis Ihrer Angaben erstellt.",
    accountSectionTitle: "In meinem Konto speichern",
    accountConsentCheckbox:
      "Ich möchte diese Vorbereitung in meinem MedScoutX-Konto speichern.",
    accountConsentExpl:
      "Diese Speicherung ist optional. Sie können gespeicherte Vorbereitungen später ansehen oder löschen.",
    saveToAccount: "Im Konto speichern",
    accountLoginHint:
      "Melden Sie sich an, um Vorbereitungen in Ihrem Konto zu speichern.",
    accountLoginLink: "Zum Login",
    accountSaveSuccess:
      "Die Vorbereitung wurde in Ihrem Konto gespeichert.",
    accountSaveError:
      "Die Vorbereitung konnte gerade nicht gespeichert werden.",
    sessionTitleDe: "Arztgespräch-Vorbereitung",
    sessionTitleEn: "Doctor visit preparation",
    viewMyPreparations: "Meine Vorbereitungen anzeigen",
    mainNavAria:
      "Arztversion, PDF-Export, Rückkehr zur Prüfung",
    doctorRecipientSection: "Empfänger (Ärztebuch)",
    doctorRecipientFieldLabel: "Kontakt auswählen",
    doctorRecipientHint:
      "Optional: Wählen Sie einen Kontakt aus Ihrem Ärztebuch für die geplante Übergabe.",
    doctorRecipientNone: "Kein Arzt ausgewählt",
    doctorRecipientManage: "Ärztebuch verwalten",
    longitudinalPdfSection: "Fall / Verlauf im PDF (optional)",
    longitudinalPdfNote:
      "Nur mit Ihrer ausdrücklichen Auswahl. Keine Diagnose, keine medizinische Bewertung. Sie können Verläufe und Einträge jederzeit löschen.",
    longitudinalPdfCaseTitle: "Falltitel im PDF",
    longitudinalPdfContinuity: "Kontinuitätszusammenfassung (nur Patientenangaben)",
    longitudinalPdfSessionsOverview: "Überblick früherer Vorbereitungen (Datum & Anlass)",
    longitudinalPdfRelatedReports:
      "Frühere zugeordnete Berichte (aus Verlaufsvergleich, falls vorhanden)",
    longitudinalLoadOverview: "Überblick aus dem Fall laden",
    longitudinalLoadOverviewBusy: "Lädt …",
    longitudinalLoadOverviewError: "Der Überblick konnte nicht geladen werden.",
    longitudinalPdfCompareHint:
      "Um den Vergleich im PDF verwenden zu können, erzeugen Sie oben unter „Zeitlicher Verlauf“ zuerst eine faktuelle Gegenüberstellung.",
    linkMyCases: "Meine Verläufe",
    doctorRecipientLoading: "Kontakte werden geladen …",
    doctorRecipientEmailMissing:
      "Für diesen Kontakt ist keine E-Mail-Adresse hinterlegt.",
    emailPdfSection: "PDF per E-Mail senden",
    emailPdfPrivacy:
      "Wenn Sie das PDF senden, wird die Datei über MedScoutX an die im Ärztebuch gespeicherte E-Mail-Adresse übermittelt. Es erfolgt kein automatischer Versand; Sie lösen den Versand selbst aus. Der Inhalt entspricht nur Ihren eigenen Angaben und stellt keine Diagnose oder Therapieempfehlung dar.",
    emailPdfConsent:
      "Ich bestätige, dass dieses Dokument persönliche Gesundheitsangaben enthalten kann und an die ausgewählte Praxis/den ausgewählten Arzt gesendet werden darf.",
    emailPdfSend: "PDF jetzt senden",
    emailPdfSending: "Wird gesendet …",
    emailPdfSuccess:
      "Das PDF wurde zur Zustellung eingereiht. Bitte prüfen Sie bei Bedarf Ihr Postfach auf eine Sendebestätigung.",
    emailPdfError:
      "Der Versand ist gerade nicht möglich. Bitte versuchen Sie es später erneut oder nutzen Sie „PDF erstellen“.",
    emailPdfRequiresDoctor:
      "Bitte wählen Sie einen Kontakt mit gültiger E-Mail-Adresse oder belassen Sie „Kein Arzt ausgewählt“.",
    emailPdfRequiresConsent:
      "Bitte bestätigen Sie zuerst den Hinweis und die Einwilligung zum Versand.",
    emailPdfNoPdf:
      "Das PDF konnte nicht erstellt werden. Versuchen Sie es erneut.",
    structuredRowLabels: {
      appointmentReason: "Aktueller Anlass",
      symptomsOwnWords: "Beschwerden in eigenen Worten",
      onsetAndCourse: "Beginn und Verlauf",
      medications: "Medikamente",
      preExistingConditions: "Bekannte Vorerkrankungen",
      relevantDocuments: "Relevante Dokumente",
      patientQuestions: "Fragen an den Arzt",
    },
    assistantQuestions: {
      sectionTitle: "Orientierungsfragen für das Gespräch",
      intro:
        "Auf Basis Ihrer Angaben zu Beschwerden, Verlauf und Vorbereitung schlägt die KI einige strukturierende Fragen vor — formuliert wie eine medizinische Assistenz, ohne medizinische Bewertung.",
      noAiAnswersNote:
        "Es werden nur Fragen vorgeschlagen. Antworten geben Sie selbst in eigenen Worten; der Arzt liest diese im PDF.",
      generateButton: "Orientierungsfragen erstellen",
      generating: "Fragen werden vorbereitet …",
      successStatus:
        "Die Orientierungsfragen wurden auf Basis Ihrer Angaben erstellt.",
      error:
        "Die Orientierungsfragen konnten gerade nicht erstellt werden. Sie können fortfahren oder es später erneut versuchen.",
      staleHint:
        "Ihre Angaben haben sich geändert. Erstellen Sie die Fragen erneut, damit sie zum aktuellen Stand passen.",
      emptyState:
        "Noch keine Orientierungsfragen. Erstellen Sie sie optional, um sich auf das Gespräch vorzubereiten.",
      questionCounter: "Frage {{current}} von {{total}}",
      doctorVersionLabel: "Formulierung für den Arzt",
      answerLabel: "Ihre Antwort (für den Arzt)",
      answerPlaceholder:
        "Ihre Antwort in eigenen Worten — nur von Ihnen, nicht von der KI …",
      previewSectionTitle: "Orientierungsfragen mit Ihren Antworten",
      pdfSectionHeading: "Orientierungsfragen (Patientenantworten)",
      pdfPatientQuestionLabel: "Frage (Patient)",
      pdfDoctorQuestionLabel: "Frage (Arzt)",
      pdfPatientAnswerLabel: "Patientenantwort",
    },
  },
  pdf: {
    legalNotice:
      "Dieses Dokument basiert ausschließlich auf Angaben des Patienten. Es enthält keine Diagnose, keine Therapieempfehlung und keine Dringlichkeitseinschätzung.",
    pdfDocumentTitle: "Dokument zur Arztgespräch-Vorbereitung",
    footerGeneratedNote: "Lokal erstellt mit MedScoutX Pre-Visit",
    footerPageLabel: "Seite",
    part1Heading: "Strukturierte Arztversion",
    part2Heading: "Originalangaben des Patienten",
    previousReportsHeading: "Frühere zugeordnete Berichte (Zusammenfassung)",
    newlyMentionedLabel: "Neu erwähnt",
    stillMentionedLabel: "Weiterhin erwähnt",
    noLongerMentionedLabel: "Nicht mehr erwähnt",
    unclearLabel: "Unklar",
    patientAddedNewInformationLabel: "Neue Patienteninformation / Ergänzung",
    patientDidNotMentionPreviouslyLabel:
      "Früher berichtete Angaben in dieser Session nicht erwähnt",
    longitudinalSectionHeading: "Fall / Verlauf (optional)",
    longitudinalSectionNote:
      "Wurde nur aufgrund Ihrer Auswahl eingefügt. Nur Patientenangaben; keine Diagnose oder medizinische Bewertung.",
    longitudinalCaseTitlePdfLabel: "Falltitel",
    continuityRecurringSymptomsLabel:
      "Mehrfach genannte Symptome oder Beschwerden",
    continuityRecurringMedicationsLabel: "Mehrfach genannte Medikamente",
    continuityRecurringQuestionsLabel: "Mehrfach gestellte Patientenfragen",
    continuityRecurringConcernsLabel: "Mehrfach genannte Sorgen",
    longitudinalSessionsOverviewHeading:
      "Frühere Vorbereitungen (Überblick)",
    longitudinalRelatedReportsHeading:
      "Vergleich der Vorbereitungen (Patientenformulierung)",
    longitudinalContinuitySubheading:
      "Kontinuitätszusammenfassung (nur Patientenangaben)",
    followUpHeading: "Dokumentierte Rückfragen",
    assistantQuestionsHeading: "Orientierungsfragen (Patientenantworten)",
    assistantQuestionPatientLabel: "Frage (Patient)",
    assistantQuestionDoctorLabel: "Frage (Arzt)",
    assistantAnswerPatientLabel: "Patientenantwort",
    followUpSenderPractice: "Praxis",
    followUpSenderPatient: "Patient",
    followUpSenderSystem: "System",
    patientLanguageLabel: "Sprache der Patientenantworten",
    doctorLanguageLabel: "Sprache der Arztversion",
    patientLabel: "Patient",
    contactLabel: "Kontakt",
    patientNameLabel: "Name",
    patientEmailLabel: "E-Mail",
    patientDateOfBirthLabel: "Geburtsdatum",
    patientGenderOrSalutationLabel: "Geschlecht / Anrede",
    patientPhoneLabel: "Telefon",
    practiceLabel: "Praxis",
    targetLabel: "Ziel",
    doctorLabel: "Ärztin/Arzt",
    specialtyLabel: "Fachrichtung",
    documentCreatedLabel: "Erstellt",
    empty: "nicht angegeben",
    pdfFilename: "medscoutx-arztgespraech.pdf",
    pdfBrandPracticeLine: "Praxisdokument",
  },
  cases: {
    pageTitle: "MedScoutX — Meine Verläufe",
    title: "Meine Verläufe",
    intro:
      "Gruppieren Sie mehrere Vorbereitungen zu einem Thema über die Zeit. Nur Sie steuern Inhalt und Löschung.",
    safetyNote:
      "Keine Diagnose, keine Dringlichkeit, keine Therapieempfehlung. Es werden nur Ihre eigenen Texte verglichen und geordnet.",
    searchPlaceholder: "Suchen …",
    showArchived: "Archivierte anzeigen",
    createCase: "Neuen Fall anlegen",
    fieldTitle: "Titel",
    fieldCategory: "Kategorie (optional)",
    fieldDescription: "Beschreibung (optional)",
    save: "Speichern",
    cancel: "Abbrechen",
    loading: "Wird geladen …",
    loadError: "Die Verläufe konnten nicht geladen werden.",
    saveError: "Der Fall konnte nicht gespeichert werden.",
    empty: "Noch keine Fälle angelegt.",
    sessionCount: "Vorbereitungen",
    loginHint: "Bitte melden Sie sich an, um Verläufe zu verwalten.",
    loginCta: "Zum Login",
    linkPreparations: "Zu meinen Vorbereitungen",
    backHome: "Zur Startseite",
    backPracticeHub: "Zurück zu Meine Praxis",
  },
  caseDetail: {
    pageTitle: "MedScoutX — Fall",
    backToList: "Alle Verläufe",
    backPracticeHub: "Zurück zu Meine Praxis",
    notFound: "Dieser Fall wurde nicht gefunden oder ist nicht mehr verfügbar.",
    unnamedSession: "Vorbereitung ohne Titel",
    loading: "Wird geladen …",
    loadError: "Der Fall konnte nicht geladen werden.",
    saveError: "Die Änderungen konnten nicht gespeichert werden.",
    deleteError: "Der Fall konnte nicht gelöscht werden.",
    loginHint: "Bitte anmelden.",
    loginCta: "Zum Login",
    safetyNote:
      "Sie behalten die Kontrolle: Verlauf und Einträge sind freiwillig und jederzeit löschbar. Keine medizinische Bewertung.",
    archived: "Archiviert",
    fieldTitle: "Titel",
    fieldCategory: "Kategorie",
    fieldDescription: "Beschreibung",
    saveMeta: "Metadaten speichern",
    archive: "Fall archivieren",
    unarchive: "Archivierung aufheben",
    deleteCase: "Gesamten Fall löschen",
    confirmDeleteCase:
      "Diesen Fall löschen? Zugeordnete Vorbereitungen bleiben im Konto, werden aber von diesem Fall getrennt.",
    followUp: "Folge-Vorbereitung starten",
    followUpError: "Die Folge-Vorbereitung konnte nicht gestartet werden.",
    attachSession: "Vorbereitung zuordnen",
    selectSession: "Vorbereitung wählen …",
    attachConfirm: "Zuordnen",
    attachError: "Zuordnung fehlgeschlagen.",
    unlinkError: "Entfernen der Zuordnung fehlgeschlagen.",
    timeline: "Zeitleiste",
    emptyTimeline: "Noch keine Vorbereitungen in diesem Fall.",
    reopen: "Öffnen / bearbeiten",
    clearPdf: "PDF-Status zurücksetzen",
    pdfClearError: "PDF-Status konnte nicht aktualisiert werden.",
    unlink: "Aus Fall entfernen",
    deleteSession: "Vorbereitung löschen",
    confirmDeleteSession: "Diese gespeicherte Vorbereitung unwiderruflich löschen?",
    deleteSessionError: "Löschen fehlgeschlagen.",
    pdfReady: "PDF markiert",
    reopenError: "Öffnen fehlgeschlagen.",
    compareTitle: "Zwei Vorbereitungen vergleichen",
    compareHint:
      "Nur sachliche Unterschiede in Ihren Angaben — ohne medizinische Bewertung.",
    sessionA: "Erste Vorbereitung",
    sessionB: "Zweite Vorbereitung",
    compareRun: "Vergleich erstellen",
    comparing: "Vergleich läuft …",
    compareError: "Vergleich war nicht möglich.",
    pickTwoSessions: "Bitte zwei verschiedene Vorbereitungen wählen.",
    diffNew: "Neu erwähnt",
    diffStill: "Weiterhin erwähnt",
    diffGone: "Nicht mehr erwähnt",
    diffUnclear: "Unklar",
    diffAddedInfo: "Neue / ergänzte Patienteninformation",
    diffOmittedPrior: "Zuvor berichtete Information in dieser Sitzung nicht erwähnt",
    continuityTitle: "Kontinuitätszusammenfassung",
    continuityHint:
      "Wiederkehrende Themen nur aus Ihren Texten — keine Deutung, keine Bewertung.",
    continuityGenerate: "Zusammenfassung erstellen",
    continuityBusy: "Wird erstellt …",
    continuityError: "Die Zusammenfassung war nicht möglich.",
    continuitySymptoms: "Wiederkehrend genannte Beschwerden / Symptome",
    continuityMeds: "Wiederkehrend genannte Medikamente",
    continuityQuestions: "Wiederkehrende Patientenfragen",
    continuityConcerns: "Wiederkehrende Sorgen / Anliegen",
    continuityToPrep: "In neue Vorbereitung übernehmen",
  },
  localHistory: {
    pageTitle: "Gespeicherte Sitzungen — Pre-Visit — MedScoutX",
    title: "Lokal gespeicherte Sitzungen",
    expl:
      "Diese Sitzungen sind nur in diesem Browser gespeichert. Sie wurden nicht an MedScoutX übertragen.",
    privacyNote:
      "Lokal gespeicherte Sitzungen bleiben nur auf diesem Gerät und in diesem Browser.",
    empty: "Es sind keine lokal gespeicherten Sitzungen vorhanden.",
    patientLang: "Patientensprache",
    doctorLang: "Arztsprache",
    savedAt: "Gespeichert",
    view: "Ansehen",
    delete: "Löschen",
    clearAll: "Alle gespeicherten Sitzungen löschen",
    clearConfirm:
      "Alle lokal gespeicherten Sitzungen unwiderruflich löschen?",
    listAriaLabel: "Gespeicherte Sitzungen",
  },
  followUps: {
    pageTitle: "MedScoutX — Rückfragen",
    loading: "Wird geladen …",
    title: "Rückfragen",
    intro:
      "Klärungsnachrichten Ihrer Praxis zu Ihrer gespeicherten Vorbereitung.",
    safetyNote:
      "Diese Rückfragen dienen nur der Klärung Ihrer Angaben vor dem Arztgespräch. Bei akuten Beschwerden wenden Sie sich bitte direkt an medizinisches Personal oder den Notruf.",
    empty: "Noch keine Rückfragen vorhanden.",
    loadError: "Rückfragen konnten nicht geladen werden.",
    open: "Thread öffnen",
    statusLabel: "Status",
    practiceLabel: "Praxis",
    targetLabel: "Ärztin/Arzt / Ziel",
    relatedPreparation: "Zugehörige Vorbereitung",
    createdAt: "Erstellt",
    waitingForPatient: "Warten auf Patient",
    answered: "Beantwortet",
    closed: "Abgeschlossen",
    archived: "Archiviert",
    openStatus: "Offen",
    threadBack: "Zurück zur Rückfragen-Liste",
    threadSend: "Antwort senden",
    threadPlaceholder: "Antwort schreiben",
    threadLoadError: "Thread konnte nicht geladen werden.",
    threadSendError: "Antwort konnte nicht gesendet werden.",
    threadEmpty: "Noch keine Nachrichten.",
    senderPractice: "Praxis",
    senderPatient: "Sie",
    senderSystem: "System",
  },
  accountHistory: {
    pageTitle: "MedScoutX — Meine Vorbereitungen",
    title: "Meine Vorbereitungen",
    subtitle:
      "Hier sehen Sie die Vorbereitungen, die Sie ausdrücklich in Ihrem MedScoutX-Konto gespeichert haben.",
    loginHint:
      "Melden Sie sich an, um gespeicherte Vorbereitungen zu sehen.",
    loginCta: "Zum Login",
    loading: "Wird geladen …",
    loadError:
      "Die Liste konnte gerade nicht geladen werden. Bitte versuchen Sie es später erneut.",
    empty:
      "Es sind noch keine Vorbereitungen in Ihrem Konto gespeichert.",
    startNewPrep: "Neue Vorbereitung starten",
    retryLoad: "Erneut laden",
    listAriaLabel: "Gespeicherte Vorbereitungen",
    patientLang: "Patientensprache",
    doctorLang: "Arztsprache",
    created: "Erstellt",
    statusLabel: "Status",
    open: "Öffnen",
    deleteOne: "Löschen",
    deleteAll: "Alle Vorbereitungen löschen",
    confirmDeleteAll:
      "Möchten Sie wirklich alle in Ihrem Konto gespeicherten Vorbereitungen löschen? Dies kann nicht rückgängig gemacht werden.",
    privacyNote:
      "Gespeicherte Vorbereitungen können jederzeit gelöscht werden. Diese Funktion ersetzt keine Patientenakte.",
    defaultTitle: "Arztgespräch-Vorbereitung",
    deleteError:
      "Die Vorbereitung konnte gerade nicht gelöscht werden.",
    deleteAllError:
      "Die Vorbereitungen konnten gerade nicht gelöscht werden.",
    statusDraft: "Entwurf",
    statusPdfCreated: "PDF erstellt",
    statusCompleted: "Abgeschlossen",
    linkCases: "Meine Verläufe öffnen",
  },
};
