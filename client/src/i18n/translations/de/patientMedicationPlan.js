export default {
  pageTitle: "Medikationspläne – MedScoutX",
  heading: "Medikationspläne",
  intro:
    "Tragen Sie hier Ihre eigenen Medikamente ein, planen Einnahmezeiten und können Erinnerungen aktivieren — unabhängig von Ihrer Praxis.",
  safetyNote:
    "Orientierungshilfe nur für Sie. Keine Diagnose, keine Dosierungs- oder Therapieempfehlung, keine Wechselwirkungsprüfung. Bitte wichtige Fragen mit Arzt oder Apotheke klären.",
  backHub: "Zurück zum Patientenbereich",
  backList: "Zurück zur Übersicht",
  loading: "Wird geladen …",
  loadError: "Daten konnten nicht geladen werden.",
  planNotFound: "Dieser Praxis-Medikationsplan ist nicht verfügbar.",
  featureDisabled: "Dieser Bereich ist in dieser Umgebung noch nicht aktiviert.",
  empty: "Noch keine eigenen Medikamente eingetragen.",
  listCaption: "Ihre Medikamente",
  addMedication: "Medikament hinzufügen",
  fieldDosage: "Dosierung",
  fieldFrequency: "Häufigkeit",
  fieldRoute: "Verabreichungsweg",
  fieldSchedule: "Einnahmezeit",
  fieldStart: "Start",
  fieldEnd: "Ende",
  fieldInstructions: "Hinweise",
  planTitleFallback: "Medikament",
  reminderConsentLabel:
    "Erinnerungen auf diesem Gerät erlauben (optional, jederzeit abschaltbar)",
  reminderConsentHint:
    "MedScoutX sendet keine medizinischen Empfehlungen — nur von Ihnen eingetragene Erinnerungen.",
  practiceSectionTitle: "Pläne von Ihrer Praxis (optional)",
  practiceSectionIntro:
    "Falls Ihre Praxis Ihnen einen Medikationsplan freigegeben hat, finden Sie ihn hier getrennt von Ihren eigenen Einträgen.",
  fromPractice: "Ihre Praxis",
  versionLabel: "Version {version}",
  publishedAt: "Veröffentlicht am {date}",
  openPlan: "Praxisplan öffnen",
  askQuestion: "Rückfrage an die Praxis",
  questionSent: "Ihre Rückfrage wurde an die Praxis übermittelt.",
  questionError: "Rückfrage konnte nicht gesendet werden.",
  aiSimpleLanguage: "In einfacher Sprache (assistierter Entwurf)",
  aiBusy: "Entwurf wird erstellt …",
  aiError: "Entwurf konnte nicht erstellt werden.",
  aiNotConfigured: "Diese Funktion ist in dieser Umgebung nicht verfügbar.",
  aiDraftLabel: "Assistierter Entwurf – bitte prüfen",
  aiDisclaimer:
    "Strukturiert nur vorhandene Angaben. Keine Dosierungs- oder Therapieempfehlung.",
  messagesLink: "Zum sicheren Nachrichtenbereich",
  ownForm: {
    addTitle: "Medikament eintragen",
    editTitle: "Medikament bearbeiten",
    requiredHint: "Nur der Medikamentenname ist Pflicht (*). Alle anderen Felder sind optional.",
    nameLabel: "Medikament *",
    nameRequired: "Bitte geben Sie den Namen des Medikaments ein.",
    endBeforeStart: "Das Enddatum darf nicht vor dem Startdatum liegen.",
    dosageLabel: "Dosierung (optional)",
    dosagePlaceholder: "z. B. 1 Tablette",
    scheduleLabel: "Einnahmezeiten (optional)",
    schedulePlaceholder: "z. B. morgens und abends",
    startLabel: "Startdatum (optional)",
    endLabel: "Enddatum (optional)",
    notesLabel: "Notiz (optional)",
    freeTextLabel: "Freitext (optional)",
    freeTextPlaceholder:
      "z. B. Metformin 500 mg\nmorgens und abends mit dem Essen",
    freeTextApply: "In Felder übernehmen",
    aiAssistHint:
      "Hilft nur beim Ausfüllen der Felder — keine medizinische Bewertung.",
    reminderItemLabel: "Erinnerung für dieses Medikament",
    reminderNeedsConsent:
      "Bitte aktivieren Sie oben zuerst die Erinnerungen, wenn Sie benachrichtigt werden möchten.",
    cancel: "Abbrechen",
    save: "Speichern",
  },
  ownCard: {
    reminderOn: "Erinnerung an",
    endWarning:
      "Endet in {days} Tag(en). Bitte rechtzeitig Arzt oder Apotheke kontaktieren.",
    edit: "Bearbeiten",
    delete: "Entfernen",
    deleteConfirm: "Dieses Medikament wirklich entfernen?",
  },
  supply: {
    sectionTitle: "Vorrat & Menge (optional)",
    hint: "Wenn Sie diese Angaben ausfüllen, berechnen wir automatisch, wann die Packung zur Neige geht – und weisen Sie rechtzeitig darauf hin.",
    packageTotalLabel: "Gesamtmenge in der Packung",
    packageTotalPlaceholder: "z. B. 30",
    unitLabel: "Einheit",
    unitPlaceholder: "z. B. Tabletten oder ml",
    dosePerIntakeLabel: "Menge pro Einnahme",
    dosePerIntakePlaceholder: "z. B. 1",
    timesPerDayLabel: "Einnahmen pro Tag",
    timesPerDayPlaceholder: "z. B. 2",
    remainingLabel: "Vorrat",
    remaining: "noch ca. {remaining} {unit} · reicht bis {date}",
    unitFallback: "Einheiten",
    low: "Läuft in {days} Tag(en) aus – bitte rechtzeitig Nachschub besorgen.",
    today: "Vorrat aufgebraucht – bitte Nachschub besorgen.",
  },
  summary: {
    ctaTitle: "Zusammenfassung & Teilen",
    ctaHint:
      "Fassen Sie alle Medikamente zu einer übersichtlichen Vorschau zusammen — als PDF, QR-Code oder per E-Mail an Ihren Arzt.",
    ctaButton: "Zusammenfassung öffnen",
    pageTitle: "Meine Medikationsübersicht – MedScoutX",
    heading: "Meine Medikationsübersicht",
    intro:
      "Alle von Ihnen eingetragenen Medikamente – übersichtlich zusammengefasst. Die Vorschau aktualisiert sich automatisch, sobald Sie ein Medikament ergänzen oder ändern.",
    back: "Zurück zu den Medikamenten",
    refresh: "Vorschau aktualisieren",
    emptyTitle: "Noch nichts zusammenzufassen",
    emptyText:
      "Sie haben noch keine eigenen Medikamente eingetragen. Fügen Sie zuerst ein Medikament hinzu.",
    emptyCta: "Medikament hinzufügen",
    nameLabel: "Ihr Name (optional, erscheint im Dokument)",
    namePlaceholder: "z. B. Maria Muster",
    generatedAt: "Zusammengefasst am {date}",
    countLabel: "{count} Medikament(e)",
    previewTitle: "Vorschau",
    documentTitle: "Meine aktuellen Medikamente",
    periodLabel: "Zeitraum",
    addedLabel: "Hinzugefügt",
    ongoing: "laufend",
    disclaimer:
      "Nur eigene Angaben der Patientin/des Patienten. Keine Diagnose, keine Therapie- oder Dosierungsempfehlung, keine Wechselwirkungsprüfung.",
    footerBrand: "Lokal erstellt mit MedScoutX",
    footerPage: "Seite",
    pdfFilename: "medscoutx-meine-medikamente.pdf",
    exportTitle: "Herunterladen & Teilen",
    downloadPdf: "Als PDF herunterladen",
    qrOpen: "QR-Code anzeigen",
    qrTitle: "QR-Code Ihrer Medikamentenliste",
    qrIntro:
      "Beim Scannen öffnet sich eine schreibgeschützte Ansicht Ihrer Medikamentenliste – ganz ohne MedScoutX-Konto. Die Daten stecken direkt im Code und werden nicht an einen Server gesendet. Zeigen Sie den Code nur Personen, denen Sie vertrauen (z. B. Ärztin/Arzt oder Apotheke).",
    qrTooLong:
      "Ihre Liste ist zu lang für einen QR-Code. Bitte nutzen Sie stattdessen das PDF oder den E-Mail-Versand.",
    qrError: "Der QR-Code konnte nicht erstellt werden.",
    qrCopy: "Link kopieren",
    qrCopied: "Link kopiert",
    qrDownload: "QR als Bild speichern",
    qrPrint: "Drucken",
    qrClose: "Schließen",
    qrAlt: "QR-Code mit Ihrer Medikamentenliste",
    sharedPageTitle: "Geteilte Medikamentenliste – MedScoutX",
    sharedBanner:
      "Geteilte Medikamentenliste – nur zur Ansicht. Dies sind ausschließlich die eigenen Angaben der Patientin/des Patienten. Keine Diagnose oder Therapieempfehlung.",
    sharedInvalidTitle: "Keine Medikamentenliste gefunden",
    sharedInvalidText:
      "Dieser Link enthält keine gültige Medikamentenliste.",
    sendTitle: "An Arzt senden (Ärztebuch)",
    sendIntro:
      "Senden Sie Ihre Medikamentenliste als PDF per E-Mail an einen Kontakt aus Ihrem Ärztebuch (z. B. Hausarzt oder Neurologie).",
    sendSelectLabel: "Kontakt auswählen",
    sendSelectPlaceholder: "Bitte wählen …",
    sendSelectRequired: "Bitte wählen Sie einen Kontakt aus.",
    sendConsentLabel:
      "Ich möchte diese PDF jetzt per E-Mail an den gewählten Kontakt senden.",
    sendConsentRequired: "Bitte bestätigen Sie den Versand.",
    sendButton: "Per E-Mail senden",
    sendBusy: "Wird gesendet …",
    sendSuccess: "Ihre Medikamentenliste wurde gesendet.",
    sendErrorGeneric: "Die E-Mail konnte nicht gesendet werden.",
    sendNoContacts:
      "Sie haben noch keine Arztkontakte gespeichert. Legen Sie zuerst einen Kontakt im Ärztebuch an.",
    sendManageContacts: "Ärztebuch verwalten",
    sendNoEmail: "Für diesen Kontakt ist keine E-Mail-Adresse hinterlegt.",
    pharmacy: {
      title: "Apotheken-Assistent – allgemeine Hinweise",
      intro:
        "Automatisch aus Ihren Einträgen erstellte, allgemeine Hinweise. Dies ist KEINE vollständige Wechselwirkungsprüfung und KEIN Ersatz für Apotheke oder Arzt. Es wird nichts an einen Server gesendet.",
      none:
        "Für Ihre aktuelle Liste gibt es keine allgemeinen Hinweise. Das bedeutet NICHT, dass keine Wechselwirkungen bestehen. Bitte besprechen Sie Ihre Medikamente trotzdem mit Ihrer Apotheke oder Ihrem Arzt.",
      talkTo: "Bitte mit Ihrer Apotheke oder Ihrem Arzt besprechen.",
      severityWarning: "Wichtig",
      severityInfo: "Hinweis",
      medsLabel: "Betrifft",
      disclaimer:
        "Kleine, feste Auswahl allgemein bekannter Hinweise. Keine Diagnose, keine Therapie- oder Dosierungsempfehlung, keine vollständige Prüfung. Im Zweifel immer Apotheke oder Arzt fragen.",
      rules: {
        antibiotic_dairy: {
          title: "Bestimmte Antibiotika und Milch/Kalzium",
          message:
            "Manche Antibiotika (z. B. Tetracycline oder bestimmte „-floxacin“-Wirkstoffe) sollten nicht gleichzeitig mit Milch, Milchprodukten, Kalzium, Magnesium oder Eisen eingenommen werden. Halten Sie am besten etwa 2–3 Stunden Abstand.",
        },
        levothyroxine_fasting: {
          title: "Schilddrüsenhormon (Levothyroxin) nüchtern einnehmen",
          message:
            "Levothyroxin wirkt am besten nüchtern, etwa 30 Minuten vor dem Frühstück, mit etwas Wasser – getrennt von Kaffee, Milch, Kalzium oder Eisen.",
        },
        anticoag_nsaid: {
          title: "Blutverdünner zusammen mit Schmerzmitteln (NSAR)",
          message:
            "Blutverdünner zusammen mit entzündungshemmenden Schmerzmitteln (z. B. Ibuprofen, Diclofenac, ASS) können das Blutungsrisiko erhöhen.",
        },
        double_anticoag: {
          title: "Mehrere Blutverdünner gleichzeitig",
          message:
            "Es sieht so aus, als würden mehrere blutverdünnende Mittel zusammen eingenommen. Das kann das Blutungsrisiko deutlich erhöhen.",
        },
      },
    },
    reminders: {
      title: "Erinnerungen ans Handy",
      intro:
        "Aktivieren Sie freundliche Erinnerungen an Ihre Einnahme – auch wenn die App geschlossen ist. Auf dem Server werden nur die Erinnerungszeiten gespeichert, keine Medikamentennamen.",
      loading: "Wird geladen …",
      unsupported: "Ihr Browser unterstützt keine Push-Erinnerungen.",
      serverDisabled: "Erinnerungen sind auf diesem Server noch nicht aktiviert.",
      iosHint:
        "iPhone/iPad: Bitte fügen Sie die App über „Teilen“ → „Zum Home-Bildschirm“ hinzu, damit Erinnerungen ankommen.",
      enableLabel: "Erinnerungen auf diesem Gerät aktivieren",
      enabledMsg: "Erinnerungen sind aktiviert.",
      nativeTitle: "Erinnerung",
      nativeBody: "Zeit für Ihre Einnahme.",
      nativeChannelHint: "Erinnerungen werden direkt auf diesem Gerät geplant.",
      disabledMsg: "Erinnerungen wurden deaktiviert.",
      savedMsg: "Erinnerungszeiten gespeichert.",
      permissionDenied:
        "Bitte erlauben Sie Benachrichtigungen in Ihrem Browser, um Erinnerungen zu erhalten.",
      genericError: "Das hat nicht geklappt. Bitte versuchen Sie es erneut.",
      timesLegend: "Einnahme-Erinnerungen (Uhrzeiten)",
      timeLabel: "Uhrzeit",
      addTime: "Uhrzeit hinzufügen",
      removeTime: "Uhrzeit entfernen",
      soundLabel: "Mit Ton",
      vibrationLabel: "Mit Vibration",
      refillNote:
        "Zusätzlich erinnern wir Sie automatisch 2 Tage bevor ein Medikament zur Neige geht (aus Ihren Vorrats-Angaben berechnet).",
      saveBtn: "Speichern",
      testBtn: "Testbenachrichtigung",
      testSent: "Testbenachrichtigung gesendet.",
      testFailed: "Testbenachrichtigung konnte nicht gesendet werden.",
      disclaimer:
        "Freiwillig, jederzeit abschaltbar. Erinnerungen ersetzen keine ärztliche oder apothekerliche Beratung.",
      intakeBody: "Zeit für Ihre Medikamente 💊 – bitte an die Einnahme denken.",
      refillBody:
        "Ein Medikament geht bald zur Neige – bitte an Nachschub denken.",
      testBody: "Test: So sehen Ihre Erinnerungen aus. 💊",
    },
  },
};
