export default {
  sharedData: {
    title: "Shared data",
    description:
      "Documents you have deliberately released to another practice. You can withdraw any release at any time.",
    empty: "You have not released any document to another practice yet.",
    listLabel: "Your document releases",
    loading: "Loading releases …",
    loadError: "Your releases could not be loaded.",
    retry: "Try again",
  },

  fields: {
    document: "Document",
    sourcePractice: "Originating practice",
    targetPractice: "Receiving practice",
    status: "Status",
    grantedAt: "Released on",
    revokedAt: "Withdrawn on",
    expiresAt: "Valid until",
  },

  status: {
    active: "Active",
    revoked: "Withdrawn",
    expired: "Expired",
  },

  share: {
    action: "Share with a practice",
    dialogTitle: "Share document with a practice",
    selectPractice: "Select practice",
    selectPlaceholder: "Please choose",
    readOnlyNotice:
      "The selected practice receives read access to this document only. It cannot change, delete or pass it on.",
    readOnly: "Read access",
    confirm: "Share",
    cancel: "Cancel",
    submitting: "Sharing …",
    success: "Shared successfully.",
    noOtherPractice:
      "There is no other active practice you could share this document with.",
    alreadyShared: "This document is already shared with this practice.",
    ariaLabel: "Share document {document} with {practice}",
  },

  revoke: {
    action: "Withdraw release",
    dialogTitle: "Withdraw release",
    confirm: "Withdraw",
    cancel: "Cancel",
    submitting: "Withdrawing …",
    success: "Withdrawn successfully.",
    notice:
      "After withdrawal the receiving practice can no longer open or download the document through MedScoutX.",
    externalCopies:
      "Copies already stored outside MedScoutX cannot be recalled automatically.",
    ariaLabel: "Withdraw the release of document {document} for {practice}",
  },

  practiceView: {
    sharedByPatient: "Released by the patient",
    origin: "Origin: {practice}",
    readOnlyHint:
      "Read access. This document belongs to another practice and was released by the patient.",
  },

  errors: {
    document_not_found: "The document is not available.",
    link_not_found: "This practice connection is not available.",
    link_not_active: "This practice connection is not active.",
    document_already_available_to_practice:
      "This document already comes from that practice.",
    share_already_active: "This document is already shared with this practice.",
    grant_not_found: "This release is not available.",
    unsupported_field: "The request contained unexpected fields.",
    forbidden: "You do not have permission to do this.",
    server_error: "Something went wrong. Please try again later.",
  },
};
