export default {
  pageTitle: "MedScoutX — GOÄ/PKV Plausibility",
  heading: "Billing Plausibility (GOÄ / PKV)",
  backHub: "Back to practice overview",
  selectPractice: "Practice profile",
  loading: "Loading …",
  submitting: "Checking …",
  intro:
    "Automated plausibility check for GOÄ service codes. Identifies potential documentation gaps and unusual combinations. Does not produce a binding billing decision.",
  disclaimer:
    "Notice: This tool provides automated plausibility hints only. It is not a legally binding billing opinion, not medical advice, and not a final reimbursement decision. It does not replace review by qualified billing staff.",

  btnNewReview: "Start new review",
  labelZiffer: "GOÄ code",
  labelFactor: "Factor",
  labelCount: "Count",
  labelContext: "Context (optional)",
  contextPlaceholder:
    "Brief note about the service — no patient data, no diagnosis, no clinical information.",

  btnSubmit: "Check plausibility",
  btnAddRow: "Add row",
  btnRemoveRow: "Remove row",

  statusPending: "Pending",
  statusReviewed: "Reviewed",
  statusDismissed: "Dismissed",

  sectionResult: "Result",
  sectionHistory: "History",

  noReviews: "No reviews yet. Start your first review.",
  aiUnavailable:
    "Automated review not available at the moment. Please review manually.",

  colDate: "Date",
  colZiffernCount: "Codes",
  colStatus: "Status",

  flagLabel: "Note",

  loadError: "Could not load reviews.",
  submitError: "Could not submit request.",
  aiMarked: "Plausibility hint (not legally binding)",

  resultStub:
    "Review request saved. Plausibility hints are listed below.",

  sectionItems: "Reviewed codes",
  catalogueFound: "Found in local catalogue subset",
  catalogueNotFound: "Not in local catalogue subset — manual verification recommended",
  noWarnings: "No hints for this code.",
  itemWarningsLabel: "Hints",

  warnings: {
    unknown_goae_ziffer:
      "GOÄ code not found in local test catalogue — manual verification required.",
    factor_requires_justification:
      "Factor above 2.3 — written justification may be required (§ 5 GOÄ).",
    justification_missing:
      "High factor without justification text — documentation of reason recommended.",
    invalid_factor: "Invalid factor value.",
    invalid_count: "Invalid count value.",
  },

  btnAiReview: "Request AI plausibility hint",
  aiReviewPending: "Requesting AI hint …",
  aiReviewLabel: "AI-assisted note / non-binding",
  aiReviewNonBinding: "This note is not legally binding, not a diagnosis, and not a reimbursement decision.",
  aiReviewFallback: "AI hint currently unavailable. The deterministic review results above remain valid.",
  aiReviewUnavailable: "AI plausibility review is not enabled.",
  aiReviewError: "AI hint could not be requested.",
  aiReviewSuccess: "AI plausibility hint received.",
  aiReviewGeneralNote: "General note",
  aiReviewUncertaintyNote: "Uncertainty note",
  aiReviewRowHints: "Code-level hints",

  manualReviewRecommended: "Manual review by qualified billing staff is recommended.",

  // P5 — compliance/transparency notes
  catalogueSubsetNote:
    "The GOÄ catalogue used is a local test subset. Codes not found here require verification against the current official GOÄ text.",
  dataProcessingNote:
    "Stored data: GOÄ codes, factors, and optional context notes only. No patient identifiers are accepted or stored.",

  featureDisabled: "This module is not currently active.",
  forbidden: "Only owners and administrators have access.",

  backToBillingOverview: "Back to billing overview",
  sessionCreatedAt: "Created:",
  btnOpenSession: "Open",
  btnDismissSession: "Archive review",
  dismissSuccess: "Review archived.",
  dismissError: "Could not archive review. Please try again.",
  detailLoadError: "Could not load review.",
  detailNotFound: "Review not found or unavailable.",

  btnDownloadReport: "Download report",
  reportDownloadPending: "Generating report …",
  reportDownloadError: "Could not download report.",

  catalogueStatus: "Catalogue status",
  catalogueStatusVerified: "Verified",
  catalogueStatusPointsUncertain: "Points not verified",
  catalogueStatusNeedsReview: "Needs review",
  catalogueStatusUnknown: "Catalogue status not specified",
  catalogueSourceReference: "Source reference",

  catalogueBaseLabel: "GOÄ catalogue base",
  catalogueInitialName: "initial / internal, limited",
  catalogueItemsSuffix: "codes",
  catalogueBaseNote: "Not a complete official GOÄ catalogue.",
  catalogueBaseNone: "No active GOÄ catalogue base configured yet.",

  severityInfo: "Info",
  severityWarning: "Notice",
  severityReviewRequired: "Review required",
  ruleCatalogueBaseMissing:
    "No active GOÄ catalogue base configured – checks run against the bundled reference subset.",
  ruleCatalogueBaseInitial:
    "GOÄ catalogue base is initial/limited – hints for orientation only.",
  ruleCodeMissing: "GOÄ code missing in this item.",
  ruleCodeNotFound: "GOÄ code not found in the active catalogue.",
  rulePointsMissing: "No point value stored for this code – please verify.",
  ruleEntryNeedsReview: "Catalogue entry is flagged as needs-review.",
  ruleEntryPointsUncertain: "Point value of this entry is not verified.",
  ruleFactorInvalid: "Factor is not a valid number.",
  ruleFactorBelowMin: "Factor is below the usual minimum (1.0).",
  ruleFactorAboveMax: "Factor exceeds the maximum (§ 5 GOÄ) – please verify.",
  ruleFactorAboveThreshold: "Factor above 2.3 usually requires justification (§ 5 GOÄ).",
  ruleQuantityInvalid: "Quantity is empty, negative or invalid.",

  ruleCheckHeading: "Quick check (not saved)",
  ruleCheckIntro:
    "Check GOÄ positions instantly — entries are not saved. Plausibility hints, not binding billing advice.",
  ruleCheckSubmit: "Check positions",
  ruleCheckChecking: "Checking…",
  ruleCheckResultHeading: "Plausibility check result",
  ruleCheckNoFindings: "No findings — the entries look plausible.",
  ruleCheckEmpty: "Please enter at least one position with a GOÄ code.",
  ruleCheckError: "The plausibility check could not be performed.",
  ruleCheckPosition: "Position",

  errors: {
    rows_required: "At least one GOÄ code is required.",
    ziffer_required: "Code missing in row {{rowIndex}}.",
    factor_required: "Factor missing in row {{rowIndex}}.",
    count_required: "Count missing in row {{rowIndex}}.",
    patient_data_not_accepted:
      "This form does not accept patient data. Please submit GOÄ codes and factors only.",
    feature_disabled: "Feature disabled.",
    forbidden: "Permission denied.",
    practice_not_found: "Practice not found.",
  },
};
