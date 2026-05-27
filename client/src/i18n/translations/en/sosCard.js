export default {
  pageTitle: "Emergency Card — MedScoutX",
  pageHeading: "Emergency Card",
  subtitle: "Key medical information for emergencies — available offline via QR code.",
  disclaimer:
    "Self-reported personal information — not an official medical record. May be incomplete. Consult medical records where possible in an emergency.",
  loadError: "Could not load emergency card.",
  tab_edit: "Edit",
  tab_preview: "Preview",
  tab_qr: "QR Code",

  bloodTypeSection: "Blood Type",
  bloodTypeLabel: "Blood type",
  bloodTypeNone: "Not specified",

  contactsSection: "Emergency Contacts",
  contact1Name: "Contact 1 — Name",
  contact1Phone: "Contact 1 — Phone",
  contact2Name: "Contact 2 — Name",
  contact2Phone: "Contact 2 — Phone",
  contactNamePlaceholder: "e.g. Jane Doe",

  noteSection: "First Responder Note",
  noteLabel: "Note",
  notePlaceholder: "e.g. Pacemaker fitted, insulin-dependent, …",
  noteHint: "Maximum 1000 characters. Do not include diagnoses or treatment recommendations.",

  save: "Save",
  saving: "Saving…",
  saveSuccess: "Saved.",
  saveError: "Failed to save.",

  aiSection: "AI Emergency Summary",
  aiHint:
    "Generates a concise English summary for first responders based on your allergies, diagnoses, and card data. Generated on demand — not fetched automatically.",
  aiGenerate: "Generate summary",
  aiGenerating: "Generating…",
  aiError: "AI summary failed. Please try again later.",
  aiSummaryLabel: "AI Summary",
  aiSummaryUpdated: "Updated",

  qrSection: "Offline QR Code",
  qrHint:
    "Generate a QR code that links directly to your emergency card without requiring a login. Print it or keep it on your phone lock screen.",
  qrGenerate: "Generate QR code",
  qrRegenerate: "Generate new QR code",
  qrRevoke: "Deactivate QR code",
  revokeConfirm: "Permanently deactivate QR code? The existing link will become invalid.",
  generating: "Generating…",

  noData: "No information added yet.",

  allergiesHeading: "Allergies",
  diagnosesHeading: "Diagnoses",

  severities: {
    life_threatening: "Life-threatening",
    severe: "Severe",
    moderate: "Moderate",
    mild: "Mild",
  },
  diagnosisStatuses: {
    active: "Active",
    chronic: "Chronic",
    resolved: "Resolved",
    managed: "Managed",
    uncertain: "Uncertain",
  },

  practice: {
    heading: "Emergency Card",
    disclaimer: "Patient self-reported data — not an official medical record.",
    noConsent: "Patient has not yet granted access to their emergency card.",
    noCard: "No emergency card on file.",
  },
};
