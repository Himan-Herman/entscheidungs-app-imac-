/**
 * Austritts-, Schließungs- und Löschprozesse (Patient + Praxis).
 * Formell (Sie). Keine medizinischen Inhalte, keine internen IDs — die
 * Vorgangsnummer ist die einzige bewusst angezeigte Referenz.
 */
export default {
  patient: {
    dangerTitle: "Konto löschen",
    dangerIntro:
      "Die Löschung Ihres MedScoutX-Kontos ist endgültig und kann nicht rückgängig gemacht werden. Bitte lesen Sie vor der Löschung, was gelöscht wird — und was möglicherweise nicht.",
    whatDeletedTitle: "Was gelöscht wird",
    whatDeletedItems: [
      "Ihr persönliches MedScoutX-Konto",
      "Ihre selbst gespeicherten Patientendaten in MedScoutX",
      "Ihre persönlichen Verbindungen zu Praxen",
      "Ihre persönlichen Freigaben und Zugriffstokens",
      "Ihre persönlichen Einstellungen und Sitzungen",
    ],
    whatRemainsTitle: "Was möglicherweise nicht gelöscht wird",
    whatRemainsItems: [
      "Dokumentation, die eine Praxis selbst erstellt hat",
      "Bereits heruntergeladene oder exportierte Kopien",
      "Daten, die außerhalb von MedScoutX gespeichert wurden",
      "Daten, die eine Praxis aufgrund eigener Pflichten aufbewahren muss",
    ],
    whatRemainsNote:
      "MedScoutX kann Daten auf fremden Systemen nicht löschen. Praxen können eigenen Aufbewahrungs- und Dokumentationspflichten unterliegen.",
    exportHint:
      "Empfehlung: Laden Sie vor der Löschung eine Kopie Ihrer Daten herunter (Abschnitt „Datenexport“ oben). Nach der Löschung ist kein Export mehr möglich.",
    receiptHint:
      "Nach der Löschung erhalten Sie eine schriftliche Bestätigung mit Vorgangsnummer an Ihre registrierte E-Mail-Adresse.",
    openDialogButton: "Konto löschen …",
    ownerNoticeTitle: "Sie besitzen eine Praxis",
    ownerNotice:
      "Mit Ihrem Konto ist mindestens eine Praxis verbunden. Bevor Ihr Konto gelöscht werden kann, müssen Sie entscheiden, was mit der Praxis geschehen soll.",
    ownerManageButton: "Praxis verwalten",
    dialogTitle: "Konto endgültig löschen?",
    dialogWarning:
      "Diese Aktion kann nicht rückgängig gemacht werden. Ihr Konto und Ihre in MedScoutX gespeicherten Patientendaten werden endgültig gelöscht.",
    checkboxLabel:
      "Ich habe verstanden, welche Daten gelöscht werden und welche Unterlagen möglicherweise bei meinen Praxen verbleiben.",
    phraseLabel: "Geben Sie zur Bestätigung genau diese Phrase ein:",
    phraseExpected: "MEIN KONTO ENDGÜLTIG LÖSCHEN",
    phraseMismatch: "Die eingegebene Phrase stimmt nicht überein.",
    confirmButton: "Konto jetzt endgültig löschen",
    cancelButton: "Abbrechen",
    deleting: "Konto wird gelöscht …",
    successTitle: "Ihr Konto wurde gelöscht",
    successBody:
      "Ihr MedScoutX-Konto wurde endgültig gelöscht. Ihre Vorgangsnummer: {caseNumber}",
    successEmailHint:
      "Eine schriftliche Bestätigung wurde an Ihre registrierte E-Mail-Adresse veranlasst. Unterlagen Ihrer Praxen oder bereits exportierte Kopien können außerhalb von MedScoutX bestehen bleiben.",
    supportLabel: "Kontakt:",
    errorGeneric: "Die Löschung konnte nicht abgeschlossen werden. Ihr Konto wurde nicht verändert.",
    errorOwnerBlocked:
      "Mit Ihrem Konto ist mindestens eine Praxis verbunden. Die Kontolöschung ist für Praxisinhaber derzeit nicht automatisch möglich — bitte klären Sie zuerst, was mit der Praxis geschehen soll.",
    errorContextBlocked:
      "Die Löschung konnte nicht sicher abgeschlossen werden und wurde vollständig zurückgenommen. Ihr Konto ist unverändert. Bitte wenden Sie sich an den Support.",
  },
  practice: {
    sectionTitle: "Mitgliedschaft und Praxisstatus",
    sectionIntro:
      "Hier pausieren oder schließen Sie Ihre Praxis, aktivieren sie wieder oder beantragen die endgültige Löschung. Nur die Praxisinhaberin bzw. der Praxisinhaber kann diese Aktionen ausführen.",
    statusLabel: "Aktueller Status",
    status: {
      active: "Aktiv",
      suspended: "Vorübergehend pausiert",
      closed: "Geschlossen",
      reactivation_requested: "Reaktivierung angefragt",
      deletion_requested: "Endgültige Löschung beantragt",
    },
    statusBanner: {
      suspended:
        "Ihre Praxis ist pausiert. Der operative Zugriff ist beendet; gespeicherte Daten bleiben geschützt erhalten.",
      closed:
        "Ihre Praxis ist geschlossen. Der operative Zugriff ist beendet. Eine Reaktivierung kann angefragt werden.",
      reactivation_requested:
        "Ihre Reaktivierungsanfrage liegt MedScoutX vor und wird geprüft. Sie erhalten eine schriftliche Rückmeldung.",
      deletion_requested:
        "Ihre endgültige Löschanfrage wurde registriert. Es wurde noch keine Löschung durchgeführt — MedScoutX prüft zunächst Aufbewahrungs- und Dokumentationspflichten.",
    },
    pauseTitle: "Praxis vorübergehend pausieren",
    pauseBody:
      "Die Praxis bleibt gespeichert und kann später wieder aktiviert werden. Der operative Zugriff wird vorübergehend beendet.",
    pauseRecommendedTitle: "Empfohlen für:",
    pauseRecommended: [
      "vorübergehende Pause",
      "Urlaub oder Umstrukturierung",
      "Zahlungsverzug",
      "spätere Rückkehr zu MedScoutX",
    ],
    pauseButton: "Praxis pausieren …",
    pauseConfirmTitle: "Praxis vorübergehend pausieren?",
    pauseConfirmBody:
      "Der operative Zugriff Ihres Teams wird sofort beendet. Patientendaten werden nicht gelöscht. Sie können die Praxis jederzeit selbst wieder aktivieren.",
    closeTitle: "Praxis bei MedScoutX schließen",
    closeBody:
      "Die Mitgliedschaft endet. Die Praxis kann nicht mehr operativ arbeiten. Aufbewahrte Daten bleiben geschützt gespeichert und eine spätere Reaktivierung kann beantragt werden.",
    closeRecommendedNote:
      "Empfohlen, wenn die Praxis MedScoutX verlassen, aber eine spätere Rückkehr nicht ausschließen möchte.",
    closeButton: "Praxis schließen …",
    closeConfirmTitle: "Praxis bei MedScoutX schließen?",
    closeConfirmBody:
      "Alle Team-Sitzungen und Zugriffe werden beendet. Es sind keine neuen Patientenverbindungen oder Freigaben möglich. Die Praxis wird nicht gelöscht; eine spätere Reaktivierung kann angefragt werden.",
    reactivateTitle: "Praxis wieder aktivieren",
    reactivateBody:
      "Beendet die Pausierung nach Sicherheitsprüfung. Zuvor widerrufene Einwilligungen, entzogene Freigaben und entfernte Teamzugänge werden nicht automatisch wiederhergestellt.",
    reactivateButton: "Praxis wieder aktivieren …",
    reactivateConfirmTitle: "Praxis wieder aktivieren?",
    reactivateConfirmBody:
      "Ihre Praxis wird wieder operativ. Bitte prüfen Sie anschließend Ihre aktuelle Team- und Berechtigungsstruktur — frühere Widerrufe bleiben bestehen.",
    requestReactivateTitle: "Reaktivierung anfragen",
    requestReactivateBody:
      "Ihre geschlossene Praxis kann nur durch MedScoutX reaktiviert werden. Die Anfrage wird an MedScoutX gesendet; Sie erhalten eine schriftliche Eingangsbestätigung.",
    requestReactivateButton: "Reaktivierung anfragen …",
    requestReactivateConfirmTitle: "Reaktivierung bei MedScoutX anfragen?",
    requestReactivateConfirmBody:
      "MedScoutX prüft Ihre Anfrage und meldet sich schriftlich. Alte Patientenfreigaben, widerrufene Einwilligungen und Teamzugänge werden nicht automatisch reaktiviert.",
    deleteTitle: "Endgültige Löschung beantragen",
    deleteWarning:
      "Eine endgültige Löschung kann nicht rückgängig gemacht werden. Vor der Löschung müssen Aufbewahrungs-, Dokumentations- und Datenschutzpflichten geprüft werden.",
    deleteBody:
      "Diese Option löscht nicht sofort. Es wird eine schriftliche Anfrage mit Vorgangsnummer erstellt; die Löschung bleibt technisch gesperrt, bis MedScoutX die Anfrage geprüft und freigegeben hat.",
    deleteButton: "Endgültige Löschung beantragen …",
    deleteConfirmTitle: "Endgültige Löschung beantragen?",
    deleteConfirmBody:
      "Der operative Zugriff wird beendet und eine schriftliche Löschanfrage erstellt. Es wird nichts gelöscht, bis MedScoutX die Prüfung abgeschlossen hat.",
    reasonLabel: "Sachlicher Grund (optional, keine medizinischen Inhalte)",
    passwordLabel: "Zur Bestätigung: Ihr Passwort",
    passwordHelp:
      "Aus Sicherheitsgründen müssen Sie sich für diese Aktion erneut mit Ihrem Passwort bestätigen.",
    dialogConfirm: "Bestätigen",
    dialogCancel: "Abbrechen",
    working: "Wird ausgeführt …",
    receiptHint:
      "Sie erhalten für jede dieser Aktionen eine schriftliche Bestätigung mit Vorgangsnummer an Ihre registrierte E-Mail-Adresse.",
    afterRequestTitle: "Löschanfrage registriert",
    afterRequestBody:
      "Ihre Anfrage wurde registriert. Es wurde noch keine Löschung durchgeführt. Ihre Vorgangsnummer: {caseNumber}",
    emailConfirmHint:
      "Bitte bestätigen Sie Ihre Anfrage zusätzlich per E-Mail an {supportEmail}.",
    openMailButton: "E-Mail an MedScoutX öffnen",
    mailNotSentNote:
      "Hinweis: Das Öffnen Ihres E-Mail-Programms ist noch kein Versand. Die Anfrage gilt erst mit Ihrer tatsächlich gesendeten E-Mail als bestätigt.",
    copyCaseButton: "Vorgangsnummer kopieren",
    copySubjectButton: "Betreff kopieren",
    copied: "Kopiert.",
    copyFailed: "Kopieren nicht möglich — bitte manuell übernehmen.",
    caseListTitle: "Vorgänge",
    mailSubject: "Endgültige Löschung meiner Praxis – Anfrage {requestId}",
    mailBody:
      "Guten Tag,\n\nhiermit bestätige ich die endgültige Löschanfrage für meine Praxis bei MedScoutX.\n\nPraxis: {practiceName}\nAnfrage-ID: {requestId}\nRegistrierte E-Mail-Adresse: {ownerEmail}\n\nMir ist bekannt, dass die Löschung erst nach Prüfung möglicher Aufbewahrungs- und Dokumentationspflichten durchgeführt wird.\n\nMit freundlichen Grüßen\n{ownerName}",
    supportLabel: "Offizielle Kontaktadresse:",
    errors: {
      practice_lifecycle_transition_invalid:
        "Diese Statusänderung ist im aktuellen Zustand nicht möglich.",
      practice_owner_required:
        "Nur die Praxisinhaberin bzw. der Praxisinhaber kann diese Aktion ausführen.",
      practice_already_suspended: "Die Praxis ist bereits pausiert.",
      practice_already_closed: "Die Praxis ist bereits geschlossen.",
      reactivation_already_requested: "Es liegt bereits eine Reaktivierungsanfrage vor.",
      deletion_already_requested: "Es liegt bereits eine aktive Löschanfrage vor.",
      confirmation_required: "Bitte bestätigen Sie die Aktion mit Ihrem korrekten Passwort.",
      unsupported_field: "Die Anfrage enthielt unerwartete Angaben und wurde abgelehnt.",
      email_delivery_pending:
        "Die schriftliche Bestätigung wird zugestellt, sobald der Versand möglich ist.",
      practice_deletion_locked:
        "Die endgültige Löschung ist technisch gesperrt, bis MedScoutX Ihre Anfrage geprüft und freigegeben hat.",
      generic: "Die Aktion konnte nicht ausgeführt werden. Es wurde nichts verändert.",
    },
  },
};
