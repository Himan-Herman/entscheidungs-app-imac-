/** Exit, closure and deletion-request workflows (patient + practice). */
export default {
  patient: {
    dangerTitle: "Delete account",
    dangerIntro:
      "Deleting your MedScoutX account is permanent and cannot be undone. Before you delete, please read what will be deleted — and what may not be.",
    whatDeletedTitle: "What will be deleted",
    whatDeletedItems: [
      "Your personal MedScoutX account",
      "The patient data you stored in MedScoutX",
      "Your personal connections to practices",
      "Your personal shares and access tokens",
      "Your personal settings and sessions",
    ],
    whatRemainsTitle: "What may not be deleted",
    whatRemainsItems: [
      "Documentation created by a practice itself",
      "Copies already downloaded or exported",
      "Data stored outside MedScoutX",
      "Data a practice must retain due to its own obligations",
    ],
    whatRemainsNote:
      "MedScoutX cannot delete data on third-party systems. Practices may be subject to their own retention and documentation obligations.",
    exportHint:
      "Recommendation: download a copy of your data before deleting (see the \"Data export\" section above). After deletion no export is possible any more.",
    receiptHint:
      "After deletion you will receive a written confirmation with a case number at your registered e-mail address.",
    openDialogButton: "Delete account …",
    ownerNoticeTitle: "You own a practice",
    ownerNotice:
      "At least one practice is connected to your account. Before your account can be deleted, you must decide what happens to the practice.",
    ownerManageButton: "Manage practice",
    dialogTitle: "Permanently delete your account?",
    dialogWarning:
      "This action cannot be undone. Your account and the patient data you stored in MedScoutX will be permanently deleted.",
    checkboxLabel:
      "I understand which data will be deleted and which records may remain with my practices.",
    phraseLabel: "Type exactly this phrase to confirm:",
    phraseExpected: "DELETE MY ACCOUNT PERMANENTLY",
    phraseMismatch: "The phrase you entered does not match.",
    confirmButton: "Permanently delete my account now",
    cancelButton: "Cancel",
    deleting: "Deleting account …",
    successTitle: "Your account has been deleted",
    successBody:
      "Your MedScoutX account has been permanently deleted. Your case number: {caseNumber}",
    successEmailHint:
      "A written confirmation has been queued for your registered e-mail address. Records held by your practices or copies already exported may remain outside MedScoutX.",
    supportLabel: "Contact:",
    errorGeneric: "The deletion could not be completed. Your account was not changed.",
    errorOwnerBlocked:
      "At least one practice is connected to your account. Account deletion is currently not automatic for practice owners — please decide what happens to the practice first.",
    errorContextBlocked:
      "The deletion could not be completed safely and was rolled back completely. Your account is unchanged. Please contact support.",
  },
  practice: {
    sectionTitle: "Membership and practice status",
    sectionIntro:
      "Pause or close your practice here, reactivate it, or request permanent deletion. Only the practice owner can perform these actions.",
    statusLabel: "Current status",
    status: {
      active: "Active",
      suspended: "Temporarily paused",
      closed: "Closed",
      reactivation_requested: "Reactivation requested",
      deletion_requested: "Permanent deletion requested",
    },
    statusBanner: {
      suspended:
        "Your practice is paused. Operative access has ended; stored data remains protected.",
      closed:
        "Your practice is closed. Operative access has ended. A reactivation can be requested.",
      reactivation_requested:
        "Your reactivation request has been submitted to MedScoutX and is under review. You will receive a written reply.",
      deletion_requested:
        "Your permanent deletion request has been registered. Nothing has been deleted yet — MedScoutX first reviews retention and documentation obligations.",
    },
    pauseTitle: "Temporarily pause the practice",
    pauseBody:
      "The practice remains stored and can be reactivated later. Operative access is ended temporarily.",
    pauseRecommendedTitle: "Recommended for:",
    pauseRecommended: [
      "a temporary break",
      "holidays or restructuring",
      "payment arrears",
      "a later return to MedScoutX",
    ],
    pauseButton: "Pause practice …",
    pauseConfirmTitle: "Temporarily pause the practice?",
    pauseConfirmBody:
      "Your team's operative access ends immediately. Patient data is not deleted. You can reactivate the practice yourself at any time.",
    closeTitle: "Close the practice at MedScoutX",
    closeBody:
      "The membership ends. The practice can no longer work operatively. Retained data remains protected, and a later reactivation can be requested.",
    closeRecommendedNote:
      "Recommended when the practice wants to leave MedScoutX without ruling out a later return.",
    closeButton: "Close practice …",
    closeConfirmTitle: "Close the practice at MedScoutX?",
    closeConfirmBody:
      "All team sessions and access end. No new patient connections or shares are possible. The practice is not deleted; a later reactivation can be requested.",
    reactivateTitle: "Reactivate the practice",
    reactivateBody:
      "Ends the pause after a security confirmation. Previously revoked consents, withdrawn shares and removed team accounts are not restored automatically.",
    reactivateButton: "Reactivate practice …",
    reactivateConfirmTitle: "Reactivate the practice?",
    reactivateConfirmBody:
      "Your practice becomes operative again. Afterwards, please review your current team and permission structure — earlier revocations remain in place.",
    requestReactivateTitle: "Request reactivation",
    requestReactivateBody:
      "A closed practice can only be reactivated by MedScoutX. The request is sent to MedScoutX; you will receive a written acknowledgement.",
    requestReactivateButton: "Request reactivation …",
    requestReactivateConfirmTitle: "Request reactivation from MedScoutX?",
    requestReactivateConfirmBody:
      "MedScoutX reviews your request and replies in writing. Former patient shares, revoked consents and team accounts are not reactivated automatically.",
    deleteTitle: "Request permanent deletion",
    deleteWarning:
      "A permanent deletion cannot be undone. Retention, documentation and data-protection obligations must be reviewed before deletion.",
    deleteBody:
      "This option does not delete immediately. A written request with a case number is created; deletion stays technically locked until MedScoutX has reviewed and approved the request.",
    deleteButton: "Request permanent deletion …",
    deleteConfirmTitle: "Request permanent deletion?",
    deleteConfirmBody:
      "Operative access ends and a written deletion request is created. Nothing is deleted until MedScoutX has completed its review.",
    reasonLabel: "Factual reason (optional, no medical content)",
    passwordLabel: "Confirm with your password",
    passwordHelp:
      "For security reasons you must re-authenticate with your password for this action.",
    dialogConfirm: "Confirm",
    dialogCancel: "Cancel",
    working: "Working …",
    receiptHint:
      "For each of these actions you receive a written confirmation with a case number at your registered e-mail address.",
    afterRequestTitle: "Deletion request registered",
    afterRequestBody:
      "Your request has been registered. Nothing has been deleted yet. Your case number: {caseNumber}",
    emailConfirmHint:
      "Please additionally confirm your request by e-mail to {supportEmail}.",
    openMailButton: "Open e-mail to MedScoutX",
    mailNotSentNote:
      "Note: opening your e-mail client is not a proof of sending. The request only counts as confirmed once your e-mail has actually been sent.",
    copyCaseButton: "Copy case number",
    copySubjectButton: "Copy subject",
    copied: "Copied.",
    copyFailed: "Copying failed — please copy manually.",
    caseListTitle: "Cases",
    mailSubject: "Permanent deletion of my practice – request {requestId}",
    mailBody:
      "Dear MedScoutX team,\n\nI hereby confirm the permanent deletion request for my practice at MedScoutX.\n\nPractice: {practiceName}\nRequest ID: {requestId}\nRegistered e-mail address: {ownerEmail}\n\nI am aware that the deletion will only be carried out after a review of possible retention and documentation obligations.\n\nKind regards\n{ownerName}",
    supportLabel: "Official contact address:",
    errors: {
      practice_lifecycle_transition_invalid:
        "This status change is not possible in the current state.",
      practice_owner_required: "Only the practice owner can perform this action.",
      practice_already_suspended: "The practice is already paused.",
      practice_already_closed: "The practice is already closed.",
      reactivation_already_requested: "A reactivation request is already pending.",
      deletion_already_requested: "An active deletion request already exists.",
      confirmation_required: "Please confirm the action with your correct password.",
      unsupported_field: "The request contained unexpected fields and was rejected.",
      email_delivery_pending:
        "The written confirmation will be delivered as soon as sending is possible.",
      practice_deletion_locked:
        "Permanent deletion is technically locked until MedScoutX has reviewed and approved your request.",
      generic: "The action could not be performed. Nothing was changed.",
    },
  },
};
