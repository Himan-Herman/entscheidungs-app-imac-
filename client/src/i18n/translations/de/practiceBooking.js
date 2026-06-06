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

  // ── Appointment types (read-only) ────────────────────────────────────────────
  sectionTypes: "Terminarten",
  typesHint: "Terminarten werden im Kalender-Bereich konfiguriert.",
  typesEmpty: "Keine Terminarten vorhanden.",
  typeDurationMin: "Min.",

  // ── Availability windows ─────────────────────────────────────────────────────
  sectionAvailability: "Verfügbarkeiten",
  availabilityHint: "Legt fest, an welchen Wochentagen und Uhrzeiten Terminanfragen möglich sind.",
  availabilityEmpty: "Keine Verfügbarkeiten eingetragen.",
  weekdays: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
  weekday: "Wochentag",
  startTime: "Startzeit",
  endTime: "Endzeit",
  addAvailability: "Verfügbarkeit hinzufügen",
  removeAvailability: "Entfernen",
  actionError: "Aktion fehlgeschlagen.",
  availabilityAdded: "Verfügbarkeit hinzugefügt.",
  availabilityRemoved: "Verfügbarkeit entfernt.",

  // ── Incoming requests ────────────────────────────────────────────────────────
  sectionRequests: "Offene Anfragen",
  requestsHint: 'Eingehende Terminanfragen mit Status „Ausstehend".',
  requestsEmpty: "Keine offenen Anfragen vorhanden.",
  requestsLoadError: "Anfragen konnten nicht geladen werden.",
  requestsLoading: "Anfragen werden geladen …",
  statusRequested: "Ausstehend",
  statusConfirmed: "Bestätigt",
  statusCancelled: "Storniert",
  statusCompleted: "Abgeschlossen",
  statusNoShow: "Nicht erschienen",
  requestedTimeLabel: "Gewünschter Zeitpunkt",
  locationTypeLabel: "Termin-Typ",
  locationType_practice: "Praxis",
  locationType_video: "Video",
  locationType_phone: "Telefon",
  patientNoteLabel: "Patientenhinweis",

  // ── AI assistant panel ───────────────────────────────────────────────────────
  aiSectionTitle: "Smart-Assistent",
  aiDisclaimer: "Smart-gestützt, nur organisatorisch — keine Diagnose, keine Dringlichkeitsbewertung, keine Therapieempfehlung.",
  aiSummarizeBtn: "Anfrage zusammenfassen",
  aiReplyDraftBtn: "Antwortvorschlag erstellen",
  aiLoading: "Wird erstellt …",
  aiResultHeading: "Smart-Ergebnis",
  aiResultDismiss: "Verwerfen",
  aiError: "Smart-Assistent nicht verfügbar. Bitte Anfrage direkt prüfen.",
  aiUsedFallback: "Kein sicheres Ergebnis generiert. Bitte Anfrage direkt prüfen.",
};
