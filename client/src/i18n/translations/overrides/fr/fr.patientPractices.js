/** Vouvoiement, comme dans le reste de l'espace patient. */
export const frPatientPractices = {
  pageTitle: "Mes données et cabinets – MedScoutX",
  heading: "Mes données et cabinets",
  intro:
    "Vos propres données et celles de chaque cabinet restent séparées. Vous voyez ainsi toujours d'où provient une entrée.",
  loading: "Chargement …",
  loadError: "Vos données n'ont pas pu être chargées.",
  retry: "Réessayer",

  ownData: {
    title: "Mes propres données",
    description:
      "Les entrées que vous avez saisies vous-même ou importées depuis votre appareil. Elles n'appartiennent à aucun cabinet.",
    empty: "Vous n'avez pas encore saisi d'entrée personnelle.",
  },

  practices: {
    title: "Mes cabinets",
    description:
      "Chaque cabinet dispose de son propre espace. Une entrée liée à un cabinet n'apparaît que dans cet espace.",
    tablistLabel: "Sélectionner un cabinet",
    empty: "Vous n'êtes actuellement relié à aucun cabinet.",
    single: "Vous êtes relié à un cabinet.",
    emptySection: "Aucune entrée pour ce cabinet pour le moment.",
    inactiveTitle: "Liens terminés",
    inactiveDescription:
      "Ces liens ne sont plus actifs. Les cabinets concernés n'ont plus accès à vos données.",
    statusRevoked: "Terminé",
    statusInvited: "Demande en attente",
    statusArchived: "Archivé",
  },

  provenance: {
    own: "Vos propres données",
    selfEntered: "Saisi par vous",
    deviceImport: "Importé depuis votre appareil",
    context: "Lien avec un cabinet",
    contextWith: "Lien avec un cabinet : {practice}",
    contextUnavailable: "Lien avec un cabinet indisponible",
    unavailableHint:
      "Cette entrée ne peut actuellement être rattachée à aucun de vos liens avec un cabinet.",
  },

  sections: {
    vitals: "Mesures",
    vaccinations: "Vaccinations",
    allergies: "Allergies",
    diagnoses: "Diagnostics et informations de santé",
  },

  counts: {
    entries: "{count} entrées",
    entry: "1 entrée",
    none: "Aucune entrée",
  },
};

export const frDocumentSharing = {
  sharedData: {
    title: "Données partagées",
    description:
      "Documents que vous avez délibérément partagés avec un autre cabinet. Vous pouvez révoquer chaque partage à tout moment.",
    empty: "Vous n'avez encore partagé aucun document avec un autre cabinet.",
    listLabel: "Vos partages de documents",
    loading: "Chargement des partages …",
    loadError: "Vos partages n'ont pas pu être chargés.",
    retry: "Réessayer",
  },

  fields: {
    document: "Document",
    sourcePractice: "Cabinet d'origine",
    targetPractice: "Cabinet destinataire",
    status: "Statut",
    grantedAt: "Partagé le",
    revokedAt: "Révoqué le",
    expiresAt: "Valable jusqu'au",
  },

  status: {
    active: "Actif",
    revoked: "Révoqué",
    expired: "Expiré",
  },

  share: {
    action: "Partager avec un cabinet",
    dialogTitle: "Partager le document avec un cabinet",
    selectPractice: "Sélectionner un cabinet",
    selectPlaceholder: "Veuillez choisir",
    readOnlyNotice:
      "Le cabinet sélectionné reçoit uniquement un accès en lecture à ce document. Il ne peut ni le modifier, ni le supprimer, ni le transmettre.",
    readOnly: "Accès en lecture",
    confirm: "Partager",
    cancel: "Annuler",
    submitting: "Partage en cours …",
    success: "Partage réussi.",
    noOtherPractice:
      "Aucun autre cabinet actif n'est disponible pour partager ce document.",
    alreadyShared: "Ce document est déjà partagé avec ce cabinet.",
    ariaLabel: "Partager le document {document} avec {practice}",
  },

  revoke: {
    action: "Révoquer le partage",
    dialogTitle: "Révoquer le partage",
    confirm: "Révoquer",
    cancel: "Annuler",
    submitting: "Révocation en cours …",
    success: "Révocation réussie.",
    notice:
      "Après la révocation, le cabinet destinataire ne peut plus ouvrir ni télécharger le document via MedScoutX.",
    externalCopies:
      "Les copies déjà enregistrées en dehors de MedScoutX ne peuvent techniquement pas être rappelées automatiquement.",
    ariaLabel: "Révoquer le partage du document {document} pour {practice}",
  },

  practiceView: {
    sharedByPatient: "Partagé par le patient",
    origin: "Origine : {practice}",
    readOnlyHint:
      "Accès en lecture. Ce document appartient à un autre cabinet et a été partagé par la patiente ou le patient.",
  },

  errors: {
    document_not_found: "Le document n'est pas disponible.",
    link_not_found: "Ce lien avec un cabinet n'est pas disponible.",
    link_not_active: "Ce lien avec un cabinet n'est pas actif.",
    document_already_available_to_practice:
      "Ce document provient déjà de ce cabinet.",
    share_already_active: "Ce document est déjà partagé avec ce cabinet.",
    grant_not_found: "Ce partage n'est pas disponible.",
    unsupported_field: "La demande contenait des informations inattendues.",
    forbidden: "Vous n'avez pas l'autorisation nécessaire.",
    server_error: "Une erreur est survenue. Veuillez réessayer plus tard.",
  },
};
