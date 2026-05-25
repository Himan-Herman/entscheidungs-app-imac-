export default {
  pageTitle: "My Measurements",
  pageHeading: "My Measurements",
  intro: "Blood pressure, pulse, blood glucose, weight and more — all in one place.",
  disclaimer:
    "Personal overview — not an official medical record. Show your readings to your doctor at appointments.",

  addEntry: "Add measurement",
  noEntries: "No measurements recorded yet.",
  noEntriesHint: "Add your first measurement to start tracking.",
  loadingError: "Could not load measurements.",

  types: {
    blood_pressure: "Blood pressure",
    heart_rate: "Pulse / Heart rate",
    glucose: "Blood glucose",
    weight: "Weight",
    oxygen: "Oxygen saturation",
    temperature: "Body temperature",
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
    elevated: "Elevated",
    low: "Low",
    unknown: "No reference",
  },

  chart: {
    title: "Trend",
    noData: "Not enough data to display a chart.",
    systolic: "Systolic",
    diastolic: "Diastolic",
    value: "Value",
  },

  form: {
    addHeading: "New measurement",
    editHeading: "Edit measurement",
    typeLabel: "Measurement type *",
    typePlaceholder: "Please select …",
    systolic: "Systolic (mmHg) *",
    systolicPlaceholder: "e.g. 120",
    diastolic: "Diastolic (mmHg) *",
    diastolicPlaceholder: "e.g. 80",
    value: "Value *",
    unit: "Unit",
    measuredAt: "Date & time *",
    notes: "Notes (optional)",
    notesPlaceholder: "Circumstances, how you felt, additional notes …",
    save: "Save",
    saving: "Saving …",
    cancel: "Cancel",
    required: "* Required field",
    fieldRequired: "This field is required.",
    dateInvalid: "Invalid date.",
    dateFuture: "Date cannot be in the future.",
    valueInvalid: "Please enter a valid number.",
    valueOutOfRange: "Value is outside the plausible range.",
    saveError: "Failed to save. Please try again.",
  },

  card: {
    measuredAt: "Measured on",
    notes: "Notes",
    edit: "Edit",
    editAria: "Edit measurement",
    delete: "Delete",
    deleteAria: "Delete measurement",
    source: "Source",
    manual: "Manual",
  },

  deleteDialog: {
    heading: "Delete measurement?",
    body: "This entry will be permanently removed. This action cannot be undone.",
    confirm: "Yes, delete",
    cancel: "Cancel",
    deleting: "Deleting …",
    error: "Failed to delete. Please try again.",
  },

  tabs: {
    all: "All",
    blood_pressure: "Blood pressure",
    heart_rate: "Pulse",
    glucose: "Glucose",
    weight: "Weight",
    oxygen: "SpO₂",
    temperature: "Temperature",
  },

  refRanges: {
    blood_pressure: "Normal: < 120/80 mmHg",
    heart_rate: "Normal: 60–100 bpm",
    glucose: "Fasting normal: 70–100 mg/dL",
    weight: "Depends on height (BMI 18.5–24.9)",
    oxygen: "Normal: 95–100 %",
    temperature: "Normal: 36.1–37.2 °C",
  },
};
