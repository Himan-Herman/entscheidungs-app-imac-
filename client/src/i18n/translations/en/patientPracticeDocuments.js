export default {
  pageTitle: "Practice documents – MedScoutX",
  heading: "Practice documents",
  intro: "Documents shared by your practice — for orientation only.",
  safetyNote:
    "These documents were provided by your practice. MedScoutX does not interpret findings or create diagnoses.",
  backHub: "Back to My practice",
  backList: "Back to list",
  detailPageTitle: "Practice document – MedScoutX",
  loading: "Loading…",
  loadError: "Could not load documents.",
  documentNotFound: "Document not found.",
  featureDisabled: "Practice documents are not enabled in this environment.",
  empty: "No shared practice documents yet.",
  listCaption: "Practice documents",
  fromPractice: "Your practice",
  sharedAt: "Shared on {date}",
  openDocument: "Open document",
  download: "Download",
  view: "View document",
  viewDocument: "View document",
  permissionDenied: "You do not have permission to access this document.",
  linkExpired: "The download link has expired.",
  linkRevoked: "The download link has been revoked.",
  secureLinkHint: "Secure links are time-limited.",
  typeReport: "Medical letter / examination result",
  typeLab: "Lab result",
  typeImaging: "Imaging report",
  typeReferral: "Referral",
  typeDischarge: "Discharge letter",
  typePrescriptionInfo: "Prescription information",
  typeOther: "Other",
  statusShared: "Shared",
  filesHeading: "Files",
  noFiles: "No files attached to this document.",
  fileSize: "{size}",
  downloadError: "Download failed.",
  notAvailable: "This document is no longer available.",
  askQuestion: "Ask your practice",
  questionSent: "Your question was sent to the practice.",
  questionError: "Could not send your question.",
  messagesLink: "Go to secure messages",
  translation: {
    heading: "Translate or simplify this document",
    subtitle:
      "Choose a language and a style. The original document stays unchanged.",
    sourceLanguageNote: "Currently intended for German-language practice documents.",

    fileLabel: "Document file",
    filePlaceholder: "Select a file",

    modeLegend: "Style",
    modeStrictName: "Specialist translation",
    modeStrictDescription:
      "Medical terminology and level of detail are preserved.",
    modePlainName: "Plain language",
    modePlainDescription:
      "Same content — clear, without unnecessary jargon.",

    targetLanguageLabel: "Target language",
    targetLanguagePlaceholder: "Select a language",

    hintSameLanguageStrict:
      "For a specialist translation, please choose a different language. To read the document more easily in German, choose \u201cPlain language\u201d.",

    submit: "Create",
    submitBusy: "Creating …",
    statusRunning: "Processing document …",
    retry: "Try again",

    aiNoticeStrict: "AI-generated translation",
    aiNoticePlain: "AI-generated plain-language version",

    resultOriginalFile: "Original file",
    resultMode: "Processing",
    resultSourceLanguage: "Source language",
    resultTargetLanguage: "Target language",
    resultGeneratedAt: "Created on",

    originalAuthoritative:
      "This view was generated automatically from the practice document. The original document remains authoritative.",
    plainNotAdvice: "The plain-language version does not replace medical advice.",

    viewOriginal: "Show original",
    downloadPdf: "Download as PDF",
    pdfUnavailableForLanguage: "PDF export is not yet available for this language.",
    pdfExportFailed:
      "The PDF could not be created. Please try again. The original document remains available unchanged.",
    pdfTitle: "Translation of a practice document",
    pdfFileNameSuffix: "translation",

    errors: {
      generic: "The processing could not be completed. Please try again later.",
      notAvailable: "This function is not available yet.",
      documentNotFound: "This document was not found.",
      documentUnavailable: "This document is no longer available.",
      linkNotActive: "The connection to this practice is no longer active.",
      fileNotFound: "This file was not found.",
      typeNotTranslatable: "This type of document cannot currently be processed.",
      fileTypeUnsupported: "This file type is not currently supported.",
      textUnavailable: "This document contains no reliably readable text.",
      structureUnsupported:
        "The structure of this document cannot currently be processed safely.",
      encrypted: "This document is password-protected and cannot be read.",
      corrupt: "This file could not be read.",
      tooLarge: "This document is too large for automatic processing.",
      sourceLanguageUnsupported:
        "This function is currently only available for German-language practice documents.",
      sourceLanguageUncertain: "The language of this document could not be determined clearly.",
      medicationUnverifiable:
        "This document contains medication details that cannot be processed automatically with sufficient certainty. Please use the original document.",
      dosageUnverifiable:
        "This document contains dosage details that cannot be processed automatically with sufficient certainty. Please use the original document.",
      targetLanguageUnsupported: "This target language is not supported.",
      modeInvalid: "This type of processing is not available.",
      providerUnavailable: "Processing is currently unavailable. Please try again later.",
      rateLimited:
        "A transformation is already running, or too many requests were made. Please wait a moment.",
      timeout: "Processing took too long. Please try again.",
      invalidResponse:
        "The result could not be produced reliably. Please use the original document.",
      integrityFailed:
        "The translation could not be produced reliably. Please use the original document.",
    },
  },
};
