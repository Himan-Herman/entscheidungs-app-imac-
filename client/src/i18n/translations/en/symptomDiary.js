// Patient symptom diary ("Symptom history") — English.
// Documentation only. No diagnosis, therapy, triage, or urgency.
const symptomDiary = {
  tabName: "Symptom history",
  addTitle: "Add symptom entry",
  editTitle: "Edit symptom entry",

  privacyNote:
    "Your entries are saved in your health record and can be deleted by you at any time. This feature is for documentation only — it does not provide a diagnosis or treatment advice.",

  addBtn: "Add entry",
  save: "Save",
  saving: "Saving…",
  cancel: "Cancel",
  edit: "Edit",
  delete: "Delete",

  loading: "Loading…",
  loadingError: "Entries could not be loaded.",
  empty: "No symptoms documented yet.",
  emptyHint: "Track complaints over time so you have them ready for your doctor's visit.",
  confirmDelete: "Really delete this symptom entry?",

  symptomLabel: "Symptom / complaint",
  symptomPlaceholder: "e.g. headache, nausea, back pain",
  severityLabel: "Intensity (0–10)",
  occurredAtLabel: "Date / time",
  durationLabel: "Duration (optional)",
  durationPlaceholder: "e.g. 2 hours, since yesterday",
  bodyRegionLabel: "Body area (optional)",
  bodyRegionPlaceholder: "e.g. forehead, lower back",
  triggerLabel: "Trigger (optional)",
  triggerPlaceholder: "e.g. after eating, stress",
  betterWithLabel: "Better with (optional)",
  betterWithPlaceholder: "e.g. rest, warmth",
  worseWithLabel: "Worse with (optional)",
  worseWithPlaceholder: "e.g. movement, light",
  measuresLabel: "Medication / measures (optional)",
  measuresPlaceholder: "e.g. pain reliever, drank water",
  notesLabel: "Note (optional)",
  notesPlaceholder: "Additional details…",

  error_symptomRequired: "Please enter a symptom or complaint.",
  error_occurredAtRequired: "Please enter the date and time.",
  error_generic: "That did not work just now. Please try again.",
};

export default symptomDiary;
