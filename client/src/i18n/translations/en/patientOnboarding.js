/**
 * Patient onboarding: the practice creates a local record, invites, and the
 * patient connects their own account.
 *
 * The wording says "connect", never "share": connecting only establishes the
 * relationship. What the practice may see is a separate decision the patient
 * makes afterwards. [Juristische Prüfung erforderlich] for the final wording.
 */
export default {
  practice: {
    title: "Invite patients",
    intro:
      "Create a record in your practice and invite the person to connect their own account to it.",
    addButton: "Add patient",
    empty: "No records yet.",
    loading: "Loading…",
    loadError: "The list could not be loaded.",
    unavailable: "This area is not available on this installation.",
    searchLabel: "Search",
    searchPlaceholder: "Name or record number",
    showArchived: "Show archived",
    columns: {
      name: "Name",
      dateOfBirth: "Date of birth",
      status: "Status",
      invitation: "Invitation",
      actions: "Actions",
    },
    form: {
      title: "Create a new patient record",
      description:
        "These details stay in your practice. No account is connected yet.",
      givenName: "First name",
      familyName: "Last name",
      dateOfBirth: "Date of birth",
      dateOfBirthHint: "Helps to avoid mix-ups between people with the same name.",
      dateOfBirthRequired: "Please enter the date of birth.",
      email: "Email",
      emailHint: "Optional. For delivery only, never an identity check.",
      phone: "Phone",
      recordNumber: "Record number",
      recordNumberHint: "Optional. Your own internal reference.",
      submit: "Create record",
      cancel: "Cancel",
      saving: "Creating…",
      required: "First and last name are required.",
      invalidDate: "Please enter a valid date.",
      invalidEmail: "Please enter a valid email address.",
      error: "The record could not be created.",
    },
    duplicate: {
      one: "Possible existing record",
      many: "{count} possible existing records",
      hint:
        "Please check your list before inviting. The record was created anyway — nothing is merged automatically.",
      capped: "Not every record was checked. Please also search manually.",
    },
    entryStatus: {
      draft: "Created",
      invited: "Invited",
      linked: "Connected",
      archived: "Archived",
    },
    invitationStatus: {
      none: "No invitation",
      pending: "Pending",
      expired: "Expired",
      redeemed: "Redeemed",
      revoked: "Revoked",
      superseded: "Replaced",
    },
    actions: {
      invite: "Create invitation",
      regenerate: "Renew invitation",
      sendEmail: "Send by email",
      revoke: "Revoke invitation",
      copyLink: "Copy link",
      showQr: "Show QR code",
      manualCode: "On-site code",
      newManualCode: "Generate a new code",
      archive: "Archive record",
      close: "Close",
    },
    invitation: {
      created: "Invitation created.",
      regenerated: "New invitation created. The previous one no longer works.",
      revoked: "Invitation revoked.",
      emailSent:
        "Invitation sent to {address}. For security the link is not shown here.",
      emailMissing:
        "No email address is stored for this entry. Add one, or use the link or code instead.",
      emailFailed:
        "The email could not be sent. Please try again later, or use the link or code instead.",
      emailIsTeam:
        "This email address belongs to an account on your practice team, and that account can’t accept the invitation. Please create an entry with the patient’s own address – or hand over the link or code directly.",
      linkLabel: "Invitation link",
      linkHint:
        "Valid for 7 days. The link is shown once — please pass it on now.",
      linkGone:
        "The link can no longer be shown. Create a new invitation to get a new link.",
      copied: "Copied to the clipboard.",
      copyFailed: "Copying failed. Please select the link and copy it manually.",
      codeLabel: "Code to read out",
      codeHint: "Valid for 24 hours. Shown once.",
      codeCreated: "New code generated. The previous one no longer works.",
      expiresIn7Days: "Expires in 7 days",
      codeExpiresIn: "Expires in 24 hours",
      error: "The action could not be completed.",
      confirmRevoke:
        "Revoke this invitation? The link and the code will stop working.",
      confirmArchive:
        "Archive this record? An open invitation will be revoked. The record itself is kept.",
    },
    qr: {
      title: "Invitation QR code",
      description:
        "For scanning with a phone. The code contains only the invitation link — no patient data.",
      failed: "The QR code could not be generated. Please use the link instead.",
      download: "Download QR code",
      alt: "QR code containing the invitation link",
    },
    linked: {
      badge: "Connected",
      badgeInvited: "Connected — sharing pending",
      hintInvited:
        "The account is connected. The person has not yet decided which areas to share.",
      badgeDeclined: "Declined by the person",
      hintDeclined:
        "The person declined the connection. No relationship exists; a new invitation is needed to try again.",
      badgeEnded: "Relationship ended",
      hintEnded:
        "This relationship no longer exists. A new invitation is needed to connect again.",
      hint: "The person redeemed the invitation and connected their account.",
      linkStatusInvited: "Permissions still pending",
      linkStatusActive: "Permissions granted",
    },
  },

  patient: {
    title: "Your practice's invitation",
    heading: "{practice} would like to connect with you",
    loading: "Checking the invitation…",
    invitedBy: "You have been invited by",
    invalid: {
      title: "This invitation is no longer valid",
      body:
        "The link or code has expired, was already used, or was withdrawn. Please ask your practice for a new invitation.",
      toStart: "Go to the start page",
    },
    team: {
      title: "This account can’t accept the invitation",
      body:
        "This account belongs to the team at {practice}. Someone who works at a practice can’t connect to it as a patient. The invitation is still valid – please sign in with the patient’s own account.",
      action: "Sign in with another account",
    },
    noCredential: {
      title: "No invitation found",
      body:
        "Open the link from your practice's email again – or enter the code you were given at the practice.",
    },
    manualCode: {
      label: "Enter code",
      hint: "You received this code at your practice. It is valid for 24 hours.",
      placeholder: "ABCD-EFGH-JKLM",
      submit: "Check code",
      checking: "Checking…",
    },
    auth: {
      title: "How would you like to continue?",
      body: "After signing in, you will come straight back here.",
      loginLead: "I already have a MedScoutX account",
      login: "Sign in",
      registerLead: "I'm new to MedScoutX",
      register: "Create account",
    },
    account: {
      label: "Connecting as",
      loading: "Loading your account…",
      switch: "Use a different account",
    },
    subject: {
      title: "Who is the connection for?",
      hint: "You can connect for yourself or for someone in your care.",
      self: "Myself",
      selfHint: "The connection applies to your own account.",
      profileGroup: "People in my care",
      loadError: "Your profiles could not be loaded.",
    },
    connect: {
      button: "Connect",
      working: "Connecting…",
      hint:
        "The practice does not see any of your health data yet. You decide what it may see in the next step.",
    },
    success: {
      title: "You are now connected",
      body: "From now on you will find {practice} under “My practices”.",
      consentNext: "Next step: choose what to share",
      consentHint:
        "You have not shared anything yet. Decide what the practice may see – messages, for example. You can also do this later.",
      toConsent: "Choose permissions",
      alreadyActive:
        "Permissions already exist for this practice. You can change them at any time.",
      toPractice: "Go to practice",
      toOverview: "My practices",
    },
    authReturn: {
      loginTitle: "Your practice's invitation",
      loginBody: "Sign in, and you will go straight back to your invitation.",
      registerTitle: "Your practice's invitation",
      registerBody:
        "Create your account. As soon as you have confirmed your email address, you will continue straight to your invitation.",
      haveAccount: "Already have an account? Sign in",
      checkEmailTitle: "Your invitation is waiting.",
      checkEmailBody:
        "Tap the link in the email and sign in – you will then continue straight to your invitation.",
    },
    errors: {
      subjectMismatch:
        "This invitation was already redeemed for someone else. Please contact your practice.",
      alreadyLinked:
        "A connection to this practice already exists and belongs to another record. Please contact your practice.",
      notClaimable:
        "This record has already been connected. Please contact your practice.",
      conflict: "That did not work. Please try again.",
      generic: "That did not work. Please try again later.",
      subjectRequired: "Please choose who the connection is for.",
    },
  },
};
