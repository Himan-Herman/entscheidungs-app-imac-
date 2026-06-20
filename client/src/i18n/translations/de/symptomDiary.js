// Patient symptom diary ("Symptom-Verlauf") — German.
// Documentation only. No diagnosis, therapy, triage, or urgency.
const symptomDiary = {
  tabName: "Symptom-Verlauf",
  addTitle: "Symptom-Eintrag hinzufügen",
  editTitle: "Symptom-Eintrag bearbeiten",

  privacyNote:
    "Ihre Angaben werden in Ihrer Gesundheitsakte gespeichert und können von Ihnen jederzeit gelöscht werden. Diese Funktion dient nur der Dokumentation – sie stellt keine Diagnose und gibt keine Behandlungsempfehlung.",

  addBtn: "Eintrag hinzufügen",
  save: "Speichern",
  saving: "Speichern…",
  cancel: "Abbrechen",
  edit: "Bearbeiten",
  delete: "Löschen",

  loading: "Lädt…",
  loadingError: "Einträge konnten nicht geladen werden.",
  empty: "Noch keine Symptome dokumentiert.",
  emptyHint: "Halten Sie Beschwerden über die Zeit fest, um sie beim Arztgespräch parat zu haben.",
  confirmDelete: "Diesen Symptom-Eintrag wirklich löschen?",

  symptomLabel: "Symptom / Beschwerde",
  symptomPlaceholder: "z. B. Kopfschmerzen, Übelkeit, Rückenschmerzen",
  severityLabel: "Stärke (0–10)",
  occurredAtLabel: "Datum / Uhrzeit",
  durationLabel: "Dauer (optional)",
  durationPlaceholder: "z. B. 2 Stunden, seit gestern",
  bodyRegionLabel: "Körperstelle (optional)",
  bodyRegionPlaceholder: "z. B. Stirn, unterer Rücken",
  triggerLabel: "Auslöser (optional)",
  triggerPlaceholder: "z. B. nach dem Essen, Stress",
  betterWithLabel: "Besser durch (optional)",
  betterWithPlaceholder: "z. B. Ruhe, Wärme",
  worseWithLabel: "Schlechter durch (optional)",
  worseWithPlaceholder: "z. B. Bewegung, Licht",
  measuresLabel: "Medikamente / Maßnahmen (optional)",
  measuresPlaceholder: "z. B. Schmerzmittel, Wasser getrunken",
  notesLabel: "Notiz (optional)",
  notesPlaceholder: "Weitere Hinweise…",

  error_symptomRequired: "Bitte geben Sie ein Symptom oder eine Beschwerde ein.",
  error_occurredAtRequired: "Bitte geben Sie Datum und Uhrzeit an.",
  error_generic: "Das hat gerade nicht funktioniert. Bitte versuchen Sie es erneut.",
};

export default symptomDiary;
