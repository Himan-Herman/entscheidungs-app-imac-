/** Medical Interpreter — B2B practice/clinic UI (Phase 4.2+). */
export default {
  chrome: {
    moduleTitle: "Interpreter for practices",
    backToPractice: "Back to practice hub",
    backToInterpreter: "Back to interpreter",
  },
  safety: {
    communicationOnly:
      "Communication support only — not diagnosis, triage, or treatment advice.",
  },
  hubCard: {
    title: "Medical Interpreter",
    description:
      "Multilingual communication support for visits. No patient conversations are shown until a patient chooses to share.",
    badge: "Communication only",
    ariaLabel: "Open Medical Interpreter for this practice",
  },
  hub: {
    pageTitle: "Medical Interpreter — Practice",
    heading: "Medical Interpreter",
    intro:
      "Help patients and clinicians communicate across languages during visits. Patient sessions stay under patient control until they choose to share.",
    placeholder: "Practice interpreter features are being prepared.",
    openDashboard: "Open dashboard",
    openInvites: "Manage invitation links",
  },
  invites: {
    pageTitle: "Interpreter invites — Practice",
    heading: "Invitation links",
    intro:
      "Create secure links or QR codes for patients to open the interpreter in your practice context. Patient join and sharing are not active yet.",
    navAria: "Interpreter invites navigation",
    backToDashboard: "Back to dashboard",
    actionsHeading: "Create invite",
    placeholderNote:
      "Patients can open links to start the interpreter. Conversation text is shared only after explicit patient consent.",
    copyLink: "Copy link",
    copySuccess: "Link copied to clipboard.",
    copyError: "Could not copy link.",
    qrHeading: "QR code",
    qrAlt: "QR code for invitation link",
    qrFallback: "If the QR code does not work, use the text link above.",
    generateButton: "Generate invitation link",
    generating: "Creating…",
    managePermissionRequired:
      "Your role cannot create or revoke invites. Ask a practice administrator.",
    createdHeading: "New invitation link",
    createdOnceWarning:
      "Copy this link now. The full token cannot be shown again after you leave this page.",
    listHeading: "Invitation links",
    listLoading: "Loading invitation links…",
    listEmpty: "No invitation links yet.",
    unnamedInvite: "Invitation link",
    expiresLabel: "Expires",
    statusActive: "Active",
    statusRevoked: "Revoked",
    statusExpired: "Expired",
    statusUnknown: "Unknown",
    statusBadgeAria: "Status: {status}",
    revokeButton: "Revoke link",
    revokeDialogTitle: "Revoke invitation link?",
    revokeDialogBody:
      "Patients will no longer be able to use this link. This cannot be undone.",
    revokeDialogCancel: "Cancel",
    revokeDialogConfirm: "Revoke",
  },
  dashboard: {
    pageTitle: "Interpreter dashboard — Practice",
    heading: "Interpreter dashboard",
    intro:
      "Organizational overview for interpreter communication support at your practice. No patient conversations are listed here yet.",
    placeholder: "Loading dashboard…",
    navAria: "Interpreter dashboard navigation",
    overview:
      "This area is for practice workflow only. Patients keep control of their interpreter sessions until they choose to share.",
    cardsHeading: "Overview",
    cardStatusTitle: "Interpreter status",
    statusLoading: "Checking status",
    statusLoadingDetail: "Loading practice interpreter availability.",
    statusOff: "Practice layer off",
    statusOffDetail: "Medical Interpreter for practices is not enabled on the server.",
    statusModuleOffDetail:
      "The interpreter module is not enabled. Contact your administrator if you expected access.",
    statusActive: "Available",
    statusActiveDetail:
      "Your practice can use interpreter tools. Session lists will appear after patients choose to share.",
    statusLimited: "Limited access",
    statusLimitedDetail:
      "Your role does not include full interpreter access for this practice.",
    cardSessionsTitle: "Future practice sessions",
    cardSessionsBody:
      "Shared interpreter conversations will be listed here when patients grant consent. Nothing is shown automatically.",
    cardSessionsMeta: "View shared sessions",
    openSessions: "Shared conversation documentation",
    cardConsentTitle: "Consent required",
    cardConsentBody:
      "Practice staff cannot view interpreter conversation text without explicit patient consent. Consent is recorded separately from general care relationship settings.",
    cardSafetyTitle: "Communication support only",
    cardSafetyBody:
      "This tool supports language and communication during visits. It does not provide diagnosis, triage, treatment advice, or medication guidance.",
    futureSessionsHeading: "Practice sessions",
    futureSessionsIntro:
      "When available, sessions shared by patients will appear in this list with date and language metadata only.",
    futureSessionsEmptyTitle: "No shared sessions yet",
    futureSessionsEmptyBody:
      "When a patient shares documentation, it appears in the sessions list with metadata and translated text.",
    privacyHeading: "Privacy and boundaries",
    privacyNoDiagnosis: "No diagnosis or clinical assessment.",
    privacyNoTriage: "No urgency or triage classification.",
    privacyNoTreatment: "No treatment or medication recommendations.",
    privacyNoHiddenAccess: "No hidden access to patient interpreter data.",
    privacyPatientControl: "Patients control sharing and can revoke access.",
    openInvites: "Invitation links",
  },
  sessions: {
    pageTitle: "Interpreter sessions — Practice",
    heading: "Shared conversation documentation",
    intro:
      "Sessions appear here only after a patient explicitly consents to share. This is not a medical record.",
    navAria: "Interpreter sessions navigation",
    backToDashboard: "Back to dashboard",
    loading: "Loading shared sessions…",
    empty: "No shared sessions yet. Patients control when documentation is shared.",
    sharedBadge: "Shared with consent",
    languageUnknown: "Languages not listed",
  },
  sessionDetail: {
    pageTitle: "Conversation documentation — Practice",
    heading: "Conversation documentation",
    documentationLabel: "Translated conversation record (communication support)",
    navAria: "Session documentation navigation",
    backToList: "Back to sessions",
    loading: "Loading documentation…",
    loadError: "This documentation is not available or consent was revoked.",
    turnsHeading: "Conversation turns",
    speakerPatient: "Patient",
    speakerDoctor: "Care team",
  },
  empty: {
    moduleDisabled: "Medical Interpreter for practices is not enabled.",
    serverDisabled: "Practice interpreter is not available on the server.",
    missingPracticeContext:
      "Select a practice profile from the practice overview first, then open Medical Interpreter.",
    permissionUnavailable:
      "Your role does not include access to Medical Interpreter for this practice.",
  },
};
