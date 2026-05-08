export default {
  language: {
    pageTitle: "MedScoutX — Prepare for your appointment",
    eyebrow: "Pre-visit",
    title: "Prepare for your appointment",
    explanation:
      "This tool helps you structure your concerns and questions for a medical appointment. It does not provide diagnoses or medical recommendations.",
    trust: "All information is based solely on your own statements.",
    valueProp:
      "Prepare symptoms, medications, documents and questions in a structured way — in your language.",
    languageLabel: "Language you want to use with MedScoutX",
    languageHint:
      "You can provide your information in the language in which you feel most confident.",
    continue: "Continue",
  },
  chrome: {
    backHome: "Back to MedScoutX home",
    moduleLabel: "Prepare doctor visit",
    safety:
      "This module is only for preparing and documenting your information. It does not replace medical advice.",
    navAria: "Pre-Visit navigation",
  },
  chat: {
    pageTitle: "MedScoutX — Pre-visit intake",
    progressTemplate: "Step {{current}} of {{total}}",
    answerPlaceholder: "Your entry…",
    next: "Continue",
    back: "Back",
    changeLanguage: "Change entry language",
    sectionLabelQuestion: "Question",
    sectionLabelAnswer: "Your answer",
    devInsertDemo: "Insert demo information",
    devOnlyNote: "Visible only during local development.",
    adaptiveSeedHint:
      "Describe in your own words what you notice or feel — without trying to diagnose.",
    adaptiveFollowupLabel: "Follow-up for preparation",
    adaptiveSeedRequired: "Please briefly describe what is going on, in your own words.",
    adaptiveAnswerRequired: "Please answer the follow-up briefly.",
    adaptiveBusy: "One moment …",
    adaptiveProgressMeta:
      "Follow-ups for this entry: {{n}} of up to {{max}}",
  },
  review: {
    pageTitle: "MedScoutX — Pre-visit summary",
    title: "Summary of your entries",
    intro:
      "This is how your entries will be used to prepare for your visit. You can still make changes.",
    empty: "not specified",
    edit: "Edit",
    clearField: "Remove entry",
    trustBeforeActions:
      "You can review, edit or delete your information at any time before creating the document.",
    newSession: "Start new session",
    wipeSession: "Delete session completely",
    prepareDocument: "Prepare document",
  },
  document: {
    pageTitle: "MedScoutX — Document preview",
    title: "Prepare document for the doctor",
    explanation:
      "Choose the language in which the structured doctor version should be created.",
    doctorLangLabel: "Language for the doctor version",
    doctorLangHint:
      "Choose the language in which the doctor or practice should read the document.",
    sectionStructured: "Structured doctor version",
    sectionOriginal: "Original patient statements",
    disclaimer:
      "The doctor version is based only on the patient’s statements. No diagnoses, recommendations or urgency assessments are created.",
    empty: "not specified",
    backReview: "Back to review",
    pdfDisabled: "Create PDF",
    pdfLocalNote:
      "The PDF file is created locally in your browser. No data is transmitted.",
    consentCheckbox:
      "I want to save this session locally in this browser so I can view it again later.",
    consentExpl:
      "The session is stored only locally in this browser. No data is transmitted to MedScoutX.",
    saveLocal: "Save session locally",
    saveSuccess: "The session was saved locally.",
    archiveNote:
      "You can delete saved sessions later. This feature does not replace a medical record.",
    historyLink: "View saved sessions",
    consentSectionTitle: "Optional local copy",
    createDoctorVersion: "Create doctor version",
    creatingDoctorVersion: "Creating doctor version …",
    aiError:
      "The doctor version could not be created right now. You can still use the local PDF preview.",
    aiSuccessStatus:
      "The doctor version was created based on your statements.",
    accountSectionTitle: "Save to my account",
    accountConsentCheckbox:
      "I want to save this preparation in my MedScoutX account.",
    accountConsentExpl:
      "This storage is optional. You can view or delete saved preparations later.",
    saveToAccount: "Save to account",
    accountLoginHint:
      "Sign in to save preparations to your account.",
    accountLoginLink: "Sign in",
    accountSaveSuccess:
      "The preparation was saved to your account.",
    accountSaveError:
      "The preparation could not be saved right now.",
    sessionTitleDe: "Arztgespräch-Vorbereitung",
    sessionTitleEn: "Doctor visit preparation",
    viewMyPreparations: "View my preparations",
    mainNavAria:
      "Doctor version, PDF export, return to review",
    structuredRowLabels: {
      appointmentReason: "Current reason for appointment",
      symptomsOwnWords: "Symptoms in patient’s own words",
      onsetAndCourse: "Start and development over time",
      medications: "Current medication",
      preExistingConditions: "Known pre-existing conditions",
      relevantDocuments: "Relevant documents",
      patientQuestions: "Questions for the doctor",
    },
  },
  localHistory: {
    pageTitle: "Saved sessions — Pre-Visit — MedScoutX",
    title: "Locally saved sessions",
    expl:
      "These sessions are stored only in this browser. They were not transmitted to MedScoutX.",
    privacyNote:
      "Locally saved sessions remain only on this device and in this browser.",
    empty: "There are no locally saved sessions.",
    patientLang: "Patient language",
    doctorLang: "Doctor language",
    savedAt: "Saved",
    view: "View",
    delete: "Delete",
    clearAll: "Delete all saved sessions",
    clearConfirm:
      "Permanently delete all locally saved sessions? This cannot be undone.",
    listAriaLabel: "Saved sessions",
  },
  accountHistory: {
    pageTitle: "MedScoutX — My preparations",
    title: "My preparations",
    subtitle:
      "Here you can see the preparations you explicitly saved to your MedScoutX account.",
    loginHint: "Sign in to view saved preparations.",
    loginCta: "Sign in",
    loading: "Loading…",
    loadError:
      "The list could not be loaded right now. Please try again later.",
    empty: "No preparations have been saved to your account yet.",
    patientLang: "Patient language",
    doctorLang: "Doctor language",
    created: "Created",
    statusLabel: "Status",
    open: "Open",
    deleteOne: "Delete",
    deleteAll: "Delete all preparations",
    confirmDeleteAll:
      "Delete all preparations saved to your account? This cannot be undone.",
    privacyNote:
      "Saved preparations can be deleted at any time. This feature does not replace a medical record.",
    defaultTitle: "Doctor visit preparation",
    deleteError: "The preparation could not be deleted right now.",
    deleteAllError: "Preparations could not be deleted right now.",
    statusDraft: "Draft",
    statusPdfCreated: "PDF created",
    statusCompleted: "Completed",
  },
};
