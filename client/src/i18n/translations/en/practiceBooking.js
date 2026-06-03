export default {
  pageTitle: "MedScoutX — Appointments & Requests",

  heading: "Appointments & Requests",
  intro: "Manage and configure incoming appointment requests from patients.",
  featureDisabled: "The appointment requests feature is not yet enabled for this practice.",
  backHub: "Back to Practice Hub",
  selectPractice: "Practice profile",

  loading: "Loading …",
  loadError: "Could not load settings.",
  loadErrorUnauthorized: "Please sign in again.",
  loadErrorServer: "Could not load settings due to a server error.",
  saveError: "Save failed.",

  // ── Activation ──────────────────────────────────────────────────────────────
  sectionActivation: "Activation",
  bookingEnabledLabel: "Enable appointment requests",
  bookingEnabledHint: "When enabled, patients can submit appointment requests via MedScoutX.",
  bookingEnabledOn: "Enabled",
  bookingEnabledOff: "Disabled",

  // ── Mode ────────────────────────────────────────────────────────────────────
  sectionMode: "Request mode",
  bookingModeLabel: "Request type",
  bookingMode_disabled: "Disabled",
  bookingMode_medscoutx_request: "Internal request (MedScoutX)",
  bookingModeHint: "When the feature is active, only the internal MedScoutX request is used.",

  // ── Request form note ────────────────────────────────────────────────────────
  sectionRequestNote: "Note for patients",
  requestFormNoteLabel: "Note text (optional)",
  requestFormNotePlaceholder: "e.g. Please indicate whether this is a first or follow-up appointment.",
  requestFormNoteHint: "This text is shown to patients when filling in the request (max. 300 characters).",
  requestFormNoteCharsLeft: "{{n}} characters remaining",

  // ── Anamnesis link ──────────────────────────────────────────────────────────
  sectionAnamnesis: "Linked anamnesis form",
  linkedAnamnesisLabel: "Anamnesis link (optional)",
  linkedAnamnesisPlaceholder: "Enter link ID",
  linkedAnamnesisHint: "Patients submitting an appointment request will be asked to complete this anamnesis questionnaire.",
  linkedAnamnesisNone: "No link connected",
  linkedAnamnesisRemove: "Remove link",

  // ── Save ────────────────────────────────────────────────────────────────────
  save: "Save",
  saving: "Saving …",
  saved: "Saved.",
  cancel: "Cancel",

  // ── Roles / read-only ────────────────────────────────────────────────────────
  readOnly: "Read only — your role does not allow changes.",

  // ── Hub card label ───────────────────────────────────────────────────────────
  cardBooking: "Appointments & Requests",

  // ── Error detail ────────────────────────────────────────────────────────────
  errorBookingModeConflict: "The selected mode is only available when appointment requests are enabled.",
  errorAnamnesisLinkNotFound: "Anamnesis link not found.",
  errorAnamnesisLinkInactive: "Anamnesis link is inactive.",
  errorAnamnesisLinkExpired: "Anamnesis link has expired.",
};
