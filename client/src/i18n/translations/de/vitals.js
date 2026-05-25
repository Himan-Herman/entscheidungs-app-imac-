export default {
  pageTitle: "Meine Messwerte",
  pageHeading: "Meine Messwerte",
  intro: "Blutdruck, Puls, Blutzucker, Gewicht und mehr — alles im Blick.",
  disclaimer:
    "Persönliche Übersicht – kein offizieller Befund. Zeige deine Messwerte beim Arzttermin vor.",

  addEntry: "Messung hinzufügen",
  noEntries: "Noch keine Messwerte eingetragen.",
  noEntriesHint: "Füge deine erste Messung hinzu, um den Verlauf zu sehen.",
  loadingError: "Messwerte konnten nicht geladen werden.",

  types: {
    blood_pressure: "Blutdruck",
    heart_rate: "Puls / Herzfrequenz",
    glucose: "Blutzucker",
    weight: "Gewicht",
    oxygen: "Sauerstoffsättigung",
    temperature: "Körpertemperatur",
  },

  units: {
    mmHg: "mmHg",
    bpm: "bpm",
    "mg/dL": "mg/dL",
    "mmol/L": "mmol/L",
    kg: "kg",
    "%": "%",
    "°C": "°C",
  },

  status: {
    normal: "Normal",
    elevated: "Erhöht",
    low: "Zu niedrig",
    unknown: "Kein Richtwert",
  },

  chart: {
    title: "Verlauf",
    noData: "Nicht genug Daten für eine Kurve.",
    systolic: "Systolisch",
    diastolic: "Diastolisch",
    value: "Wert",
  },

  form: {
    addHeading: "Neue Messung",
    editHeading: "Messung bearbeiten",
    typeLabel: "Messgröße *",
    typePlaceholder: "Bitte wählen …",
    systolic: "Systolisch (mmHg) *",
    systolicPlaceholder: "z. B. 120",
    diastolic: "Diastolisch (mmHg) *",
    diastolicPlaceholder: "z. B. 80",
    value: "Wert *",
    unit: "Einheit",
    measuredAt: "Datum & Uhrzeit *",
    notes: "Notizen (optional)",
    notesPlaceholder: "Umstände, Befinden, Hinweise …",
    save: "Speichern",
    saving: "Wird gespeichert …",
    cancel: "Abbrechen",
    required: "* Pflichtfeld",
    fieldRequired: "Dieses Feld ist erforderlich.",
    dateInvalid: "Ungültiges Datum.",
    dateFuture: "Datum darf nicht in der Zukunft liegen.",
    valueInvalid: "Bitte einen gültigen Zahlenwert eingeben.",
    valueOutOfRange: "Wert liegt außerhalb des plausiblen Bereichs.",
    saveError: "Speichern fehlgeschlagen. Bitte erneut versuchen.",
  },

  card: {
    measuredAt: "Gemessen am",
    notes: "Notizen",
    edit: "Bearbeiten",
    editAria: "Messung bearbeiten",
    delete: "Löschen",
    deleteAria: "Messung löschen",
    source: "Quelle",
    manual: "Manuell",
  },

  deleteDialog: {
    heading: "Messung löschen?",
    body: "Dieser Eintrag wird dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht werden.",
    confirm: "Ja, löschen",
    cancel: "Abbrechen",
    deleting: "Wird gelöscht …",
    error: "Löschen fehlgeschlagen. Bitte erneut versuchen.",
  },

  tabs: {
    all: "Alle",
    blood_pressure: "Blutdruck",
    heart_rate: "Puls",
    glucose: "Blutzucker",
    weight: "Gewicht",
    oxygen: "SpO₂",
    temperature: "Temperatur",
  },

  refRanges: {
    blood_pressure: "Normalbereich: < 120/80 mmHg",
    heart_rate: "Normalbereich: 60–100 bpm",
    glucose: "Nüchtern-Normalwert: 70–100 mg/dL",
    weight: "Richtwert je nach Körpergröße (BMI 18,5–24,9)",
    oxygen: "Normalbereich: 95–100 %",
    temperature: "Normalbereich: 36,1–37,2 °C",
  },

  practice: {
    noEntries: "Dieser Patient hat noch keine Messwerte eingetragen.",
    noConsent: "Der Patient hat den Zugriff auf Messwerte noch nicht freigegeben.",
  },
};
