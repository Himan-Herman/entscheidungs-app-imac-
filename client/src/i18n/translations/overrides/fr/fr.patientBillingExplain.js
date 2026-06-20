// Patient-facing "Comprendre votre facture" (GOÄ/PKV) — French override.
// Non-binding guidance only. No legal advice, no final invoice review, no medical assessment.
export const frPatientBillingExplain = {
  title: "Comprendre votre facture",
  subtitle: "Facture privée (GOÄ/PKV) expliquée simplement – à titre indicatif",
  shortDescription:
    "Cette fonction vous aide à mieux comprendre une facture médicale privée (GOÄ/PKV). Vous saisissez vous-même les informations de votre facture, et nous expliquons les postes indiqués dans un langage clair en signalant d’éventuelles questions à poser. Il s’agit d’une orientation à titre indicatif, et non d’un contrôle de votre facture.",

  disclaimerBanner:
    "Orientation à titre indicatif. Cette fonction explique vos informations dans un langage clair et signale d’éventuelles questions. Elle ne constitue pas un conseil juridique, ni un contrôle définitif de la facture, ni une information médicale. En cas de doute, veuillez contacter votre cabinet, votre assurance maladie privée ou un conseil compétent.",
  privacyNote:
    "Vos saisies ne sont pas conservées de façon permanente et sont traitées uniquement pour l’explication en cours. Veuillez ne pas saisir de noms, de dates de naissance ni de diagnostics – les informations de facturation (code, facteur, quantité, montant) ou le simple texte de la facture suffisent.",
  resultNote:
    "L’explication ci-dessous porte uniquement sur les informations que vous avez saisies. Il s’agit d’une orientation à titre indicatif et non d’une évaluation indiquant si votre facture est correcte ou complète. Vous pouvez soumettre poliment les points ouverts à votre cabinet ou à votre assurance maladie privée à l’aide des modèles ci-dessous.",
  footerNote:
    "Orientation à titre indicatif – ni conseil juridique, ni contrôle définitif de la facture. En cas de doute, veuillez contacter votre cabinet, votre assurance maladie privée ou un conseil compétent.",

  inputModeFields: "Remplir les champs",
  inputModeText: "Coller le texte de la facture",

  fieldZiffer: "Code GOÄ",
  fieldZifferPlaceholder: "p. ex. 1, 3, 250",
  fieldFactor: "Facteur de majoration",
  fieldFactorPlaceholder: "p. ex. 2,3",
  fieldCount: "Quantité",
  fieldCountPlaceholder: "p. ex. 1",
  fieldAmount: "Montant (facultatif)",
  fieldAmountPlaceholder: "p. ex. 21,45 €",
  fieldNote: "Votre note (facultatif)",
  fieldNotePlaceholder: "p. ex. une indication figurant sur la facture",
  pasteInvoiceLabel: "Coller le texte de la facture",
  pasteInvoicePlaceholder:
    "Collez ici les postes de la facture – sans noms, dates de naissance ni diagnostics",

  btnExplain: "Expliquer les informations",
  btnAddRow: "Ajouter un autre poste",
  btnReset: "Réinitialiser les saisies",
  btnDraftPractice: "Créer une question pour le cabinet",
  btnDraftInsurer: "Créer une question pour l’assurance",
  btnCopy: "Copier le texte",
  btnCopied: "Copié",

  resultHeading: "Explication de vos informations",
  catalogUnknownLabel: "Absent de l’aperçu",
  result_noFindings:
    "Sur la base de vos saisies, aucun point évident à clarifier n’est ressorti. Il s’agit d’une orientation à titre indicatif et non d’une confirmation que la facture est correcte ou complète. Pour toute question, votre cabinet ou votre assurance maladie privée se tient à votre disposition.",

  warn_unknown_goae_ziffer:
    "Ce code ne figure pas dans notre aperçu de référence. Cela ne signifie pas qu’il est inexact – il ne peut simplement pas être expliqué ici automatiquement. Vous pouvez le demander à votre cabinet ou le vérifier à l’aide du texte officiel de la GOÄ.",
  warn_invalid_factor:
    "Le facteur de ce poste n’a pas pu être lu. Veuillez vérifier la saisie (un nombre, p. ex. 2,3).",
  warn_invalid_count:
    "La quantité de ce poste n’a pas pu être lue. Veuillez vérifier la saisie (un nombre entier à partir de 1).",
  warn_factor_requires_justification:
    "Le facteur indiqué est supérieur au plafond habituel (2,3). Un facteur plus élevé est possible et s’accompagne souvent d’une brève justification. C’est un point que vous pouvez clarifier – sans préjuger de l’exactitude.",
  warn_justification_missing:
    "Aucune justification de ce facteur plus élevé ne figure dans vos saisies. Vous pouvez demander poliment la justification à votre cabinet.",

  error_empty: "Veuillez saisir au moins un poste ou un texte de facture.",
  error_tooLong: "Le texte saisi est trop long. Veuillez le limiter aux postes de facturation.",
  error_tooManyRows: "Vous avez saisi trop de postes. Veuillez en réduire le nombre.",
  error_rateLimited: "Trop de demandes en peu de temps. Veuillez réessayer dans quelques minutes.",
  error_personalData:
    "Veuillez retirer les informations personnelles telles que noms, dates de naissance ou diagnostics. Les informations de facturation suffisent.",
  error_generic: "Cela n’a pas fonctionné. Veuillez réessayer.",

  draftPractice_subject: "Question concernant ma facture [numéro de facture], [date de facture]",
  draftPractice_body:
    "Madame, Monsieur,\n\nJe vous remercie pour votre facture. Je souhaiterais mieux la comprendre et j’ai une brève question :\n\n- Une courte explication des postes [code(s)] me serait utile.\n- Pour [code], un facteur de [facteur] est indiqué – pourriez-vous m’en préciser brièvement la justification ?\n\nMon objectif est uniquement de mieux comprendre. Je vous remercie de votre aide.\n\nCordialement,\n[Nom]",
  draftInsurer_subject: "Question sur le remboursement – facture [numéro de facture], [date de facture]",
  draftInsurer_body:
    "Madame, Monsieur,\n\nConcernant la facture médicale ci-jointe, j’ai une question sur le remboursement :\n\n- Pouvez-vous me confirmer si les postes [code(s)] sont remboursables dans le cadre de mon contrat ?\n- Si des informations manquent pour le traitement, merci de me le faire savoir.\n\nJe vous remercie de votre réponse.\n\nCordialement,\n[Nom], numéro d’assuré : [numéro]",

  entryCardTitle: "Comprendre votre facture",
  entryCardSubtitle: "Facture privée (GOÄ/PKV) expliquée simplement – à titre indicatif",
  backToDocuments: "Retour aux documents du cabinet",
};
