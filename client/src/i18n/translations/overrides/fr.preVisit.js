export default {
  language: {
    pageTitle: "MedScoutX — Préparation au rendez-vous",
    eyebrow: "Pré-consultation",
    title: "Préparer votre consultation médicale",
    explanation:
      "Cet outil vous aide à structurer vos préoccupations et questions avant une consultation médicale. Il ne fournit pas de diagnostics ni de recommandations médicales.",
    trust: "Toutes les informations reposent uniquement sur vos propres indications.",
    valueProp:
      "Préparez symptômes, médicaments, documents et questions de façon structurée — dans votre langue.",
    languageLabel: "Langue que vous souhaitez utiliser avec MedScoutX",
    languageHint:
      "Vous pouvez saisir vos informations dans la langue où vous vous sentez le plus à l’aise.",
    continue: "Continuer",
  },
  chrome: {
    backHome: "Retour à l’accueil MedScoutX",
    moduleLabel: "Préparer la consultation",
    safety:
      "Ce module sert uniquement à préparer et documenter vos informations. Il ne remplace pas un avis médical.",
    navAria: "Navigation pré-consultation",
  },
  chat: {
    pageTitle: "MedScoutX — Questionnaire préalable",
    progressTemplate: "Étape {{current}} sur {{total}}",
    answerPlaceholder: "Votre réponse…",
    next: "Continuer",
    back: "Retour",
    changeLanguage: "Changer la langue de saisie",
    sectionLabelQuestion: "Question",
    sectionLabelAnswer: "Votre réponse",
    devInsertDemo: "Insérer des données de démonstration",
    devOnlyNote: "Visible uniquement en développement local.",
  },
  review: {
    pageTitle: "MedScoutX — Récapitulatif préalable",
    title: "Récapitulatif de vos saisies",
    intro:
      "Voici comment vos saisies seront utilisées pour préparer la consultation. Vous pouvez encore modifier.",
    empty: "non précisé",
    edit: "Modifier",
    clearField: "Supprimer la saisie",
    trustBeforeActions:
      "Vous pouvez consulter, modifier ou supprimer vos informations à tout moment avant de créer le document.",
    newSession: "Nouvelle session",
    wipeSession: "Supprimer complètement la session",
    prepareDocument: "Préparer le document",
  },
  document: {
    pageTitle: "MedScoutX — Aperçu du document",
    title: "Préparer le document pour le médecin",
    explanation:
      "Choisissez la langue dans laquelle la version structurée pour le médecin doit être créée.",
    doctorLangLabel: "Langue de la version médecin",
    doctorLangHint:
      "Choisissez la langue dans laquelle le médecin ou le cabinet doit lire le document.",
    sectionStructured: "Version structurée pour le médecin",
    sectionOriginal: "Déclarations originales du patient",
    disclaimer:
      "La version médecin repose uniquement sur les déclarations du patient. Aucun diagnostic, aucune recommandation ni évaluation d’urgence n’est produit.",
    empty: "non précisé",
    backReview: "Retour au récapitulatif",
    pdfDisabled: "Créer un PDF",
    pdfLocalNote:
      "Le fichier PDF est créé localement dans votre navigateur. Aucune donnée n’est transmise.",
    consentCheckbox:
      "Je souhaite enregistrer cette session localement dans ce navigateur pour pouvoir la consulter plus tard.",
    consentExpl:
      "La session est stockée uniquement localement dans ce navigateur. Aucune donnée n’est envoyée à MedScoutX.",
    saveLocal: "Enregistrer la session localement",
    saveSuccess: "La session a été enregistrée localement.",
    archiveNote:
      "Vous pourrez supprimer les sessions enregistrées ultérieurement. Cette fonction ne remplace pas un dossier médical.",
    historyLink: "Voir les sessions enregistrées",
    consentSectionTitle: "Copie locale facultative",
    createDoctorVersion: "Créer la version médecin",
    creatingDoctorVersion: "Création de la version médecin…",
    aiError:
      "La version médecin n’a pas pu être créée pour le moment. Vous pouvez encore utiliser l’aperçu PDF local.",
    aiSuccessStatus:
      "La version médecin a été créée à partir de vos déclarations.",
    accountSectionTitle: "Enregistrer dans mon compte",
    accountConsentCheckbox:
      "Je souhaite enregistrer cette préparation dans mon compte MedScoutX.",
    accountConsentExpl:
      "Ce stockage est facultatif. Vous pourrez consulter ou supprimer les préparations enregistrées plus tard.",
    saveToAccount: "Enregistrer dans le compte",
    accountLoginHint:
      "Connectez-vous pour enregistrer des préparations dans votre compte.",
    accountLoginLink: "Connexion",
    accountSaveSuccess:
      "La préparation a été enregistrée dans votre compte.",
    accountSaveError:
      "La préparation n’a pas pu être enregistrée pour le moment.",
    sessionTitleDe: "Vorbereitung Arztgespräch",
    sessionTitleEn: "Doctor visit preparation",
    viewMyPreparations: "Voir mes préparations",
    mainNavAria:
      "Version médecin, export PDF, retour au récapitulatif",
    structuredRowLabels: {
      appointmentReason: "Motif actuel du rendez-vous",
      symptomsOwnWords: "Symptômes avec les mots du patient",
      onsetAndCourse: "Début et évolution dans le temps",
      medications: "Traitement actuel",
      preExistingConditions: "Antécédents connus",
      relevantDocuments: "Documents pertinents",
      patientQuestions: "Questions pour le médecin",
    },
  },
  localHistory: {
    pageTitle: "Sessions enregistrées — Pré-consultation — MedScoutX",
    title: "Sessions enregistrées localement",
    expl:
      "Ces sessions sont stockées uniquement dans ce navigateur. Elles n’ont pas été transmises à MedScoutX.",
    privacyNote:
      "Les sessions locales restent sur cet appareil et dans ce navigateur uniquement.",
    empty: "Aucune session locale enregistrée.",
    patientLang: "Langue du patient",
    doctorLang: "Langue du médecin",
    savedAt: "Enregistré",
    view: "Afficher",
    delete: "Supprimer",
    clearAll: "Supprimer toutes les sessions locales",
    clearConfirm:
      "Supprimer définitivement toutes les sessions locales ? Action irréversible.",
    listAriaLabel: "Sessions enregistrées",
  },
  accountHistory: {
    pageTitle: "MedScoutX — Mes préparations",
    title: "Mes préparations",
    subtitle:
      "Ici vous voyez les préparations que vous avez explicitement enregistrées dans votre compte MedScoutX.",
    loginHint: "Connectez-vous pour voir les préparations enregistrées.",
    loginCta: "Connexion",
    loading: "Chargement…",
    loadError:
      "La liste n’a pas pu être chargée pour le moment. Réessayez plus tard.",
    empty: "Aucune préparation n’a encore été enregistrée sur votre compte.",
    patientLang: "Langue du patient",
    doctorLang: "Langue du médecin",
    created: "Créé",
    statusLabel: "Statut",
    open: "Ouvrir",
    deleteOne: "Supprimer",
    deleteAll: "Supprimer toutes les préparations",
    confirmDeleteAll:
      "Supprimer toutes les préparations enregistrées sur votre compte ? Action irréversible.",
    privacyNote:
      "Les préparations enregistrées peuvent être supprimées à tout moment. Cette fonction ne remplace pas un dossier médical.",
    defaultTitle: "Préparation à la consultation",
    deleteError: "La préparation n’a pas pu être supprimée pour le moment.",
    deleteAllError: "Les préparations n’ont pas pu être supprimées pour le moment.",
    statusDraft: "Brouillon",
    statusPdfCreated: "PDF créé",
    statusCompleted: "Terminé",
  },
};
