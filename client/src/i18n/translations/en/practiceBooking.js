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

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  tabSettings: "Settings",
  tabRequests: "New Requests",

  // ── Requests list ─────────────────────────────────────────────────────────────
  reqLoading: "Loading requests …",
  reqLoadError: "Could not load requests.",
  reqEmpty: "No new appointment requests.",
  reqRefresh: "Refresh",

  // ── Request card fields ───────────────────────────────────────────────────────
  reqWishedTime: "Requested time",
  reqType: "Appointment type",
  reqNote: "Patient note",
  reqCreated: "Received on",

  // ── Status badges ─────────────────────────────────────────────────────────────
  reqBadge_requested: "New request",
  reqBadge_confirmed: "Confirmed",
  reqBadge_cancelled: "Declined",
  reqBadge_scheduled: "Scheduled",
  reqBadge_completed: "Completed",
  reqBadge_no_show: "No-show",
  reqBadge_rescheduled: "Rescheduled",

  // ── Actions ───────────────────────────────────────────────────────────────────
  reqAccept: "Accept",
  reqDecline: "Decline",

  // ── Accept form ───────────────────────────────────────────────────────────────
  reqAcceptHeading: "Confirm appointment",
  reqAcceptStart: "Appointment from",
  reqAcceptEnd: "Appointment until",
  reqAcceptPracticeNote: "Internal note (optional)",
  reqAcceptPracticeNotePlaceholder: "Visible to practice staff only.",
  reqAcceptConfirm: "Confirm appointment",
  reqAcceptInvalidTime: "Please enter a valid start and end time.",
  reqAcceptError: "Could not confirm the request.",
  reqAccepted: "Appointment confirmed.",

  // ── Decline form ──────────────────────────────────────────────────────────────
  reqDeclineHeading: "Decline request",
  reqDeclineReason: "Reason for decline (optional)",
  reqDeclineReasonPlaceholder: "Organisational notes only — no medical details.",
  reqDeclineHint: "Please do not enter any medical details.",
  reqDeclineConfirm: "Decline request",
  reqDeclineError: "Could not decline the request.",
  reqDeclined: "Request declined.",

  // ── Request misc ──────────────────────────────────────────────────────────────
  reqErrorNotARequest: "This request can no longer be processed.",
  reqReadOnly: "Read only — actions not available.",
};
