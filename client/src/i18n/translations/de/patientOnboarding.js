/**
 * Patienten-Onboarding: Praxis legt einen lokalen Eintrag an, lädt ein, der
 * Patient verbindet sein Konto.
 *
 * Die Texte sagen bewusst „verbinden", nicht „freigeben": das Verbinden stellt
 * nur die Beziehung her. Über Daten entscheidet der Patient danach getrennt.
 * [Juristische Prüfung erforderlich] für den endgültigen Wortlaut.
 */
export default {
  practice: {
    title: "Patientinnen und Patienten einladen",
    intro:
      "Legen Sie einen Eintrag in Ihrer Praxis an und laden Sie die Person ein, ihr eigenes Konto damit zu verbinden.",
    addButton: "Patient hinzufügen",
    empty: "Noch keine Einträge angelegt.",
    loading: "Wird geladen…",
    loadError: "Die Liste konnte nicht geladen werden.",
    unavailable: "Dieser Bereich ist auf dieser Installation nicht verfügbar.",
    searchLabel: "Suchen",
    searchPlaceholder: "Name oder Aktenzeichen",
    showArchived: "Archivierte anzeigen",
    columns: {
      name: "Name",
      dateOfBirth: "Geburtsdatum",
      status: "Status",
      invitation: "Einladung",
      actions: "Aktionen",
    },
    form: {
      title: "Neuen Patienteneintrag anlegen",
      description:
        "Diese Angaben bleiben in Ihrer Praxis. Es wird noch keine Verbindung zu einem Konto hergestellt.",
      givenName: "Vorname",
      familyName: "Nachname",
      dateOfBirth: "Geburtsdatum",
      dateOfBirthHint: "Optional. Hilft nur, Verwechslungen zu vermeiden.",
      email: "E-Mail",
      emailHint: "Optional. Nur für den Versand, keine Identitätsprüfung.",
      phone: "Telefon",
      recordNumber: "Aktenzeichen",
      recordNumberHint: "Optional. Ihr praxisinternes Kennzeichen.",
      submit: "Eintrag anlegen",
      cancel: "Abbrechen",
      saving: "Wird angelegt…",
      required: "Vor- und Nachname sind erforderlich.",
      invalidDate: "Bitte ein gültiges Datum eingeben.",
      invalidEmail: "Bitte eine gültige E-Mail-Adresse eingeben.",
      error: "Der Eintrag konnte nicht angelegt werden.",
    },
    duplicate: {
      one: "Möglicher bereits vorhandener Eintrag",
      many: "{count} mögliche bereits vorhandene Einträge",
      hint:
        "Bitte prüfen Sie Ihre Liste, bevor Sie einladen. Der Eintrag wurde trotzdem angelegt — es wird nichts automatisch zusammengeführt.",
      capped:
        "Es wurden nicht alle Einträge geprüft. Bitte zusätzlich manuell suchen.",
    },
    entryStatus: {
      draft: "Angelegt",
      invited: "Eingeladen",
      linked: "Verbunden",
      archived: "Archiviert",
    },
    invitationStatus: {
      none: "Keine Einladung",
      pending: "Ausstehend",
      expired: "Abgelaufen",
      redeemed: "Eingelöst",
      revoked: "Widerrufen",
      superseded: "Ersetzt",
    },
    actions: {
      invite: "Einladung erstellen",
      regenerate: "Einladung erneuern",
      sendEmail: "Per E-Mail senden",
      revoke: "Einladung widerrufen",
      copyLink: "Link kopieren",
      showQr: "QR-Code anzeigen",
      manualCode: "Code für vor Ort",
      newManualCode: "Neuen Code erzeugen",
      archive: "Eintrag archivieren",
      close: "Schließen",
    },
    invitation: {
      created: "Einladung erstellt.",
      regenerated:
        "Neue Einladung erstellt. Die vorherige funktioniert ab sofort nicht mehr.",
      revoked: "Einladung widerrufen.",
      emailSent:
        "Einladung an {address} gesendet. Der Link ist aus Sicherheitsgründen hier nicht sichtbar.",
      emailMissing:
        "Für diesen Eintrag ist keine E-Mail-Adresse hinterlegt. Bitte Adresse ergänzen oder Link bzw. Code verwenden.",
      emailFailed:
        "Die E-Mail konnte nicht gesendet werden. Bitte später erneut versuchen oder Link bzw. Code verwenden.",
      linkLabel: "Einladungslink",
      linkHint:
        "Gültig für 7 Tage. Der Link ist nur einmal sichtbar — bitte jetzt weitergeben.",
      linkGone:
        "Der Link ist nicht mehr einsehbar. Erstellen Sie eine neue Einladung, um einen neuen Link zu erhalten.",
      copied: "In die Zwischenablage kopiert.",
      copyFailed: "Kopieren nicht möglich. Bitte den Link markieren und kopieren.",
      codeLabel: "Code zum Vorlesen",
      codeHint: "Gültig für 24 Stunden. Nur einmal sichtbar.",
      codeCreated: "Neuer Code erzeugt. Der vorherige gilt nicht mehr.",
      expiresIn7Days: "Läuft in 7 Tagen ab",
      codeExpiresIn: "Läuft in 24 Stunden ab",
      error: "Die Aktion konnte nicht ausgeführt werden.",
      confirmRevoke:
        "Einladung widerrufen? Der Link und der Code funktionieren danach nicht mehr.",
      confirmArchive:
        "Eintrag archivieren? Eine offene Einladung wird dabei widerrufen. Der Eintrag bleibt erhalten.",
    },
    qr: {
      title: "QR-Code zur Einladung",
      description:
        "Zum Abfotografieren mit dem Smartphone. Der Code enthält nur den Einladungslink — keine Patientendaten.",
      failed: "Der QR-Code konnte nicht erzeugt werden. Bitte den Link verwenden.",
      download: "QR-Code herunterladen",
      alt: "QR-Code, der den Einladungslink enthält",
    },
    linked: {
      badge: "Verbunden",
      hint: "Die Person hat die Einladung eingelöst und ihr Konto verbunden.",
      linkStatusInvited: "Freigaben stehen noch aus",
      linkStatusActive: "Freigaben erteilt",
    },
  },

  patient: {
    title: "Einladung Ihrer Praxis",
    loading: "Einladung wird geprüft…",
    invitedBy: "Sie wurden eingeladen von",
    invalid: {
      title: "Diese Einladung ist nicht mehr gültig",
      body:
        "Der Link oder Code ist abgelaufen, wurde bereits verwendet oder zurückgezogen. Bitte wenden Sie sich an Ihre Praxis für eine neue Einladung.",
    },
    noCredential: {
      title: "Keine Einladung erkannt",
      body: "Öffnen Sie den Link Ihrer Praxis, oder geben Sie den Code ein, den Sie erhalten haben.",
    },
    manualCode: {
      label: "Code eingeben",
      hint: "Den Code haben Sie in Ihrer Praxis erhalten. Er ist 24 Stunden gültig.",
      placeholder: "ABCD-EFGH-JKLM",
      submit: "Code prüfen",
      checking: "Wird geprüft…",
    },
    auth: {
      title: "Melden Sie sich an, um fortzufahren",
      body:
        "Zum Verbinden brauchen Sie ein MedScoutX-Konto. Ihre Einladung bleibt in diesem Browser-Tab erhalten.",
      login: "Anmelden",
      register: "Konto erstellen",
    },
    subject: {
      title: "Wen möchten Sie mit dieser Praxis verbinden?",
      hint: "Sie können die Verbindung für sich selbst oder für eine von Ihnen betreute Person herstellen.",
      self: "Mich selbst",
      selfHint: "Die Verbindung gilt für Ihr eigenes Konto.",
      profileGroup: "Von mir betreute Personen",
      noProfiles:
        "Sie haben noch keine weiteren Personen angelegt. Die Verbindung gilt daher für Sie selbst.",
      loadError: "Ihre Profile konnten nicht geladen werden.",
    },
    connect: {
      button: "Mit Praxis verbinden",
      working: "Wird verbunden…",
      hint:
        "Damit stellen Sie nur die Verbindung her. Welche Daten die Praxis sehen darf, entscheiden Sie danach.",
    },
    success: {
      title: "Verbindung hergestellt",
      body: "Ihr Konto ist jetzt mit {practice} verbunden.",
      consentNext: "Als Nächstes: Freigaben festlegen",
      consentHint:
        "Bisher wurden keine Daten freigegeben. Legen Sie jetzt fest, was die Praxis sehen darf.",
      toConsent: "Freigaben festlegen",
      alreadyActive:
        "Für diese Praxis bestehen bereits Freigaben. Sie können sie jederzeit ändern.",
      toPractice: "Zur Praxis",
    },
    errors: {
      subjectMismatch:
        "Diese Einladung wurde bereits für eine andere Person eingelöst. Bitte wenden Sie sich an Ihre Praxis.",
      alreadyLinked:
        "Für diese Praxis besteht bereits eine Verbindung, die zu einem anderen Eintrag gehört. Bitte wenden Sie sich an Ihre Praxis.",
      notClaimable:
        "Dieser Eintrag wurde bereits verbunden. Bitte wenden Sie sich an Ihre Praxis.",
      conflict: "Das hat nicht geklappt. Bitte versuchen Sie es erneut.",
      generic: "Das hat nicht geklappt. Bitte versuchen Sie es später erneut.",
      subjectRequired: "Bitte wählen Sie aus, für wen die Verbindung gelten soll.",
    },
  },
};
