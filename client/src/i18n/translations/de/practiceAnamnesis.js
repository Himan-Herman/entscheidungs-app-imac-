export default {
  pageTitle: "MedScoutX — Anamnese",
  editorTitle: "MedScoutX — Anamnese-Vorlage",

  heading: "Anamnese-Vorlagen",
  intro: "Konfigurierbare Fragebögen in Abschnitten — mehrsprachig, barrierefrei, praxisgerecht.",
  featureDisabled: "Die Anamnese-Funktion ist für diese Praxis noch nicht aktiviert.",
  backHub: "Zur Praxis-Übersicht",
  backList: "Zur Übersicht",
  selectPractice: "Praxisprofil",

  loading: "Wird geladen …",
  loadError: "Vorlagen konnten nicht geladen werden.",
  loadErrorDisabled: "Die Anamnese-Funktion ist für diese Praxis noch nicht aktiviert. Bitte aktivieren Sie sie in den Praxiseinstellungen oder wenden Sie sich an den Support.",
  loadErrorUnauthorized: "Bitte erneut anmelden.",
  loadErrorServer: "Vorlagen konnten wegen eines Serverfehlers nicht geladen werden. Bitte versuchen Sie es erneut.",
  noTemplatesHint: "Noch keine Anamnese-Vorlagen vorhanden. Erstellen Sie eine neue Vorlage oder nutzen Sie die Standardvorlage.",
  saveError: "Speichern fehlgeschlagen.",
  deleteError: "Löschen fehlgeschlagen.",
  archiveError: "Archivieren fehlgeschlagen.",

  newTemplate: "Neue Vorlage",
  fromStandard: "Aus Standardvorlage erstellen",
  fromStandardCreating: "Wird erstellt …",
  fromStandardError: "Standardvorlage konnte nicht erstellt werden.",
  noTemplates: "Noch keine Vorlagen. Beginnen Sie mit einer leeren Vorlage oder der Standardvorlage.",
  templateCount_one: "{{count}} Vorlage",
  templateCount_other: "{{count}} Vorlagen",

  statusActive: "Aktiv",
  statusArchived: "Archiviert",

  openTemplate: "Öffnen",
  editTemplate: "Bearbeiten",
  archiveTemplate: "Archivieren",
  unarchiveTemplate: "Reaktivieren",
  deleteTemplate: "Löschen",
  confirmDeleteTemplate: "Vorlage wirklich löschen? Alle Abschnitte und Fragen werden entfernt. Besser: Archivieren statt Löschen.",
  confirmArchiveTemplate: "Vorlage archivieren? Sie kann jederzeit reaktiviert werden.",

  // ── Template editor: metadata ──────────────────────────────────────────────
  templateTitle: "Titel der Vorlage",
  templateDescription: "Beschreibung (optional)",
  templateTitlePlaceholder: "z. B. Erstanamnese",

  // ── Edit mode ─────────────────────────────────────────────────────────────
  editModeLabel: "Bearbeitungsmodus",
  editModeHint: 'Änderungen werden erst gespeichert, wenn Sie auf "Speichern" klicken.',
  startEditing: "Vorlage bearbeiten",
  save: "Speichern",
  saving: "Wird gespeichert …",
  saved: "Gespeichert.",
  cancel: "Abbrechen",
  cancelEditConfirm: "Bearbeitung abbrechen? Nicht gespeicherte Änderungen gehen verloren.",

  // ── Sections ──────────────────────────────────────────────────────────────
  sections: "Abschnitte",
  addSection: "Abschnitt hinzufügen",
  sectionTitle: "Abschnittsbezeichnung",
  sectionTitlePlaceholder: "z. B. Aktuelles Anliegen",
  deleteSection: "Abschnitt löschen",
  confirmDeleteSection: "Abschnitt löschen? Alle enthaltenen Fragen werden ebenfalls entfernt.",
  noSections: "Noch keine Abschnitte. Fügen Sie den ersten Abschnitt hinzu.",

  // ── Questions ─────────────────────────────────────────────────────────────
  questions: "Fragen",
  addQuestion: "Frage hinzufügen",
  addStandardQuestion: "Standardfrage einfügen",
  noQuestions: "Noch keine Fragen. Fügen Sie eine Frage hinzu.",
  questionLabel: "Frage / Beschriftung",
  questionHint: "Hinweis / Platzhalter (optional)",
  questionType: "Fragetyp",
  questionRequired: "Pflichtfeld",
  questionOptions: "Antwortoptionen",
  addOption: "Option hinzufügen",
  removeOption: "Option entfernen",
  deleteQuestion: "Frage löschen",
  confirmDeleteQuestion: "Frage wirklich löschen? Besser: Frage deaktivieren oder leer lassen.",
  editQuestion: "Frage bearbeiten",
  doneEditing: "Fertig",
  moveUp: "Nach oben",
  moveDown: "Nach unten",
  requiredBadge: "Pflicht",

  // ── Question types ────────────────────────────────────────────────────────
  type_text: "Kurztext",
  type_textarea: "Freitext (mehrzeilig)",
  type_single_choice: "Einfachauswahl",
  type_multi_choice: "Mehrfachauswahl",
  type_date: "Datum",
  type_number: "Zahl",
  type_yes_no: "Ja / Nein",

  // ── Standard question catalog ─────────────────────────────────────────────
  stdCatalogTitle: "Standardfragen",
  stdQ_hauptbeschwerde: "Hauptbeschwerde",
  stdQ_beschwerden_dauer: "Dauer der Beschwerden",
  stdQ_schmerzstaerke: "Schmerzstärke (0–10)",
  stdQ_schmerzcharakter: "Schmerzcharakter",
  stdQ_vorerkrankungen: "Vorerkrankungen",
  stdQ_operationen: "Frühere Operationen",
  stdQ_krankenhausaufenthalte: "Krankenhausaufenthalte",
  stdQ_medikamente: "Aktuelle Medikamente",
  stdQ_allergien: "Allergien & Unverträglichkeiten",
  stdQ_blutverdünner: "Blutverdünner / Gerinnungshemmer",
  stdQ_schwangerschaft: "Schwangerschaft",
  stdQ_rauchen: "Rauchen",
  stdQ_alkohol: "Alkoholkonsum",
  stdQ_hinweise_praxis: "Hinweise für das Praxisteam",
  stdQ_dolmetscher: "Dolmetscher benötigt?",

  // ── Language tabs ─────────────────────────────────────────────────────────
  lang_de: "Deutsch",
  lang_en: "Englisch",
  lang_fr: "Französisch",
  lang_it: "Italienisch",
  lang_es: "Spanisch",
  languageTab: "Sprache",
  languageTabHint: "Frageübersetzungen bearbeiten — diese Tabs steuern die Sprache der Fragen für den Patienten, nicht die App-Sprache.",

  // ── Roles / read-only ─────────────────────────────────────────────────────
  readOnly: "Nur Lesen — Ihre Rolle erlaubt keine Bearbeitung.",

  // ── Hub card label ────────────────────────────────────────────────────────
  cardAnamnesis: "Anamnese",

  // ── Section/question count ────────────────────────────────────────────────
  sectionCount_one: "{{count}} Abschnitt",
  sectionCount_other: "{{count}} Abschnitte",
  questionCount_one: "{{count}} Frage",
  questionCount_other: "{{count}} Fragen",
};
