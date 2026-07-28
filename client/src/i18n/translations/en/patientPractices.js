export default {
  pageTitle: "My data and practices – MedScoutX",
  heading: "My data and practices",
  intro:
    "Your own data and the data from each practice stay separate, so you can always see where an entry came from.",
  loading: "Loading …",
  loadError: "Your data could not be loaded.",
  retry: "Try again",

  ownData: {
    title: "My own data",
    description:
      "Entries you recorded yourself or imported from your device. They do not belong to any practice.",
    empty: "You have not recorded any entries of your own yet.",
  },

  practices: {
    title: "My practices",
    description:
      "Each practice has its own area. An entry made at one practice appears only there.",
    tablistLabel: "Select practice",
    empty: "You are not currently connected to any practice.",
    single: "You are connected to one practice.",
    emptySection: "There are no entries for this practice yet.",
    inactiveTitle: "Ended connections",
    inactiveDescription:
      "These connections are no longer active. The practices no longer have access.",
    statusRevoked: "Ended",
    statusInvited: "Request pending",
    statusArchived: "Archived",
  },

  provenance: {
    own: "Your own data",
    selfEntered: "Entered by you",
    deviceImport: "Imported from your device",
    context: "Practice context",
    contextWith: "Practice context: {practice}",
    contextUnavailable: "Practice context unavailable",
    unavailableHint:
      "This entry cannot currently be matched to any of your practice connections.",
  },

  sections: {
    vitals: "Measurements",
    vaccinations: "Vaccinations",
    allergies: "Allergies",
    diagnoses: "Diagnoses and health information",
  },

  counts: {
    entries: "{count} entries",
    entry: "1 entry",
    none: "No entries",
  },
};
