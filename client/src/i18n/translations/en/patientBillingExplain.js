// Patient-facing "Understand your bill" (GOÄ/PKV invoice explainer) — English.
// Non-binding guidance only. No legal advice, no final invoice review, no medical assessment.
const patientBillingExplain = {
  title: "Understand your bill",
  subtitle: "Private invoice (GOÄ/PKV) explained in plain language – non-binding",
  shortDescription:
    "This feature helps you make better sense of a private medical invoice (GOÄ/PKV). You enter the details from your invoice yourself, and we explain the listed items in plain language and point out possible questions to ask. This is non-binding guidance, not a review of your invoice.",

  disclaimerBanner:
    "Non-binding guidance. This feature explains your entries in plain language and points out possible questions. It is not legal advice, not a final invoice review, and not medical information. If anything is unclear, please contact your practice, your private health insurer, or qualified advice.",
  privacyNote:
    "Your entries are not stored permanently and are processed only for the current explanation. Please do not enter names, dates of birth, or diagnoses – the billing details (item code, factor, quantity, amount) or the plain invoice text are sufficient.",
  resultNote:
    "The explanation below refers only to the details you entered. It is non-binding guidance and not an assessment of whether your invoice is correct or complete. You can raise any open points politely with your practice or your private health insurer using the drafts below.",
  footerNote:
    "Non-binding guidance – not legal advice and not a final invoice review. If anything is unclear, please contact your practice, your private health insurer, or qualified advice.",

  inputModeFields: "Fill in fields",
  inputModeText: "Paste invoice text",

  fieldZiffer: "GOÄ item code",
  fieldZifferPlaceholder: "e.g. 1, 3, 250",
  fieldFactor: "Multiplier factor",
  fieldFactorPlaceholder: "e.g. 2.3",
  fieldCount: "Quantity",
  fieldCountPlaceholder: "e.g. 1",
  fieldAmount: "Amount (optional)",
  fieldAmountPlaceholder: "e.g. €21.45",
  fieldNote: "Your note (optional)",
  fieldNotePlaceholder: "e.g. a note from the invoice",
  pasteInvoiceLabel: "Paste invoice text",
  pasteInvoicePlaceholder:
    "Paste the invoice items here – please without names, dates of birth, or diagnoses",

  btnExplain: "Explain entries",
  btnAddRow: "Add another item",
  btnReset: "Reset entries",
  btnDraftPractice: "Create question for the practice",
  btnDraftInsurer: "Create question for the insurer",
  btnCopy: "Copy text",
  btnCopied: "Copied",

  resultHeading: "Explanation of your entries",
  catalogUnknownLabel: "Not in the overview",
  result_noFindings:
    "Based on your entries, no obvious points to question stood out. This is non-binding guidance and not confirmation that the invoice is correct or complete. If you have questions, your practice or your private health insurer will be happy to help.",

  warn_unknown_goae_ziffer:
    "This item code is not included in our reference overview. This does not mean it is inaccurate – it simply cannot be explained here automatically. You can ask your practice about it or check it against the official GOÄ text.",
  warn_invalid_factor:
    "The factor for this item could not be read. Please check the entry (a number, e.g. 2.3).",
  warn_invalid_count:
    "The quantity for this item could not be read. Please check the entry (a whole number of 1 or more).",
  warn_factor_requires_justification:
    "The factor shown is above the usual standard maximum (2.3). A higher factor is possible and is often accompanied by a brief reason. This is a possible point to ask about – not a statement about correctness.",
  warn_justification_missing:
    "No reason for this higher factor is included in your entries. You can politely ask your practice for the reason.",

  error_empty: "Please enter at least one item or some invoice text.",
  error_tooLong: "The text you entered is too long. Please trim it to the billing items.",
  error_tooManyRows: "You entered too many items. Please reduce the number.",
  error_rateLimited: "Too many requests in a short time. Please try again in a few minutes.",
  error_personalData:
    "Please remove personal details such as names, dates of birth, or diagnoses. The billing details are sufficient.",
  error_generic: "That did not work just now. Please try again.",

  draftPractice_subject: "Question about my invoice [invoice number], [invoice date]",
  draftPractice_body:
    "Dear practice team,\n\nThank you for your invoice. I would like to understand it a little better and have a brief question:\n\n- I would appreciate a short explanation of item(s) [code(s)].\n- For [code], a factor of [factor] is listed – could you briefly share the corresponding reason?\n\nI am only looking to understand it better. Thank you for your help.\n\nKind regards\n[Name]",
  draftInsurer_subject: "Reimbursement query – invoice [invoice number], [invoice date]",
  draftInsurer_body:
    "Dear Sir or Madam,\n\nRegarding the attached medical invoice, I have a question about reimbursement:\n\n- Could you confirm whether item(s) [code(s)] are reimbursable under my plan?\n- If any information is missing to process this, please let me know.\n\nThank you for your assistance.\n\nKind regards\n[Name], policy number: [number]",

  entryCardTitle: "Understand your bill",
  entryCardSubtitle: "Private invoice (GOÄ/PKV) explained in plain language – non-binding",
  backToDocuments: "Back to practice documents",
};

export default patientBillingExplain;
