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
    doctorLanguageLabel: "Langue de la version médecin",
    doctorLanguageHint:
      "Choisissez ici dans quelle langue la version destinée au médecin devra être préparée.",
    continue: "Continuer",
  },
  chrome: {
    backHome: "Retour à l’accueil MedScoutX",
    backPatientHub: "Retour à l’espace patient",
    moduleLabel: "Préparer la consultation",
    libraryModuleLabel: "Mes préparations",
    safety:
      "Ce module sert uniquement à préparer et documenter vos informations. Il ne remplace pas un avis médical.",
    librarySafety:
      "Gérez ici les préparations enregistrées. Rien n’est synchronisé automatiquement — seuls les éléments que vous avez explicitement enregistrés apparaissent dans cette bibliothèque.",
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
    adaptiveSeedHint:
      "Décrivez ce point avec vos propres mots, de la manière la plus concrète et neutre possible.",
    adaptiveFollowupLabel: "Question complémentaire pour la préparation",
    adaptiveSeedRequired:
      "Décrivez brièvement la situation avec vos propres mots.",
    adaptiveAnswerRequired:
      "Répondez brièvement à la question complémentaire.",
    adaptiveBusy: "Un instant…",
    adaptiveProgressMeta:
      "Questions complémentaires pour cette saisie : {{n}} sur un maximum de {{max}}",
    adaptiveSkip: "Passer",
    adaptiveServiceError:
      "La question complémentaire adaptative ne peut pas être créée pour le moment. Vous pouvez continuer ou modifier plus tard.",
    audioHint:
      "Vous pouvez écouter la question ou dicter votre réponse.",
    audioPrivacy:
      "Pour la lecture à voix haute et la saisie vocale, du texte ou de l’audio est envoyé au service d’IA pour traitement. Cette fonction ne stocke rien de manière permanente.",
    audioMicUnsupported:
      "L’enregistrement audio n’est pas pris en charge par ce navigateur.",
    audioListenAria: "Lire la question à voix haute",
    audioListenTitle:
      "Lire la question et une brève indication à voix haute",
    audioDictateAria: "Dicter la réponse",
    audioDictateTitle:
      "Touchez pour démarrer l’enregistrement, touchez à nouveau pour l’arrêter",
    audioStatusLoading: "Préparation de l’audio…",
    audioStatusPlaying: "Lecture…",
    audioStatusRecording:
      "Enregistrement… touchez à nouveau lorsque vous avez terminé.",
    audioStatusTranscribing: "Transformation de votre voix en texte…",
    audioErrorGeneric:
      "La fonction audio n’est pas disponible pour le moment. Veuillez réessayer plus tard.",
    audioErrorPlayback:
      "La lecture n’a pas pu être démarrée.",
    audioMicPermission:
      "L’accès au microphone a été refusé ou n’est pas disponible.",
    longitudinalCaseBanner:
      "Facultatif : un historique longitudinal est lié. La collecte utilise uniquement vos propres déclarations précédentes, sans interprétation médicale.",
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
    vitalsAttach: {
      heading: "Joindre mes mesures",
      intro:
        "Vous avez enregistré des mesures dans MedScoutX. Vous pouvez joindre automatiquement la valeur la plus récente de chacune à ce document.",
      consent:
        "Je consens à ce que mes mesures actuelles soient jointes à ce document et transmises avec lui au cabinet.",
      previewTitle: "Ces valeurs seront jointes",
      minimisationNote:
        "Seule la valeur la plus récente par type de mesure des 90 derniers jours est transmise — sans vos notes. Vous pouvez désélectionner cette option à tout moment.",
      importedLabel: "depuis l'appareil",
      attachError: "Les mesures n'ont pas pu être jointes.",
      attachedHint: "Vos mesures seront jointes à ce PDF.",
    },
    pageTitle: "MedScoutX — Aperçu du document",
    title: "Préparer le document pour le médecin",
    explanation:
      "Le PDF destiné au médecin est créé en allemand. Vos déclarations originales restent également jointes dans votre propre langue.",
    pageLeadFlexible:
      "Vérifiez vos informations et choisissez dans quelle langue la version structurée pour le médecin doit être créée. Vos déclarations originales de patient restent jointes séparément.",
    doctorLangLabel: "Langue de la version médecin",
    doctorLangHint:
      "La version structurée pour le médecin et le PDF envoyé au cabinet sont créés en allemand.",
    doctorLangSelectableHint:
      "Vous pouvez définir ici dans quelle langue la version destinée au médecin doit être créée.",
    patientMetaSection: "Informations patient facultatives",
    patientMetaNote:
      "Ces informations sont facultatives et aident le cabinet à identifier le document.",
    patientIdentityPdfConsent:
      "Inclure ces informations patient dans le PDF pour le cabinet/le médecin.",
    patientIdentityPdfConsentHint:
      "Les données d’identité n’apparaissent dans le PDF que si cette option est activée. Vous pouvez néanmoins conserver les champs remplis localement pour plus tard.",
    patientNameLabel: "Nom",
    patientDateOfBirthLabel: "Date de naissance",
    patientEmailLabel: "E-mail",
    patientPhoneLabel: "Téléphone (facultatif)",
    patientGenderOrSalutationLabel: "Genre / civilité",
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
    emailPdfConsent:
      "Je confirme que ce document peut contenir des informations de santé personnelles et peut être envoyé au cabinet/médecin sélectionné.",
    sessionTitleDe: "Préparation de la consultation médicale",
    sessionTitleEn: "Préparation de la consultation médicale",
    sessionTitleFr: "Préparation de la consultation médicale",
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
    assistantQuestions: {
      sectionTitle: "Questions d’orientation pour la consultation",
      intro:
        "À partir de vos indications sur les symptômes, l’évolution et la préparation, l’IA propose quelques questions structurantes. Elles servent uniquement à votre propre préparation, sans évaluation médicale.",
      noAiAnswersNote:
        "Seules des questions sont proposées. Vos réponses restent destinées à votre propre préparation et ne sont pas envoyées au médecin comme bloc de questions séparé.",
      generateButton: "Créer les questions d’orientation",
      generating: "Préparation des questions…",
      successStatus:
        "Les questions d’orientation ont été créées à partir de vos indications.",
      error:
        "Les questions d’orientation n’ont pas pu être créées pour le moment. Vous pouvez continuer ou réessayer plus tard.",
      staleHint:
        "Vos indications ont changé. Recréez les questions pour qu’elles correspondent à l’état actuel.",
      emptyState:
        "Pas encore de questions d’orientation. Créez-les en option pour préparer la consultation.",
      questionCounter: "Question {{current}} sur {{total}}",
      doctorVersionLabel: "Formulation pour le médecin",
      answerLabel: "Votre réponse",
      answerPlaceholder:
        "Votre réponse avec vos propres mots — de vous seulement, pas de l’IA…",
      previewSectionTitle: "Questions d’orientation pour votre préparation",
      pdfSectionHeading: "Questions d’orientation (réponses du patient)",
      pdfPatientQuestionLabel: "Question (patient)",
      pdfDoctorQuestionLabel: "Question (médecin)",
      pdfPatientAnswerLabel: "Réponse du patient",
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
    linkCases: "Ouvrir mes parcours",
    startNewPrep: "Démarrer une nouvelle préparation",
    retryLoad: "Réessayer",
    listAriaLabel: "Préparations enregistrées",
  },
  cases: {
    backPracticeHub: "Retour à Mon cabinet",
    title: "Mes dossiers",
    pageTitle: "MedScoutX — Mes dossiers",
    intro:
      "Regroupez plusieurs préparations autour d’un sujet dans le temps. Vous contrôlez le contenu et la suppression.",
    safetyNote:
      "Pas de diagnostic, pas d’urgence, pas de conseil thérapeutique. Seules vos propres saisies sont comparées et organisées.",
    searchPlaceholder: "Rechercher…",
    showArchived: "Afficher les archivés",
    createCase: "Créer un dossier",
    fieldTitle: "Titre",
    fieldCategory: "Catégorie (facultatif)",
    fieldDescription: "Description (facultatif)",
    save: "Enregistrer",
    cancel: "Annuler",
    loading: "Chargement…",
    loadError: "Impossible de charger les dossiers.",
    saveError: "Le dossier n’a pas pu être enregistré.",
    empty: "Aucun dossier pour l’instant.",
    sessionCount: "Préparations",
    loginHint: "Connectez-vous pour gérer les dossiers.",
    loginCta: "Se connecter",
    linkPreparations: "Mes préparations",
    backHome: "Retour à l’accueil",
  },
  caseDetail: {
    backPracticeHub: "Retour à Mon cabinet",
    backToList: "Tous les dossiers",
    notFound: "Ce dossier est introuvable ou n’est plus disponible.",
    unnamedSession: "Préparation sans titre",
  },
};
