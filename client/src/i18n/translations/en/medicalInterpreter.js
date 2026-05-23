/**
 * Medical Interpreter — B2C patient module (EN).
 * Communication support only; no diagnosis, triage, or treatment recommendations.
 */
export default {
  hub: {
    title: "Live-translate your doctor visit",
    subtitle: "Live translation between patient and doctor/practice",
    cta: "Start interpreter",
    newConversation: "Start new conversation",
    trustLine:
      "Communication support only — no diagnosis or treatment recommendation.",
    privacyLine:
      "Microphone only with your permission. Conversation content stays on this device by default.",
    ariaLabel: "Open translate your doctor visit",
  },

  chrome: {
    moduleTitle: "Translate your doctor visit",
    backToHub: "Back to patient area",
    backToInterpreterHome: "Back to interpreter home",
    backToSetup: "Back to setup",
  },

  safety: {
    strip:
      "Communication support — not a medical assessment, diagnosis, or treatment recommendation.",
    noDiagnosis: "No diagnosis",
    noTriage: "No urgency assessment",
    noTreatment: "No treatment recommendation",
    verifyTranslation:
      "Automatic translations may contain errors. Please verify important content with your care team.",
    communicationOnly:
      "This module supports translation and documentation of conversations — not medical assessment of your situation.",
  },

  start: {
    pageTitle: "MedScoutX — Interpreter setup",
    heading: "Live-translate your doctor visit",
    intro:
      "Set up a live translated conversation between you and your doctor or practice.",
    stepOf: "Step {{current}} of {{total}}",
    back: "Back",
    next: "Continue",
    cancel: "Cancel",
    cancelConfirm: "Cancel setup?",
  },

  languages: {
    heading: "Choose languages",
    intro:
      "Only the two languages are required. You can skip everything else.",
    requiredLegend: "Fields marked with * are required",
    patientLabel: "Your language *",
    doctorLabel: "Care team language *",
    patientHint: "The language you speak",
    doctorHint: "The language the care team speaks",
    required: "Please select both languages.",
    selectEmpty: "Please select",
    loadingDefaults: "Loading default languages …",
    searchLabel: "Find a language",
    searchPlaceholder: "Search by name or code …",
    searchEmpty: "No language matches your search.",
    mixedDirectionNote:
      "This conversation uses both right-to-left and left-to-right languages. Please read each section in its own direction.",
  },

  profile: {
    heading: "Profile for this conversation",
    patientHeading: "Required patient details",
    patientNameLabel: "Patient name *",
    patientNamePlaceholder: "Enter the patient name",
    patientNameHint: "Use the name that should appear on the conversation documentation.",
    patientNameLockedHint: "Profile name is used for this conversation with your explicit consent.",
    patientNameRequired: "Please enter the patient name or use the saved profile name.",
    intro:
      "Optional: use your saved account name and profile details for this conversation documentation.",
    consentLabel: "Use saved profile name for this conversation: {{name}}",
    consentHint:
      "With your consent, saved name and optional contact details can be added to the conversation PDF. No health profile data is used.",
    accountLink: "Edit in account settings",
    loadError:
      "Profile could not be loaded. You can continue without profile data.",
    skipped: "Continue without profile data",
  },

  doctorInfo: {
    heading: "Visit details (optional)",
    intro:
      "These details help with orientation and later documentation. You may leave all fields empty.",
    toggleShow: "Add details",
    toggleHide: "Hide details",
    doctorName: "Clinician name",
    doctorNamePlaceholder: "e.g. Dr. Smith",
    practiceName: "Practice or clinic",
    practiceNamePlaceholder: "Name of facility",
    appointmentDate: "Appointment (date)",
    conversationTitle: "Title for this conversation",
    conversationTitlePlaceholder: "e.g. Follow-up visit",
  },

  privacy: {
    heading: "Notices and consent",
    body1:
      "This module supports translation and documentation of conversations between you and your care team. It does not provide a diagnosis, urgency assessment, or treatment recommendation.",
    body2:
      "Automatic translation and speech recognition may be inaccurate or incomplete. Please verify important content together with your care team.",
    body3:
      "Audio is sent securely for transcription only, processed in memory, and not stored on MedScoutX servers or in this app.",
    body4:
      "Conversation data stays on this device only in Phase 1 (local). No server records are created for conversation content.",
    storageLabel: "Save conversation on this device",
    storageHint:
      "Allows you to continue and reopen on this device. You can delete the conversation later.",
    noStorageWarning:
      "Without saving, this conversation is lost when you leave the page.",
    acceptLabel: "I have read and understood the notices *",
    acceptRequired: "Please confirm the notices.",
    beginCta: "Begin conversation",
    legalLinks:
      "More information is available under Privacy and legal notices.",
    linkPrivacy: "Privacy",
    linkDisclaimer: "Notices",
  },

  live: {
    mockOriginalPatient: "I would like to discuss something important.",
    mockOriginalDoctor: "Please continue in your own words.",
    mockTranslationPreview:
      "Translation preview — translation service will connect in a later version.",
    statusRegion: "Recording status",
    currentTurn: "Current utterance",
  },

  conversation: {
    heading: "Conversation log",
    intro:
      "Speak naturally. After about 2 seconds of silence, the current turn is finalized, translated, spoken aloud, and the next turn can begin.",
    listening: "Listening — speak now",
    waiting: "Waiting for the first utterance …",
    patientLabel: "Patient",
    clinicianLabel: "Care team / clinician",
    translationPending: "…",
    endHint:
      "“End conversation” stops automatic translation. “Download PDF” saves the bilingual log on your device.",
    endingSession: "Ending conversation …",
    preparingPdf: "Preparing PDF …",
  },

  chat: {
    liveTitle: "Live translation",
    empty: "Start speaking — translation appears automatically.",
    listening: "Listening",
    transcribing: "Recognizing",
    translating: "Translating",
    speaking: "Speaking",
    ready: "Ready",
    translation: "Translation",
    end: "End",
    pdf: "PDF",
    delete: "Delete",
  },

  room: {
    pageTitle: "MedScoutX — Live conversation",
    heading: "Live conversation",
    languagesLabel: "{{patient}} ↔ {{doctor}}",
    statusIdle: "Ready",
    statusRecording: "Recording …",
    statusUploading: "Finishing recording …",
    statusTranscribing: "Recognizing speech …",
    statusTranslating: "Translating …",
    statusSimplifying: "Simplifying language …",
    statusSpeaking: "Playing audio …",
    statusReadyForNext: "Ready for the next utterance",
    statusEditingDraft: "Review spoken text before translating",
    statusBlocked: "Translation blocked — please edit the text",
    statusError: "Something went wrong with this turn",
    speakerDirection: "{{source}} → {{target}}",
    turnPatient: "You are speaking",
    turnClinician: "Care team is speaking",
    speakerTogglePatient: "I am speaking",
    speakerToggleClinician: "Care team speaks",
    disclaimerStrip:
      "Communication support — please verify important content with your care team.",
  },

  transcript: {
    heading: "Spoken text",
    placeholder: "Recognized text will appear here after recording.",
    edit: "Edit text",
    saveEdit: "Apply changes",
    confirm: "Confirm text and translate",
    editingHint: "Review the text before it is translated.",
    empty: "No recording in this turn yet.",
    lowConfidenceInput:
      "Speech recognition may be inaccurate. Please review and correct the text before translating.",
    draftSavedHint: "Your draft is saved on this device while you edit.",
  },

  translation: {
    heading: "Translation",
    placeholder: "Translation appears after you confirm the text.",
    empty: "No translation in this turn yet.",
    lowConfidence:
      "Please review: the spoken text may not have been recognized accurately. Clarify important content with your care team.",
    uncertainLabel:
      "Some wording was unclear — the translation may not capture everything. Please confirm important details together.",
    terminologyWarning:
      "Medication names, numbers, units, or negations may need verification. Please check important terms with your healthcare professional.",
    unclearSourceWarning:
      "The original wording sounded unclear. Do not rely on this translation alone for important medical details.",
    languagePairLimited:
      "This language combination is not fully supported in the app. Please verify important terms with your healthcare professional.",
    mixedDirectionSession:
      "Right-to-left and left-to-right languages are used in this conversation. Check each text block carefully.",
    verifyTermsNotice:
      "Automatic translation can be inaccurate. Please verify medication names, dosages, allergies, and other important terms with your healthcare professional.",
    blocked:
      "Translation could not be shown in a safe form. Please rephrase neutrally or discuss directly.",
    replay: "Show translation again",
  },

  speak: {
    listenTranslation: "Play translation",
    listenSimplified: "Play simplified text",
    loading: "Preparing audio …",
    stop: "Stop playback",
    playbackPlaying: "Playing audio",
    playbackStopped: "Playback stopped",
    retry: "Try playback again",
  },

  streamingTts: {
    heading: "Speech playback (near-realtime)",
    experimentalBadge: "Optional — audio never plays automatically.",
    privacyNote:
      "Audio is generated on demand and kept only in memory on this device until you leave the page.",
    enablePreviewPlayback: "Allow playback of preview translation (manual start only)",
    playPreview: "Play preview translation",
    stopPlayback: "Stop playback",
    playPreviewAria: "Play near-realtime preview translation aloud",
    stopPlaybackAria: "Stop speech playback",
    statusLoading: "Preparing speech …",
    statusPlaying: "Playing translation audio",
    statusIdle: "Playback stopped",
    previewDisabledHint:
      "Enable preview playback above to hear the unconfirmed translation.",
    errorGeneric: "Playback could not start. You can try again or continue without audio.",
    staleBlockPlayback:
      "Preview text changed — wait for an updated preview or discard before playing.",
  },

  simplify: {
    action: "Simplify language",
    heading: "Simplified wording",
    note:
      "Language simplification only — not medical advice. Please verify important information with your healthcare professional.",
    hide: "Hide simplified text",
    loading: "Simplifying wording …",
  },

  pushToTalk: {
    record: "Hold to speak",
    recordTap: "Tap to speak",
    stop: "Stop recording",
    recording: "Recording",
    micTest: "Test microphone",
    micTestHint: "Short test — nothing will be translated.",
    micDenied: "Microphone access is not available.",
    micDeniedGuidance:
      "Allow microphone access for this site in your browser settings, then tap “Try microphone again”. You can also type your text in the box above.",
    micRetry: "Try microphone again",
    tooShort: "Recording too short. Please speak a little longer and try again.",
    likelySilent:
      "We could not detect clear speech. Please check your microphone and try again.",
    preparing: "Preparing microphone …",
    stopping: "Finishing recording …",
    maxDurationHint: "Maximum recording length reached. Please stop recording.",
    keyboardHint: "Tip: select the speak button, then press Space or Enter.",
    liveHint:
      "Speak — after about 2 seconds of silence it detects, translates, and keeps listening automatically.",
    disabledDraft:
      "Finish reviewing the current text before starting a new recording.",
    disabledBusy: "Please wait until the current step is finished.",
    disabledOffline: "Recording needs an internet connection.",
  },

  streaming: {
    heading: "Streaming transcript preview (experimental)",
    experimentalBadge: "Optional beta — push-to-talk remains the default and safest mode.",
    privacyNote:
      "Audio is sent in short chunks for transcription only. Nothing is stored on our servers as audio. The transcript stays provisional until you add it as a draft and confirm before translation.",
    pttDefaultNote:
      "For everyday use, continue with push-to-talk above. Start streaming only when you want to try this preview.",
    captionsAria: "Provisional streaming captions",
    captionsEmpty: "No provisional text yet. Start streaming to see captions here.",
    provisionalLabel: "Provisional draft (not confirmed)",
    startButton: "Start streaming preview",
    stopButton: "Stop streaming",
    stopping: "Stopping …",
    cancelButton: "Cancel",
    useAsDraftButton: "Use as draft (edit before translate)",
    startAria: "Start experimental streaming transcript preview",
    stopAria: "Stop streaming transcript preview",
    statusIdle: "Streaming inactive",
    statusConnecting: "Connecting …",
    statusConnected: "Streaming — microphone active",
    statusProcessing: "Processing audio chunk …",
    statusFinalizing: "Finalizing transcript …",
    previewReady: "Streaming finished. Review the text, then use as draft if needed.",
    unsupportedBrowser:
      "Streaming preview is not supported in this browser. Please use push-to-talk.",
    errorGeneric: "Streaming could not continue. Please stop and use push-to-talk.",
    backpressureError:
      "Audio is arriving too quickly. Streaming was stopped — please use push-to-talk or try again more slowly.",
    disabledWhileStreaming: "Finish or stop streaming before using push-to-talk.",
    maxDurationReached:
      "Maximum streaming time reached. Preview was finalized — use as draft or continue with push-to-talk.",
    fallbackToPtt:
      "If preview modes are unavailable, use push-to-talk above — it remains the default.",
  },

  nearRealtime: {
    heading: "Near-realtime translation preview",
    experimentalBadge:
      "Optional preview only — not saved until you confirm a draft turn below.",
    privacyNote:
      "Only the current transcript snippet is sent for translation. No conversation history, no audio, and nothing is stored on the server as a session.",
    notConfirmedLabel: "Preview translation (not confirmed)",
    previewAria: "Provisional near-realtime translation preview",
    previewEmpty:
      "When the streaming transcript stabilizes, a preview translation may appear here.",
    statusIdle: "Near-realtime preview inactive",
    statusWaiting: "Waiting for a stable transcript …",
    statusTranslating: "Generating preview translation …",
    statusReady: "Preview translation ready — not saved",
    confirmRequiredNote:
      "Use “Use as draft” in streaming above, edit if needed, then confirm translation in the transcript panel. Push-to-talk remains the default.",
    discardButton: "Discard preview translation",
    staleWarning:
      "The transcript changed. This preview may no longer match — discard or wait for an updated preview.",
    lowConfidenceWarning:
      "This preview may be uncertain. Please review carefully before confirming.",
    unclearSourceWarning:
      "The source wording was unclear. Edit the transcript before confirming.",
    errorGeneric:
      "Preview translation unavailable. You can continue with push-to-talk and manual translate.",
  },

  history: {
    heading: "Conversation documentation on this device",
    privacyNote:
      "Phase 1: conversations are stored only on this device — not on MedScoutX servers. No audio or microphone recordings are kept. This is orientation and communication documentation, not a medical record. You can delete individual conversations or clear all history below at any time.",
    fallbackTitle: "Conversation {{date}}",
    statusDraft: "Draft",
    statusActive: "Active",
    statusEnded: "Completed",
    continue: "Continue",
    review: "Review",
    rename: "Rename",
    clearAll: "Clear all on this device",
    clearAllConfirm:
      "Delete all interpreter conversations from this device? This cannot be undone.",
    renamePrompt: "Title for this conversation",
    renameTitle: "Rename conversation",
    renameSave: "Save title",
    renamed: "Title updated.",
    deleted: "Conversation deleted.",
    cleared: "All conversations cleared.",
    languagePair: "{{patient}} ↔ {{doctor}}",
    titleWithAppointment: "Conversation on {{date}}",
    titleWithAppointmentPractice: "Conversation on {{date}} · {{practice}}",
    titleWithAppointmentDoctor: "Conversation on {{date}} · {{doctor}}",
    titleWithPractice: "Conversation · {{practice}}",
    titleWithDoctor: "Conversation · {{doctor}}",
    titleLanguagePair: "Translation {{patient}} ↔ {{doctor}}",
    titleUnsafe:
      "This title cannot be used. Please choose a neutral name without medical conclusions or urgency.",
    turnCount: "{{count}} documented turns ({{translated}} translated)",
    searchLabel: "Search conversations on this device",
    searchPlaceholder: "Title, practice, language …",
    searchHintLocal: "Search runs only on this device. Nothing is sent to the server.",
    searchResults: "{{count}} of {{total}} conversations shown",
    noSearchResults: "No conversations match your search.",
  },

  sections: {
    opening: "Conversation start",
    patientStatements: "Patient statements",
    clinicianStatements: "Care team statements",
    closing: "Conversation close",
    middle: "Further exchange",
  },

  pdf: {
    documentTitle: "Medical Interpreter / doctor visit translation",
    documentSubtitle:
      "Conversation documentation · translated conversation record · communication proof",
    legalParagraph1:
      "This documentation supports communication only. It is not a diagnosis, triage, or treatment recommendation.",
    legalParagraph2:
      "It does not contain medical inference, urgency classification, specialist recommendation, or medication advice.",
    legalParagraph3:
      "Automatic transcription and translation may be inaccurate or incomplete.",
    sessionTitleLabel: "Conversation title",
    patientNameLabel: "Patient",
    patientDateOfBirthLabel: "Date of birth",
    patientEmailLabel: "Email",
    patientPhoneLabel: "Phone",
    generatedNote:
      "Generated by MedScoutX · communication support only · automatic transcription/translation may contain errors",
    footerPage: "Page",
    filenamePrefix: "medscoutx-interpreter",
    exportLoading: "Generating PDF …",
    exportSuccess: "PDF downloaded to your device.",
    exportFailed: "PDF could not be created. Please try again.",
    exportNoTurns: "There are no documented turns to export.",
    rtlFontNotice:
      "Note: Some scripts may not display fully in this PDF until extended font support is added.",
    rtlLimitationDetail:
      "PDF export uses standard fonts. Arabic, Farsi, Kurdish (Sorani), and other RTL scripts may appear simplified or misaligned. Use the on-screen review for the most accurate reading.",
    mixedScriptNotice:
      "This document contains mixed writing directions. Please verify wording on screen if anything looks unclear in the PDF.",
  },

  review: {
    pageTitle: "MedScoutX — Conversation documentation",
    heading: "Conversation documentation",
    notMedicalRecord:
      "Orientation and communication documentation only — not a medical record.",
    metadataHeading: "Session details",
    turnsHeading: "Documented turns",
    timelineHeading: "Conversation timeline",
    documentationNotice:
      "Automatic translation can be inaccurate. Please verify medication names, dosages, allergies, and other important terms with your healthcare professional.",
    summaryLine: "{{turns}} documented turns · {{translated}} translated",
    summaryDrafts: "{{count}} draft turn(s) not yet translated",
    summaryTurnsLabel: "Documented turns",
    created: "Started",
    ended: "Ended",
    status: "Status",
    turnNumber: "Turn {{n}}",
    langDirection: "{{source}} → {{target}}",
    originalLabel: "Spoken text",
    translatedLabel: "Translation",
    simplifiedLabel: "Simplified wording",
    turnDraft: "Draft — not yet translated",
    turnBlocked: "Translation not available (safety)",
    turnError: "This turn could not be completed",
    backToList: "All conversations",
  },

  liveSession: {
    subtitle: "Live translation between patient and doctor/practice",
    languagePairLabel: "Active language pair",
    sessionDetails: "Conversation details",
    statusLabel: "Status:",
    statusIdle: "Ready to start live conversation",
    statusListening: "Listening now",
    statusSilenceWaiting: "Short pause detected — finalizing soon",
    statusTranscribing: "Transcribing current turn",
    statusTranslating: "Translating current turn",
    statusSpeaking: "Speaking the translation aloud",
    statusPaused: "Conversation paused",
    statusEnded: "Conversation ended",
    statusError: "An error needs your attention",
    autoModeBadge: "Auto",
    speakerHeading: "Who is speaking now?",
    autoModeHint:
      "After each translation, the other side continues automatically.",
    startButton: "Start",
    pauseButton: "Pause",
    resumeButton: "Resume",
    playbackHeading: "Voice",
    speedHeading: "Voice speed",
    speedNormal: "Normal",
    speedSlow: "Slow",
    replayButton: "Replay translation",
    stopPlaybackButton: "Stop",
    originalLabel: "Original",
    translationForDoctor: "Translation for doctor/practice",
    translationForPatient: "Translation for patient",
    pendingTranslation: "Translation will appear after this turn is processed.",
    noConversationYet: "No documented turns yet. Press start and speak when you are ready.",
    noSpeechDetected: "No speech was detected in that turn. Please try again.",
    noTranscriptResult: "No transcript was returned for this turn. Please try again.",
    readyForNextSpeaker: "Ready for the next speaker.",
    readyForDoctor: "Doctor or practice team speaks now.",
    readyForPatient: "Patient speaks now.",
  },

  confirm: {
    deleteTitle: "Delete conversation?",
    deleteBody:
      "This removes the conversation from this device only. It cannot be undone.",
    clearAllTitle: "Clear all conversations?",
    clearAllBody:
      "Delete all interpreter conversations from this device? This cannot be undone.",
    endTitle: "End conversation?",
    endBody: "The conversation will be marked as completed on this device.",
    endWithDraftBody:
      "You have spoken text that is not yet translated. End the conversation anyway?",
    leaveTitle: "Leave live room?",
    leaveBody:
      "You have spoken text that is not yet confirmed and translated. If you leave now, you can discard it or keep editing.",
    discardDraft: "Discard and leave",
    keepEditing: "Keep editing",
    endAnyway: "End anyway",
    confirmDelete: "Delete",
    confirmClearAll: "Clear all",
    confirmEnd: "End conversation",
    cancel: "Cancel",
  },

  sessionActions: {
    heading: "Conversation",
    end: "End conversation",
    endPreparing: "Ending …",
    endHint: "Conversation marked as completed.",
    ended: "Conversation ended.",
    leave: "Leave room",
    leaveConfirm:
      "Leave conversation? Unsaved content may be lost.",
    delete: "Delete on this device",
    deleteConfirm: "Really delete this conversation from this device?",
    export: "Download PDF",
    exportHint: "Download conversation documentation as a PDF on this device.",
    exportUnavailable: "Add at least one documented turn before exporting.",
  },

  empty: {
    moduleDisabled: "Medical Interpreter is not available right now.",
    noSession: "Conversation not found. Please start a new one.",
    noTurns:
      "No spoken contributions yet. Hold the button to begin.",
    historyEmpty: "No saved conversations on this device yet.",
    setupIncomplete:
      "Please complete setup before entering the live room.",
  },

  cloud: {
    heading: "Optional account backup",
    lead:
      "By default, conversations stay on this device only. You can optionally save an encrypted copy to your MedScoutX account to open on another device.",
    bulletLocalStill:
      "Local-only mode remains available — you do not have to use account backup.",
    bulletWhatStored:
      "Stored content may include conversation text, translations, simplified wording, and session details (languages, title, appointment labels).",
    bulletNoAudio:
      "Audio and microphone recordings are never stored on the server.",
    bulletDeleteAnytime:
      "You can delete one saved copy or all account backup data at any time.",
    bulletNotMedicalRecord:
      "This is conversation documentation for orientation — not a medical record, diagnosis, or treatment plan.",
    acceptLabel:
      "I understand and want to allow encrypted backup to my account when I choose to save a conversation",
    acceptRequired: "Please confirm that you understand account backup.",
    enableAccount: "Enable account backup",
    accountEnabled: "Account backup is enabled. Nothing is uploaded until you choose to save a conversation.",
    revokeConsent: "Stop future account backup",
    revokeHint:
      "Stops new uploads. Existing copies on your account stay until you delete them separately.",
    consentGranted: "Account backup enabled.",
    consentRevoked: "Future account backup stopped.",
    unavailable:
      "Account backup is not available in this environment. Conversations remain on this device only.",
    loading: "Checking account backup availability …",
    setupHeading: "Account backup (optional)",
    setupBody:
      "You can keep using the interpreter with conversations stored only on this device.",
    setupHint:
      "To enable encrypted account backup, go to the conversation list after setup — nothing is uploaded automatically.",
    badgeLocal: "On this device only",
    badgeSynced: "Also saved to account",
    badgeStale: "Device copy newer than account",
    saveToAccount: "Save to account",
    updateSavedCopy: "Update saved copy",
    deleteCloudCopy: "Delete account copy only",
    sessionLocalNote:
      "Deleting on this device and deleting the account copy are separate actions.",
    sessionNeedsConsent: "Enable account backup in the section above to save copies.",
    enableAccountFirst: "Enable account backup before saving to your account.",
    saveNeedsTurns: "Add at least one spoken contribution before saving to your account.",
    saveSuccess: "Conversation saved to your account.",
    updateSuccess: "Account copy updated.",
    deleteCopySuccess: "Account copy deleted. This device copy is unchanged.",
    deleteLocalOnlyBody:
      "Delete this conversation from this device only? The account copy, if any, is not removed.",
    deleteCopyConfirmTitle: "Delete account copy?",
    deleteCopyConfirmBody:
      "Remove the encrypted copy from your account? The copy on this device stays.",
    deleteCopyConfirmAction: "Delete account copy",
    deleteAllHeading: "All account backup data",
    deleteAllBody:
      "Remove every Medical Interpreter conversation stored on your account. Copies on this device are not deleted.",
    deleteAllAction: "Delete all account backup data",
    deleteAllConfirmTitle: "Delete all account backup data?",
    deleteAllConfirmBody:
      "This permanently removes all interpreter conversations from your account. Device copies are not affected.",
    deleteAllConfirmAction: "Delete all account data",
    deleteAllSuccess: "All account backup data deleted.",
    exportHeading: "Export account backup",
    exportBody:
      "Download a JSON file of conversations stored on your account. Audio is not included. Device-only copies are not included unless you saved them to your account.",
    exportAction: "Download JSON export",
    exportSuccess: "Export downloaded.",
    dataControlHeading: "Your interpreter data",
    statusUnavailable: "Account backup is not available here. Conversations stay on this device only.",
    statusSignInRequired: "Sign in to manage account backup for interpreter conversations.",
    statusLocalOnly: "Account backup is off. Conversations on this device are not uploaded unless you enable backup below.",
    statusAccountActive: "Account backup is on. {{count}} conversation(s) have a saved copy on your account.",
    statusConsentNoSessions: "Account backup is on. Nothing is stored on your account until you save a conversation.",
    factLocal: "On this device",
    factLocalBody: "Stays in your browser until you delete it or clear site data.",
    factCloud: "On your account",
    factCloudBody: "Encrypted copy you save manually — optional, never automatic.",
    factAudio: "Audio",
    factAudioBody: "Never stored on the server.",
    consentHistoryHeading: "Consent history",
    historyGranted: "Backup enabled",
    historyRevoked: "Backup stopped",
    scopeNoUser: "Sign in to use account backup.",
    scopeMismatch: "Your login changed. Refresh the page before saving or deleting account data.",
    revokeDialogTitle: "Stop account backup?",
    revokeDialogIntro:
      "Future saves to your account will stop. Choose what to do with copies already stored on your account.",
    revokeKeepTitle: "Keep saved copies on my account",
    revokeKeepBody:
      "Stops new uploads only. You can delete account copies later in this section.",
    revokeDeleteTitle: "Stop backup and delete all account copies",
    revokeDeleteBody:
      "Removes {{count}} saved conversation(s) from your account. Copies on this device are not deleted.",
    revokeDeleteConfirmTitle: "Delete all account copies?",
    revokeDeleteConfirmBody:
      "This permanently removes {{count}} conversation(s) from your account and stops future backup.",
    revokeDeleteConfirmAction: "Delete account copies and stop backup",
    revokeBackToChoices: "Back to choices",
    consentRevokedKeepData: "Account backup stopped. Existing account copies were kept.",
    consentRevokedAndDeleted:
      "Account backup stopped and all account copies were deleted.",
    errors: {
      generic: "Account backup could not be completed. Please try again later.",
      network: "Connection problem. Please try again.",
      unauthorized: "Please sign in to continue.",
      rateLimited: "Too many requests. Please wait a moment.",
      cloudDisabled: "Account backup is not available right now.",
      encryptionUnavailable: "Account backup is not configured on the server.",
      consentRequired: "Account backup consent is required.",
      quotaExceeded: "Account backup limit reached.",
      sessionNotFound: "Saved copy not found on your account.",
      validationRejected: "This conversation could not be saved in its current form.",
    },
  },

  reliability: {
    offlineBanner:
      "You appear to be offline. Voice input and translation are paused until your connection returns.",
    reconnectedBanner: "Connection restored. You can continue when ready.",
    recoveryBody:
      "The last step could not finish. Your text is still here — you can try again.",
    retryAction: "Try again",
    dismissRecovery: "Dismiss",
    errorBoundaryBody:
      "Something went wrong in the interpreter view. Your other areas of the app are unaffected.",
    errorBoundaryBack: "Back to interpreter home",
  },

  errors: {
    moduleDisabled: "This module is not available right now.",
    sessionNotFound: "Conversation not found. Please start again.",
    transcribeFailed: "Speech recognition failed. Please try again.",
    translateFailed: "Translation failed. Please try again.",
    simplifyFailed: "Simplification failed. Please try again.",
    speakFailed: "Playback failed. Please try again.",
    ttsDisabled: "Listen playback is not available right now.",
    rateLimited: "Too many requests. Please wait a moment.",
    network: "Connection problem. Please try again.",
    offline: "You appear to be offline. Please check your connection and try again.",
    transcribeTimeout:
      "Speech recognition took too long. Please try a shorter recording.",
    requestTimeout: "This step took too long. Please try again.",
    speakUnsupported: "Audio playback is not supported in this browser.",
    textTooLong: "Text is too long. Please shorten it.",
    unauthorized: "Please sign in to continue.",
    generic: "Something went wrong. Please try again later.",
  },

  invite: {
    pageTitle: "MedScoutX — Practice invitation",
    heading: "Medical Interpreter at your visit",
    loading: "Checking invitation link…",
    statusAriaPrefix: "Invitation status:",
    statusActive: "Invitation link is valid",
    statusExpired: "Invitation link has expired",
    statusRevoked: "Invitation link is no longer available",
    statusInvalid: "Invitation link is not valid",
    statusUnavailable: "Invitation validation is not available",
    networkError: "Could not verify the invitation. Check your connection and try again.",
    moduleDisabled: "Medical Interpreter is not available right now.",
    practiceLabel: "Practice",
    communicationNotice:
      "Communication support only — not diagnosis, triage, or treatment advice.",
    noticeNoDiagnosis: "No medical diagnosis",
    noticeNoTriage: "No urgency or triage assessment",
    noticeNoTreatment: "No treatment or medication recommendations",
    consentHeading: "Your conversation stays private",
    consentNoAutoShare:
      "Opening this practice link does not share your conversation with the practice.",
    consentExplicitStep:
      "After your conversation ends, you can choose separately whether to share conversation documentation with the practice.",
    consentPatientControl: "You stay in control of what is shared and can revoke access later.",
    languagesHeading: "Choose languages next",
    languagesIntro:
      "On the next screen you choose your language and the care team language before the conversation starts.",
    continueLoggedIn: "Choose languages and continue",
    authRequired: "Sign in to use the Medical Interpreter with this practice link.",
    guestUnsupported:
      "Guest use without an account is not supported for the interpreter yet (needs repo verification). Please sign in or create an account.",
    loginToContinue: "Sign in to continue",
    createAccount: "Create account",
    setupBannerTitle: "Practice link",
    setupBannerBody:
      "You started from an invitation for {practice}. Nothing is shared with the practice until you explicitly consent in a later step.",
    setupPracticePrefill: "Practice name from invitation (you can adjust)",
  },

  practiceShare: {
    heading: "Share with practice (optional)",
    communicationNotice:
      "Communication support only — not a medical record or clinical assessment.",
    intro:
      "You may share a copy of this conversation documentation with {practice}. Audio is never shared.",
    noticeNoAudio: "Audio recordings are not shared with the practice.",
    noticeDocumentation:
      "Only written conversation documentation (original and translated text) may be shared.",
    noticeRevoke: "You can revoke practice access later.",
    noticeNotMedicalRecord: "This is not a medical record.",
    consentLabel:
      "I consent to sharing this conversation documentation with the practice named above.",
    grantButton: "Share documentation with practice",
    granting: "Sharing…",
    grantSuccess: "Practice access granted. You can revoke it from your interpreter settings.",
    grantError: "Could not share with the practice. Try again later.",
    tokenMissing:
      "Open the practice invitation link again to enable sharing from this device.",
  },

  aria: {
    hubCard: "Medical Interpreter in patient area",
    startInterpreter: "Start Medical Interpreter",
    wizardProgress: "Setup progress",
    languagePatient: "Select your language",
    languageDoctor: "Select care team language",
    profileConsent: "Use profile data for this conversation",
    privacyAccept: "Notices read and understood",
    privacyStorage: "Save conversation on this device",
    liveRegion: "Current translation and status",
    transcriptEditor: "Edit spoken text",
    translationRegion: "Translation area",
    speakerRole: "Who is speaking now",
    startRecording: "Start voice input",
    stopRecording: "Stop voice input",
    preparingMic: "Preparing microphone",
    stoppingRecording: "Finishing recording",
    replayTranslation: "Listen to translation",
    replaySimplified: "Listen to simplified text",
    confirmTranscript: "Confirm text and translate",
    simplifyLanguage: "Simplify language of translation",
    simplifiedRegion: "Simplified wording",
    hideSimplified: "Hide simplified wording",
    deleteSession: "Delete conversation on this device",
    exportConversation: "Export conversation",
    endSession: "End conversation",
    leaveRoom: "Leave live room",
    turnList: "Conversation turn history",
    historyList: "Saved conversations on this device",
    reviewMetadata: "Conversation details",
    renameSession: "Rename conversation",
    clearAllHistory: "Clear all interpreter history",
    deleteAllCloudData: "Delete all account backup data",
    exportCloudData: "Download JSON export of account backup conversations",
    searchHistory: "Search saved conversations",
    languageSearch: "Filter conversation languages",
  },
};
