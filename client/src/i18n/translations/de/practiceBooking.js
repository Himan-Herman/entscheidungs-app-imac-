export default {
  pageTitle: "MedScoutX — Termine & Anfragen",

  heading: "Termine & Anfragen",
  intro: "Eingehende Terminanfragen von Patientinnen und Patienten verwalten und konfigurieren.",
  featureDisabled: "Die Termin-Anfragen-Funktion ist für diese Praxis noch nicht aktiviert.",
  backHub: "Zur Praxis-Übersicht",
  selectPractice: "Praxisprofil",

  loading: "Wird geladen …",
  loadError: "Einstellungen konnten nicht geladen werden.",
  loadErrorUnauthorized: "Bitte erneut anmelden.",
  loadErrorServer: "Einstellungen konnten wegen eines Serverfehlers nicht geladen werden.",
  saveError: "Speichern fehlgeschlagen.",

  // ── Activation ──────────────────────────────────────────────────────────────
  sectionActivation: "Aktivierung",
  bookingEnabledLabel: "Terminanfragen aktivieren",
  bookingEnabledHint: "Wenn aktiviert, können Patientinnen und Patienten über MedScoutX Terminanfragen stellen.",
  bookingEnabledOn: "Aktiviert",
  bookingEnabledOff: "Deaktiviert",

  // ── Mode ────────────────────────────────────────────────────────────────────
  sectionMode: "Anfrage-Modus",
  bookingModeLabel: "Anfrage-Typ",
  bookingMode_disabled: "Deaktiviert",
  bookingMode_medscoutx_request: "Interne Anfrage (MedScoutX)",
  bookingModeHint: "Bei aktivierter Funktion wird ausschließlich die interne MedScoutX-Anfrage verwendet.",

  // ── Request form note ────────────────────────────────────────────────────────
  sectionRequestNote: "Hinweis für Patientinnen und Patienten",
  requestFormNoteLabel: "Hinweistext (optional)",
  requestFormNotePlaceholder: "z. B. Bitte geben Sie an, ob es sich um einen Erst- oder Folgetermin handelt.",
  requestFormNoteHint: "Dieser Text wird Patientinnen und Patienten beim Ausfüllen der Anfrage angezeigt (max. 300 Zeichen).",
  requestFormNoteCharsLeft: "{{n}} Zeichen verbleibend",

  // ── Anamnesis link ──────────────────────────────────────────────────────────
  sectionAnamnesis: "Verknüpfter Anamnese-Link",
  linkedAnamnesisLabel: "Anamnese-Link (optional)",
  linkedAnamnesisPlaceholder: "Link-ID eingeben",
  linkedAnamnesisHint: "Patienten, die eine Terminanfrage stellen, werden zum Ausfüllen dieses Anamnese-Fragebogens aufgefordert.",
  linkedAnamnesisNone: "Kein Link verknüpft",
  linkedAnamnesisRemove: "Verknüpfung aufheben",

  // ── Save ────────────────────────────────────────────────────────────────────
  save: "Speichern",
  saving: "Wird gespeichert …",
  saved: "Gespeichert.",
  cancel: "Abbrechen",

  // ── Roles / read-only ────────────────────────────────────────────────────────
  readOnly: "Nur Lesen — Ihre Rolle erlaubt keine Änderungen.",

  // ── Hub card label ───────────────────────────────────────────────────────────
  cardBooking: "Termine & Anfragen",

  // ── Error detail ────────────────────────────────────────────────────────────
  errorBookingModeConflict: "Der gewählte Modus ist nur möglich, wenn Terminanfragen aktiviert sind.",
  errorAnamnesisLinkNotFound: "Anamnese-Link nicht gefunden.",
  errorAnamnesisLinkInactive: "Anamnese-Link ist inaktiv.",
  errorAnamnesisLinkExpired: "Anamnese-Link ist abgelaufen.",

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  tabSettings: "Einstellungen",
  tabRequests: "Neue Anfragen",

  // ── Requests list ─────────────────────────────────────────────────────────────
  reqLoading: "Anfragen werden geladen …",
  reqLoadError: "Anfragen konnten nicht geladen werden.",
  reqEmpty: "Keine neuen Terminanfragen vorhanden.",
  reqRefresh: "Aktualisieren",

  // ── Request card fields ───────────────────────────────────────────────────────
  reqWishedTime: "Gewünschter Zeitraum",
  reqType: "Terminart",
  reqNote: "Anliegen",
  reqCreated: "Eingegangen am",

  // ── Status badges ─────────────────────────────────────────────────────────────
  reqBadge_requested: "Neue Anfrage",
  reqBadge_confirmed: "Bestätigt",
  reqBadge_cancelled: "Abgelehnt",
  reqBadge_scheduled: "Geplant",
  reqBadge_completed: "Abgeschlossen",
  reqBadge_no_show: "Nicht erschienen",
  reqBadge_rescheduled: "Verschoben",

  // ── Actions ───────────────────────────────────────────────────────────────────
  reqAccept: "Annehmen",
  reqDecline: "Ablehnen",

  // ── Accept form ───────────────────────────────────────────────────────────────
  reqAcceptHeading: "Termin bestätigen",
  reqAcceptStart: "Termin von",
  reqAcceptEnd: "Termin bis",
  reqAcceptPracticeNote: "Interne Notiz (optional)",
  reqAcceptPracticeNotePlaceholder: "Nur für das Praxisteam sichtbar.",
  reqAcceptConfirm: "Termin bestätigen",
  reqAcceptInvalidTime: "Bitte gültigen Start- und Endzeitpunkt angeben.",
  reqAcceptError: "Anfrage konnte nicht bestätigt werden.",
  reqAccepted: "Termin bestätigt.",

  // ── Decline form ──────────────────────────────────────────────────────────────
  reqDeclineHeading: "Anfrage ablehnen",
  reqDeclineReason: "Ablehnungsgrund (optional)",
  reqDeclineReasonPlaceholder: "Nur organisatorische Hinweise — keine medizinischen Details.",
  reqDeclineHint: "Bitte keine medizinischen Details eintragen.",
  reqDeclineConfirm: "Anfrage ablehnen",
  reqDeclineError: "Anfrage konnte nicht abgelehnt werden.",
  reqDeclined: "Anfrage abgelehnt.",

  // ── Request misc ──────────────────────────────────────────────────────────────
  reqErrorNotARequest: "Diese Anfrage kann nicht mehr bearbeitet werden.",
  reqReadOnly: "Nur Lesen — Aktionen nicht verfügbar.",
};
