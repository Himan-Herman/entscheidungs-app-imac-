/**
 * French translations — billing plausibility module + vendor catalogue keys.
 * Disclaimer meaning must remain consistent: automated hint only, not legally binding,
 * not medical advice, not a final reimbursement decision.
 */
export const frPracticeBillingPlausibility = {
  pageTitle: "MedScoutX — Plausibilité de facturation GOÄ/PKV",
  heading: "Plausibilité de facturation (GOÄ / PKV)",
  backHub: "Vue d'ensemble de la pratique",
  selectPractice: "Profil du cabinet",
  loading: "Chargement …",
  submitting: "Vérification …",
  intro:
    "Vérification automatisée de la plausibilité des codes GOÄ. Identifie les lacunes documentaires potentielles et les combinaisons inhabituelles. Ne remplace pas une décision de facturation contraignante.",
  disclaimer:
    "Avertissement : Cet outil fournit uniquement des indications automatisées de plausibilité. Il ne constitue ni un avis de facturation juridiquement contraignant, ni un conseil médical, ni une décision finale de remboursement. Il ne remplace pas le contrôle humain par un personnel de facturation qualifié.",

  btnNewReview: "Démarrer un nouveau contrôle",
  labelZiffer: "Code GOÄ",
  labelFactor: "Facteur",
  labelCount: "Nombre",
  labelContext: "Contexte (optionnel)",
  contextPlaceholder:
    "Brève remarque sur la prestation — aucune donnée patient, aucun diagnostic, aucune information clinique.",

  btnSubmit: "Vérifier la plausibilité",
  btnAddRow: "Ajouter une ligne",
  btnRemoveRow: "Supprimer la ligne",

  statusPending: "En attente",
  statusReviewed: "Vérifié",
  statusDismissed: "Classé",

  sectionResult: "Résultat",
  sectionHistory: "Historique",

  noReviews: "Aucun contrôle pour l'instant. Démarrez votre premier contrôle.",
  aiUnavailable:
    "Vérification automatique temporairement indisponible. Veuillez vérifier manuellement.",

  colDate: "Date",
  colZiffernCount: "Codes",
  colStatus: "Statut",

  flagLabel: "Remarque",

  loadError: "Impossible de charger les contrôles.",
  submitError: "La demande n'a pas pu être envoyée.",
  aiMarked: "Indication de plausibilité (non contraignante)",

  resultStub:
    "Demande de contrôle enregistrée. Les indications de plausibilité sont listées ci-dessous.",

  sectionItems: "Codes vérifiés",
  catalogueFound: "Trouvé dans le sous-catalogue local",
  catalogueNotFound: "Absent du sous-catalogue local — vérification manuelle recommandée",
  noWarnings: "Aucune indication pour ce code.",
  itemWarningsLabel: "Indications",

  warnings: {
    unknown_goae_ziffer:
      "Code GOÄ absent du catalogue de test local — vérification manuelle requise.",
    factor_requires_justification:
      "Facteur supérieur à 2,3 — une justification écrite peut être requise (§ 5 GOÄ).",
    justification_missing:
      "Facteur élevé sans texte de justification — documentation de la raison recommandée.",
    invalid_factor: "Valeur de facteur invalide.",
    invalid_count: "Valeur de nombre invalide.",
  },

  btnAiReview: "Demander une indication de plausibilité IA",
  aiReviewPending: "Demande d'indication IA en cours …",
  aiReviewLabel: "Note assistée par IA / non contraignante",
  aiReviewNonBinding: "Cette note n'est pas juridiquement contraignante, ni un diagnostic, ni une décision de remboursement.",
  aiReviewFallback: "Indication IA temporairement indisponible. Les résultats de vérification déterministes ci-dessus restent valides.",
  aiReviewUnavailable: "La vérification de plausibilité IA n'est pas activée.",
  aiReviewError: "L'indication IA n'a pas pu être demandée.",
  aiReviewSuccess: "Indication de plausibilité IA reçue.",
  aiReviewGeneralNote: "Note générale",
  aiReviewUncertaintyNote: "Note d'incertitude",
  aiReviewRowHints: "Indications par code",

  featureDisabled: "Ce module n'est pas encore activé.",
  forbidden: "Seuls les propriétaires et les administrateurs ont accès.",

  errors: {
    rows_required: "Au moins un code GOÄ est requis.",
    ziffer_required: "Code manquant à la ligne {{rowIndex}}.",
    factor_required: "Facteur manquant à la ligne {{rowIndex}}.",
    count_required: "Nombre manquant à la ligne {{rowIndex}}.",
    patient_data_not_accepted:
      "Ce formulaire n'accepte pas de données patients. Veuillez soumettre uniquement des codes GOÄ et des facteurs.",
    feature_disabled: "Fonction désactivée.",
    forbidden: "Accès refusé.",
    practice_not_found: "Cabinet introuvable.",
  },
};

/** Vendor catalogue keys for practiceIntegrations namespace (French). */
export const frPracticeIntegrationsVendors = {
  sectionVendors: "Systèmes PVS disponibles",
  vendorCatalogueNote:
    "L'activation nécessite un contrat fournisseur, un système de test et une validation de sécurité. Aucun de ces connecteurs n'est disponible en production pour l'instant.",
  vendorStatusComingSoon: "Bientôt disponible",
  vendorStatusSandboxReady: "Sandbox prêt",
  vendorStatusActive: "Actif",
  vendorTypePvs: "PVS",
  btnExpressInterest: "Exprimer son intérêt",
};
