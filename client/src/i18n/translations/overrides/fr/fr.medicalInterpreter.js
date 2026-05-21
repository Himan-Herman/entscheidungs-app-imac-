/**
 * Interprète médical — module patient B2C (FR).
 * Soutien à la communication uniquement ; pas de diagnostic, triage ni recommandation de traitement.
 */
export default {
  hub: {
    title: "Interprète médical",
    subtitle: "Traduction en direct et soutien à la communication",
    cta: "Démarrer la conversation",
    newConversation: "Nouvelle conversation",
    trustLine:
      "Soutien à la communication uniquement — pas de diagnostic ni de recommandation de traitement.",
    privacyLine:
      "Microphone uniquement avec votre autorisation. Le contenu des conversations reste par défaut sur cet appareil.",
    ariaLabel: "Ouvrir le module Interprète médical",
  },

  chrome: {
    moduleTitle: "Interprète médical",
    backToHub: "Retour à l'espace patient",
    backToSetup: "Retour à la configuration",
  },

  safety: {
    strip:
      "Soutien à la communication — pas d'évaluation médicale, de diagnostic ni de recommandation de traitement.",
    noDiagnosis: "Pas de diagnostic",
    noTriage: "Pas d'évaluation d'urgence",
    noTreatment: "Pas de recommandation de traitement",
    verifyTranslation:
      "Les traductions automatiques peuvent contenir des erreurs. Veuillez vérifier les informations importantes avec votre équipe soignante.",
    communicationOnly:
      "Ce module prend en charge la traduction et la documentation des conversations — pas l'évaluation médicale de votre situation.",
  },

  start: {
    pageTitle: "MedScoutX — Préparer la conversation",
    heading: "Interprète médical",
    intro:
      "Préparez une conversation multilingue avec votre équipe soignante. La configuration ne prend que quelques étapes.",
    stepOf: "Étape {{current}} sur {{total}}",
    back: "Retour",
    next: "Continuer",
    cancel: "Annuler",
    cancelConfirm: "Annuler la configuration ?",
  },

  languages: {
    heading: "Choisir les langues",
    intro:
      "Quelles langues utiliserez-vous, vous et votre équipe soignante, pendant la consultation ?",
    patientLabel: "Votre langue",
    doctorLabel: "Langue de l'équipe soignante",
    patientHint: "La langue que vous parlez",
    doctorHint: "La langue parlée par l'équipe soignante",
    required: "Veuillez sélectionner les deux langues.",
    selectEmpty: "Veuillez sélectionner",
    loadingDefaults: "Chargement des langues par défaut …",
    searchLabel: "Rechercher une langue",
    searchPlaceholder: "Rechercher par nom ou code …",
    searchEmpty: "Aucune langue ne correspond à votre recherche.",
    mixedDirectionNote:
      "Cette conversation utilise des langues à la fois de droite à gauche et de gauche à droite. Veuillez lire chaque section dans son propre sens.",
  },

  profile: {
    heading: "Profil pour cette conversation",
    intro:
      "Facultatif : utiliser les données enregistrées du compte pour cette conversation (p. ex. pour une documentation ultérieure).",
    consentLabel: "Utiliser les données de profil enregistrées pour cette conversation",
    consentHint:
      "Nom, date de naissance et coordonnées — uniquement si vous y consentez. Aucune donnée de profil de santé n'est utilisée.",
    accountLink: "Modifier dans les paramètres du compte",
    loadError:
      "Le profil n'a pas pu être chargé. Vous pouvez continuer sans données de profil.",
    skipped: "Continuer sans données de profil",
  },

  doctorInfo: {
    heading: "Détails de la consultation (facultatif)",
    intro:
      "Ces informations facilitent l'orientation et la documentation ultérieure. Vous pouvez laisser tous les champs vides.",
    toggleShow: "Ajouter des détails",
    toggleHide: "Masquer les détails",
    doctorName: "Nom du professionnel",
    doctorNamePlaceholder: "p. ex. Dr Martin",
    practiceName: "Cabinet ou clinique",
    practiceNamePlaceholder: "Nom de l'établissement",
    specialty: "Spécialité",
    specialtyPlaceholder: "p. ex. Médecine générale",
    appointmentDate: "Rendez-vous (date)",
    conversationTitle: "Titre de cette conversation",
    conversationTitlePlaceholder: "p. ex. Consultation de suivi",
  },

  privacy: {
    heading: "Informations et consentement",
    body1:
      "Ce module prend en charge la traduction et la documentation des conversations entre vous et votre équipe soignante. Il ne fournit pas de diagnostic, d'évaluation d'urgence ni de recommandation de traitement.",
    body2:
      "La traduction automatique et la reconnaissance vocale peuvent être inexactes ou incomplètes. Veuillez vérifier les informations importantes avec votre équipe soignante.",
    body3:
      "L'audio est envoyé de manière sécurisée uniquement pour la transcription, traité en mémoire, et n'est pas stocké sur les serveurs MedScoutX ni dans cette application.",
    body4:
      "Les données de conversation restent uniquement sur cet appareil en phase 1 (local). Aucun enregistrement serveur n'est créé pour le contenu des conversations.",
    storageLabel: "Enregistrer la conversation sur cet appareil",
    storageHint:
      "Vous permet de poursuivre et rouvrir sur cet appareil. Vous pouvez supprimer la conversation ultérieurement.",
    noStorageWarning:
      "Sans enregistrement, cette conversation est perdue lorsque vous quittez la page.",
    acceptLabel: "J'ai lu et compris les informations",
    acceptRequired: "Veuillez confirmer avoir pris connaissance des informations.",
    beginCta: "Commencer la conversation",
    legalLinks:
      "Plus d'informations sont disponibles dans Confidentialité et mentions légales.",
    linkPrivacy: "Confidentialité",
    linkDisclaimer: "Informations",
  },

  live: {
    mockOriginalPatient: "J'aimerais discuter de quelque chose d'important.",
    mockOriginalDoctor: "Veuillez continuer avec vos propres mots.",
    mockTranslationPreview:
      "Aperçu de la traduction — le service de traduction sera connecté dans une version ultérieure.",
    statusRegion: "État de l'enregistrement",
    currentTurn: "Énoncé actuel",
  },

  room: {
    pageTitle: "MedScoutX — Conversation en direct",
    heading: "Conversation en direct",
    languagesLabel: "{{patient}} ↔ {{doctor}}",
    statusIdle: "Prêt",
    statusRecording: "Enregistrement …",
    statusUploading: "Finalisation de l'enregistrement …",
    statusTranscribing: "Reconnaissance vocale …",
    statusTranslating: "Traduction …",
    statusSimplifying: "Simplification du langage …",
    statusSpeaking: "Lecture audio …",
    statusReadyForNext: "Prêt pour le prochain énoncé",
    statusEditingDraft: "Relire le texte parlé avant traduction",
    statusBlocked: "Traduction bloquée — veuillez modifier le texte",
    statusError: "Un problème est survenu pour ce tour",
    speakerDirection: "Vous parlez en {{source}} · traduction vers {{target}}",
    turnPatient: "Vous parlez",
    turnClinician: "L'équipe soignante parle",
    speakerTogglePatient: "Je parle",
    speakerToggleClinician: "L'équipe soignante parle",
    disclaimerStrip:
      "Soutien à la communication — veuillez vérifier les informations importantes avec votre équipe soignante.",
  },

  transcript: {
    heading: "Texte parlé",
    placeholder: "Le texte reconnu apparaîtra ici après l'enregistrement.",
    edit: "Modifier le texte",
    saveEdit: "Appliquer les modifications",
    confirm: "Confirmer le texte et traduire",
    editingHint: "Relisez le texte avant qu'il ne soit traduit.",
    empty: "Pas encore d'enregistrement pour ce tour.",
    lowConfidenceInput:
      "La reconnaissance vocale peut être inexacte. Veuillez relire et corriger le texte avant de traduire.",
    draftSavedHint: "Votre brouillon est enregistré sur cet appareil pendant que vous modifiez.",
  },

  translation: {
    heading: "Traduction",
    placeholder: "La traduction apparaît après confirmation du texte.",
    empty: "Pas encore de traduction pour ce tour.",
    lowConfidence:
      "Veuillez vérifier : le texte parlé n'a peut-être pas été reconnu correctement. Clarifiez les informations importantes avec votre équipe soignante.",
    uncertainLabel:
      "Certaines formulations étaient peu claires — la traduction peut ne pas tout refléter. Veuillez confirmer les détails importants ensemble.",
    terminologyWarning:
      "Les noms de médicaments, nombres, unités ou négations peuvent nécessiter une vérification. Veuillez vérifier les termes importants avec votre professionnel de santé.",
    unclearSourceWarning:
      "La formulation d'origine semblait peu claire. Ne vous fiez pas à cette traduction seule pour des détails médicaux importants.",
    languagePairLimited:
      "Cette combinaison de langues n'est pas entièrement prise en charge dans l'application. Veuillez vérifier les termes importants avec votre professionnel de santé.",
    mixedDirectionSession:
      "Des langues de droite à gauche et de gauche à droite sont utilisées dans cette conversation. Vérifiez chaque bloc de texte attentivement.",
    verifyTermsNotice:
      "La traduction automatique peut être inexacte. Veuillez vérifier les noms de médicaments, posologies, allergies et autres termes importants avec votre professionnel de santé.",
    blocked:
      "La traduction n'a pas pu être affichée sous une forme sûre. Veuillez reformuler de manière neutre ou discuter directement.",
    replay: "Afficher à nouveau la traduction",
  },

  speak: {
    listenTranslation: "Écouter la traduction",
    listenSimplified: "Écouter le texte simplifié",
    loading: "Préparation de l'audio …",
    stop: "Arrêter la lecture",
    playbackPlaying: "Lecture audio en cours",
    playbackStopped: "Lecture arrêtée",
    retry: "Réessayer la lecture",
  },

  streamingTts: {
    heading: "Lecture vocale (quasi temps réel)",
    experimentalBadge: "Facultatif — l'audio ne se lance jamais automatiquement.",
    privacyNote:
      "L'audio est généré à la demande et conservé uniquement en mémoire sur cet appareil jusqu'à ce que vous quittiez la page.",
    enablePreviewPlayback: "Autoriser la lecture de l'aperçu de traduction (démarrage manuel uniquement)",
    playPreview: "Écouter l'aperçu de traduction",
    stopPlayback: "Arrêter la lecture",
    playPreviewAria: "Écouter à voix haute l'aperçu de traduction quasi temps réel",
    stopPlaybackAria: "Arrêter la lecture vocale",
    statusLoading: "Préparation de la voix …",
    statusPlaying: "Lecture audio de la traduction",
    statusIdle: "Lecture arrêtée",
    previewDisabledHint:
      "Activez la lecture d'aperçu ci-dessus pour entendre la traduction non confirmée.",
    errorGeneric: "La lecture n'a pas pu démarrer. Vous pouvez réessayer ou continuer sans audio.",
    staleBlockPlayback:
      "Le texte d'aperçu a changé — attendez un aperçu mis à jour ou abandonnez-le avant de lancer la lecture.",
  },

  simplify: {
    action: "Simplifier le langage",
    heading: "Formulation simplifiée",
    note:
      "Simplification du langage uniquement — pas de conseil médical. Veuillez vérifier les informations importantes avec votre professionnel de santé.",
    hide: "Masquer le texte simplifié",
    loading: "Simplification en cours …",
  },

  pushToTalk: {
    record: "Maintenir pour parler",
    recordTap: "Appuyer pour parler",
    stop: "Arrêter l'enregistrement",
    recording: "Enregistrement",
    micTest: "Tester le microphone",
    micTestHint: "Court test — rien ne sera traduit.",
    micDenied: "L'accès au microphone n'est pas disponible.",
    micDeniedGuidance:
      "Autorisez l'accès au microphone pour ce site dans les paramètres de votre navigateur, puis appuyez sur « Réessayer le microphone ». Vous pouvez aussi saisir votre texte dans la zone ci-dessus.",
    micRetry: "Réessayer le microphone",
    tooShort: "Enregistrement trop court. Parlez un peu plus longtemps et réessayez.",
    likelySilent:
      "Nous n'avons pas détecté de parole claire. Veuillez vérifier votre microphone et réessayer.",
    preparing: "Préparation du microphone …",
    stopping: "Finalisation de l'enregistrement …",
    maxDurationHint: "Durée maximale d'enregistrement atteinte. Veuillez arrêter l'enregistrement.",
    keyboardHint: "Astuce : sélectionnez le bouton parler, puis appuyez sur Espace ou Entrée.",
    disabledDraft:
      "Terminez la relecture du texte actuel avant de lancer un nouvel enregistrement.",
    disabledBusy: "Veuillez attendre la fin de l'étape en cours.",
    disabledOffline: "L'enregistrement nécessite une connexion Internet.",
  },

  streaming: {
    heading: "Aperçu de transcription en flux (expérimental)",
    experimentalBadge: "Bêta facultative — l'appui pour parler reste le mode par défaut et le plus sûr.",
    privacyNote:
      "L'audio est envoyé par courts segments uniquement pour la transcription. Rien n'est stocké sur nos serveurs sous forme audio. La transcription reste provisoire jusqu'à ce que vous l'ajoutiez comme brouillon et la confirmiez avant traduction.",
    pttDefaultNote:
      "Pour un usage courant, continuez avec l'appui pour parler ci-dessus. Démarrez le flux uniquement si vous souhaitez essayer cet aperçu.",
    captionsAria: "Sous-titres provisoires en flux",
    captionsEmpty: "Pas encore de texte provisoire. Démarrez le flux pour voir les sous-titres ici.",
    provisionalLabel: "Brouillon provisoire (non confirmé)",
    startButton: "Démarrer l'aperçu en flux",
    stopButton: "Arrêter le flux",
    stopping: "Arrêt …",
    cancelButton: "Annuler",
    useAsDraftButton: "Utiliser comme brouillon (modifier avant traduction)",
    startAria: "Démarrer l'aperçu expérimental de transcription en flux",
    stopAria: "Arrêter l'aperçu de transcription en flux",
    statusIdle: "Flux inactif",
    statusConnecting: "Connexion …",
    statusConnected: "Flux actif — microphone activé",
    statusProcessing: "Traitement du segment audio …",
    statusFinalizing: "Finalisation de la transcription …",
    previewReady: "Flux terminé. Relisez le texte, puis utilisez-le comme brouillon si besoin.",
    unsupportedBrowser:
      "L'aperçu en flux n'est pas pris en charge dans ce navigateur. Veuillez utiliser l'appui pour parler.",
    errorGeneric: "Le flux n'a pas pu continuer. Veuillez l'arrêter et utiliser l'appui pour parler.",
    backpressureError:
      "L'audio arrive trop vite. Le flux a été arrêté — utilisez l'appui pour parler ou réessayez plus lentement.",
    disabledWhileStreaming: "Terminez ou arrêtez le flux avant d'utiliser l'appui pour parler.",
    maxDurationReached:
      "Durée maximale de flux atteinte. L'aperçu a été finalisé — utilisez-le comme brouillon ou continuez avec l'appui pour parler.",
    fallbackToPtt:
      "Si les modes d'aperçu ne sont pas disponibles, utilisez l'appui pour parler ci-dessus — il reste le mode par défaut.",
  },

  nearRealtime: {
    heading: "Aperçu de traduction quasi temps réel",
    experimentalBadge:
      "Aperçu facultatif uniquement — non enregistré tant que vous n'avez pas confirmé un tour brouillon ci-dessous.",
    privacyNote:
      "Seul l'extrait de transcription actuel est envoyé pour traduction. Pas d'historique de conversation, pas d'audio, et rien n'est stocké sur le serveur en tant que session.",
    notConfirmedLabel: "Aperçu de traduction (non confirmé)",
    previewAria: "Aperçu provisoire de traduction quasi temps réel",
    previewEmpty:
      "Lorsque la transcription en flux se stabilise, un aperçu de traduction peut apparaître ici.",
    statusIdle: "Aperçu quasi temps réel inactif",
    statusWaiting: "En attente d'une transcription stable …",
    statusTranslating: "Génération de l'aperçu de traduction …",
    statusReady: "Aperçu de traduction prêt — non enregistré",
    confirmRequiredNote:
      "Utilisez « Utiliser comme brouillon » dans le flux ci-dessus, modifiez si besoin, puis confirmez la traduction dans le panneau de transcription. L'appui pour parler reste le mode par défaut.",
    discardButton: "Abandonner l'aperçu de traduction",
    staleWarning:
      "La transcription a changé. Cet aperçu peut ne plus correspondre — abandonnez-le ou attendez un aperçu mis à jour.",
    lowConfidenceWarning:
      "Cet aperçu peut être incertain. Veuillez le relire attentivement avant de confirmer.",
    unclearSourceWarning:
      "La formulation source était peu claire. Modifiez la transcription avant de confirmer.",
    errorGeneric:
      "Aperçu de traduction indisponible. Vous pouvez continuer avec l'appui pour parler et la traduction manuelle.",
  },

  history: {
    heading: "Documentation des conversations sur cet appareil",
    privacyNote:
      "Phase 1 : les conversations sont stockées uniquement sur cet appareil — pas sur les serveurs MedScoutX. Aucun enregistrement audio ni microphone n'est conservé. Il s'agit d'une documentation d'orientation et de communication, pas d'un dossier médical. Vous pouvez supprimer des conversations individuellement ou effacer tout l'historique ci-dessous à tout moment.",
    fallbackTitle: "Conversation du {{date}}",
    statusDraft: "Brouillon",
    statusActive: "Active",
    statusEnded: "Terminée",
    continue: "Poursuivre",
    review: "Consulter",
    rename: "Renommer",
    clearAll: "Tout effacer sur cet appareil",
    clearAllConfirm:
      "Supprimer toutes les conversations de l'interprète sur cet appareil ? Cette action est irréversible.",
    renamePrompt: "Titre de cette conversation",
    renameTitle: "Renommer la conversation",
    renameSave: "Enregistrer le titre",
    renamed: "Titre mis à jour.",
    deleted: "Conversation supprimée.",
    cleared: "Toutes les conversations ont été effacées.",
    languagePair: "{{patient}} ↔ {{doctor}}",
    titleWithAppointment: "Conversation du {{date}}",
    titleWithAppointmentPractice: "Conversation du {{date}} · {{practice}}",
    titleWithAppointmentDoctor: "Conversation du {{date}} · {{doctor}}",
    titleWithPractice: "Conversation · {{practice}}",
    titleWithDoctor: "Conversation · {{doctor}}",
    titleLanguagePair: "Traduction {{patient}} ↔ {{doctor}}",
    titleUnsafe:
      "Ce titre ne peut pas être utilisé. Veuillez choisir un nom neutre sans conclusion médicale ni mention d'urgence.",
    turnCount: "{{count}} tours documentés ({{translated}} traduits)",
    searchLabel: "Rechercher des conversations sur cet appareil",
    searchPlaceholder: "Titre, cabinet, langue …",
    searchHintLocal: "La recherche s'effectue uniquement sur cet appareil. Rien n'est envoyé au serveur.",
    searchResults: "{{count}} sur {{total}} conversations affichées",
    noSearchResults: "Aucune conversation ne correspond à votre recherche.",
  },

  sections: {
    opening: "Début de conversation",
    patientStatements: "Énoncés du patient",
    clinicianStatements: "Énoncés de l'équipe soignante",
    closing: "Fin de conversation",
    middle: "Échange ultérieur",
  },

  pdf: {
    documentTitle: "Interprète médical — documentation de conversation",
    documentSubtitle:
      "Résumé de soutien à la communication · compte rendu de conversation traduite",
    legalParagraph1:
      "Ce document soutient uniquement la communication. Il ne constitue pas un dossier médical, un rapport de diagnostic, une évaluation clinique ni un résumé de traitement.",
    legalParagraph2:
      "Il ne contient pas de diagnostic, de triage, d'évaluation d'urgence ni de recommandations de traitement.",
    legalParagraph3:
      "La transcription et la traduction automatiques peuvent être inexactes ou incomplètes.",
    sessionTitleLabel: "Titre de la conversation",
    generatedNote: "Généré localement sur cet appareil · MedScoutX Interprète médical",
    footerPage: "Page",
    filenamePrefix: "medscoutx-interpreter",
    exportLoading: "Génération du PDF …",
    exportSuccess: "PDF téléchargé sur votre appareil.",
    exportFailed: "Le PDF n'a pas pu être créé. Veuillez réessayer.",
    exportNoTurns: "Il n'y a aucun tour documenté à exporter.",
    rtlFontNotice:
      "Remarque : certains scripts peuvent ne pas s'afficher entièrement dans ce PDF tant que la prise en charge étendue des polices n'est pas ajoutée.",
    rtlLimitationDetail:
      "L'export PDF utilise des polices standard. L'arabe, le persan, le kurde (sorani) et d'autres scripts RTL peuvent apparaître simplifiés ou mal alignés. Utilisez la relecture à l'écran pour la lecture la plus fidèle.",
    mixedScriptNotice:
      "Ce document contient des sens d'écriture mixtes. Veuillez vérifier les formulations à l'écran si quelque chose paraît peu clair dans le PDF.",
  },

  review: {
    pageTitle: "MedScoutX — Documentation de conversation",
    heading: "Documentation de conversation",
    notMedicalRecord:
      "Documentation d'orientation et de communication uniquement — pas un dossier médical.",
    metadataHeading: "Détails de la session",
    turnsHeading: "Tours documentés",
    timelineHeading: "Chronologie de la conversation",
    documentationNotice:
      "La traduction automatique peut être inexacte. Veuillez vérifier les noms de médicaments, posologies, allergies et autres termes importants avec votre professionnel de santé.",
    summaryLine: "{{turns}} tours documentés · {{translated}} traduits",
    summaryDrafts: "{{count}} tour(s) brouillon non encore traduit(s)",
    summaryTurnsLabel: "Tours documentés",
    created: "Démarrée",
    ended: "Terminée",
    status: "État",
    turnNumber: "Tour {{n}}",
    langDirection: "{{source}} → {{target}}",
    originalLabel: "Texte parlé",
    translatedLabel: "Traduction",
    simplifiedLabel: "Formulation simplifiée",
    turnDraft: "Brouillon — pas encore traduit",
    turnBlocked: "Traduction indisponible (sécurité)",
    turnError: "Ce tour n'a pas pu être terminé",
    backToList: "Toutes les conversations",
  },

  confirm: {
    deleteTitle: "Supprimer la conversation ?",
    deleteBody:
      "Cela supprime la conversation uniquement sur cet appareil. Cette action est irréversible.",
    clearAllTitle: "Effacer toutes les conversations ?",
    clearAllBody:
      "Supprimer toutes les conversations de l'interprète sur cet appareil ? Cette action est irréversible.",
    endTitle: "Terminer la conversation ?",
    endBody: "La conversation sera marquée comme terminée sur cet appareil.",
    endWithDraftBody:
      "Vous avez du texte parlé qui n'est pas encore traduit. Terminer la conversation quand même ?",
    leaveTitle: "Quitter la salle en direct ?",
    leaveBody:
      "Vous avez du texte parlé qui n'est pas encore confirmé et traduit. Si vous quittez maintenant, vous pouvez l'abandonner ou continuer à modifier.",
    discardDraft: "Abandonner et quitter",
    keepEditing: "Continuer à modifier",
    endAnyway: "Terminer quand même",
    confirmDelete: "Supprimer",
    confirmClearAll: "Tout effacer",
    confirmEnd: "Terminer la conversation",
    cancel: "Annuler",
  },

  sessionActions: {
    heading: "Conversation",
    end: "Terminer la conversation",
    endHint: "Conversation marquée comme terminée.",
    ended: "Conversation terminée.",
    leave: "Quitter la salle",
    leaveConfirm:
      "Quitter la conversation ? Le contenu non enregistré peut être perdu.",
    delete: "Supprimer sur cet appareil",
    deleteConfirm: "Supprimer vraiment cette conversation de cet appareil ?",
    export: "Télécharger le PDF",
    exportHint: "Télécharger la documentation de conversation en PDF sur cet appareil.",
    exportUnavailable: "Ajoutez au moins un tour documenté avant d'exporter.",
  },

  empty: {
    moduleDisabled: "L'interprète médical n'est pas disponible pour le moment.",
    noSession: "Conversation introuvable. Veuillez en démarrer une nouvelle.",
    noTurns:
      "Pas encore de contribution orale. Maintenez le bouton pour commencer.",
    historyEmpty: "Aucune conversation enregistrée sur cet appareil pour le moment.",
    setupIncomplete:
      "Veuillez terminer la configuration avant d'entrer dans la salle en direct.",
  },

  cloud: {
    heading: "Sauvegarde de compte facultative",
    lead:
      "Par défaut, les conversations restent uniquement sur cet appareil. Vous pouvez optionnellement enregistrer une copie chiffrée sur votre compte MedScoutX pour l'ouvrir sur un autre appareil.",
    bulletLocalStill:
      "Le mode local uniquement reste disponible — vous n'êtes pas obligé d'utiliser la sauvegarde de compte.",
    bulletWhatStored:
      "Le contenu stocké peut inclure le texte des conversations, les traductions, les formulations simplifiées et les détails de session (langues, titre, libellés de rendez-vous).",
    bulletNoAudio:
      "L'audio et les enregistrements microphone ne sont jamais stockés sur le serveur.",
    bulletDeleteAnytime:
      "Vous pouvez supprimer une copie enregistrée ou toutes les données de sauvegarde de compte à tout moment.",
    bulletNotMedicalRecord:
      "Il s'agit d'une documentation de conversation à titre d'orientation — pas d'un dossier médical, diagnostic ou plan de traitement.",
    acceptLabel:
      "Je comprends et souhaite autoriser la sauvegarde chiffrée sur mon compte lorsque je choisis d'enregistrer une conversation",
    acceptRequired: "Veuillez confirmer que vous comprenez la sauvegarde de compte.",
    enableAccount: "Activer la sauvegarde de compte",
    accountEnabled: "La sauvegarde de compte est activée. Rien n'est téléversé tant que vous ne choisissez pas d'enregistrer une conversation.",
    revokeConsent: "Arrêter les futures sauvegardes de compte",
    revokeHint:
      "Arrête les nouveaux téléversements. Les copies existantes sur votre compte restent jusqu'à ce que vous les supprimiez séparément.",
    consentGranted: "Sauvegarde de compte activée.",
    consentRevoked: "Futures sauvegardes de compte arrêtées.",
    unavailable:
      "La sauvegarde de compte n'est pas disponible dans cet environnement. Les conversations restent uniquement sur cet appareil.",
    loading: "Vérification de la disponibilité de la sauvegarde de compte …",
    setupHeading: "Sauvegarde de compte (facultatif)",
    setupBody:
      "Vous pouvez continuer à utiliser l'interprète avec les conversations stockées uniquement sur cet appareil.",
    setupHint:
      "Pour activer la sauvegarde chiffrée de compte, rendez-vous dans la liste des conversations après la configuration — rien n'est téléversé automatiquement.",
    badgeLocal: "Uniquement sur cet appareil",
    badgeSynced: "Également enregistré sur le compte",
    badgeStale: "Copie sur l'appareil plus récente que le compte",
    saveToAccount: "Enregistrer sur le compte",
    updateSavedCopy: "Mettre à jour la copie enregistrée",
    deleteCloudCopy: "Supprimer uniquement la copie du compte",
    sessionLocalNote:
      "La suppression sur cet appareil et la suppression de la copie du compte sont des actions distinctes.",
    sessionNeedsConsent: "Activez la sauvegarde de compte dans la section ci-dessus pour enregistrer des copies.",
    enableAccountFirst: "Activez la sauvegarde de compte avant d'enregistrer sur votre compte.",
    saveNeedsTurns: "Ajoutez au moins une contribution orale avant d'enregistrer sur votre compte.",
    saveSuccess: "Conversation enregistrée sur votre compte.",
    updateSuccess: "Copie du compte mise à jour.",
    deleteCopySuccess: "Copie du compte supprimée. La copie sur cet appareil est inchangée.",
    deleteLocalOnlyBody:
      "Supprimer cette conversation uniquement sur cet appareil ? La copie du compte, le cas échéant, n'est pas supprimée.",
    deleteCopyConfirmTitle: "Supprimer la copie du compte ?",
    deleteCopyConfirmBody:
      "Retirer la copie chiffrée de votre compte ? La copie sur cet appareil est conservée.",
    deleteCopyConfirmAction: "Supprimer la copie du compte",
    deleteAllHeading: "Toutes les données de sauvegarde de compte",
    deleteAllBody:
      "Retirer toutes les conversations Interprète médical stockées sur votre compte. Les copies sur cet appareil ne sont pas supprimées.",
    deleteAllAction: "Supprimer toutes les données de sauvegarde de compte",
    deleteAllConfirmTitle: "Supprimer toutes les données de sauvegarde de compte ?",
    deleteAllConfirmBody:
      "Cela supprime définitivement toutes les conversations de l'interprète de votre compte. Les copies sur l'appareil ne sont pas affectées.",
    deleteAllConfirmAction: "Supprimer toutes les données du compte",
    deleteAllSuccess: "Toutes les données de sauvegarde de compte ont été supprimées.",
    exportHeading: "Exporter la sauvegarde de compte",
    exportBody:
      "Télécharger un fichier JSON des conversations stockées sur votre compte. L'audio n'est pas inclus. Les copies uniquement sur l'appareil ne sont pas incluses sauf si vous les avez enregistrées sur votre compte.",
    exportAction: "Télécharger l'export JSON",
    exportSuccess: "Export téléchargé.",
    dataControlHeading: "Vos données interprète",
    statusUnavailable: "La sauvegarde de compte n'est pas disponible ici. Les conversations restent uniquement sur cet appareil.",
    statusSignInRequired: "Connectez-vous pour gérer la sauvegarde de compte des conversations interprète.",
    statusLocalOnly: "La sauvegarde de compte est désactivée. Les conversations sur cet appareil ne sont pas téléversées sauf si vous activez la sauvegarde ci-dessous.",
    statusAccountActive: "La sauvegarde de compte est activée. {{count}} conversation(s) ont une copie enregistrée sur votre compte.",
    statusConsentNoSessions: "La sauvegarde de compte est activée. Rien n'est stocké sur votre compte tant que vous n'enregistrez pas une conversation.",
    factLocal: "Sur cet appareil",
    factLocalBody: "Reste dans votre navigateur jusqu'à suppression ou effacement des données du site.",
    factCloud: "Sur votre compte",
    factCloudBody: "Copie chiffrée que vous enregistrez manuellement — facultative, jamais automatique.",
    factAudio: "Audio",
    factAudioBody: "Jamais stocké sur le serveur.",
    consentHistoryHeading: "Historique du consentement",
    historyGranted: "Sauvegarde activée",
    historyRevoked: "Sauvegarde arrêtée",
    scopeNoUser: "Connectez-vous pour utiliser la sauvegarde de compte.",
    scopeMismatch: "Votre connexion a changé. Actualisez la page avant d'enregistrer ou de supprimer des données du compte.",
    revokeDialogTitle: "Arrêter la sauvegarde de compte ?",
    revokeDialogIntro:
      "Les futurs enregistrements sur votre compte seront arrêtés. Choisissez quoi faire des copies déjà stockées sur votre compte.",
    revokeKeepTitle: "Conserver les copies enregistrées sur mon compte",
    revokeKeepBody:
      "Arrête uniquement les nouveaux téléversements. Vous pourrez supprimer les copies du compte plus tard dans cette section.",
    revokeDeleteTitle: "Arrêter la sauvegarde et supprimer toutes les copies du compte",
    revokeDeleteBody:
      "Retire {{count}} conversation(s) enregistrée(s) de votre compte. Les copies sur cet appareil ne sont pas supprimées.",
    revokeDeleteConfirmTitle: "Supprimer toutes les copies du compte ?",
    revokeDeleteConfirmBody:
      "Cela supprime définitivement {{count}} conversation(s) de votre compte et arrête les futures sauvegardes.",
    revokeDeleteConfirmAction: "Supprimer les copies du compte et arrêter la sauvegarde",
    revokeBackToChoices: "Retour aux choix",
    consentRevokedKeepData: "Sauvegarde de compte arrêtée. Les copies existantes du compte ont été conservées.",
    consentRevokedAndDeleted:
      "Sauvegarde de compte arrêtée et toutes les copies du compte ont été supprimées.",
    errors: {
      generic: "La sauvegarde de compte n'a pas pu être effectuée. Veuillez réessayer plus tard.",
      network: "Problème de connexion. Veuillez réessayer.",
      unauthorized: "Veuillez vous connecter pour continuer.",
      rateLimited: "Trop de requêtes. Veuillez patienter un instant.",
      cloudDisabled: "La sauvegarde de compte n'est pas disponible pour le moment.",
      encryptionUnavailable: "La sauvegarde de compte n'est pas configurée sur le serveur.",
      consentRequired: "Le consentement à la sauvegarde de compte est requis.",
      quotaExceeded: "Limite de sauvegarde de compte atteinte.",
      sessionNotFound: "Copie enregistrée introuvable sur votre compte.",
      validationRejected: "Cette conversation n'a pas pu être enregistrée dans sa forme actuelle.",
    },
  },

  reliability: {
    offlineBanner:
      "Vous semblez hors ligne. La saisie vocale et la traduction sont suspendues jusqu'au rétablissement de la connexion.",
    reconnectedBanner: "Connexion rétablie. Vous pouvez continuer quand vous êtes prêt.",
    recoveryBody:
      "La dernière étape n'a pas pu se terminer. Votre texte est toujours là — vous pouvez réessayer.",
    retryAction: "Réessayer",
    dismissRecovery: "Ignorer",
    errorBoundaryBody:
      "Un problème est survenu dans la vue interprète. Les autres zones de l'application ne sont pas affectées.",
    errorBoundaryBack: "Retour à l'accueil interprète",
  },

  errors: {
    moduleDisabled: "Ce module n'est pas disponible pour le moment.",
    sessionNotFound: "Conversation introuvable. Veuillez recommencer.",
    transcribeFailed: "La reconnaissance vocale a échoué. Veuillez réessayer.",
    translateFailed: "La traduction a échoué. Veuillez réessayer.",
    simplifyFailed: "La simplification a échoué. Veuillez réessayer.",
    speakFailed: "La lecture a échoué. Veuillez réessayer.",
    ttsDisabled: "La lecture vocale n'est pas disponible pour le moment.",
    rateLimited: "Trop de requêtes. Veuillez patienter un instant.",
    network: "Problème de connexion. Veuillez réessayer.",
    offline: "Vous semblez hors ligne. Vérifiez votre connexion et réessayez.",
    transcribeTimeout:
      "La reconnaissance vocale a pris trop de temps. Veuillez faire un enregistrement plus court.",
    requestTimeout: "Cette étape a pris trop de temps. Veuillez réessayer.",
    speakUnsupported: "La lecture audio n'est pas prise en charge dans ce navigateur.",
    textTooLong: "Le texte est trop long. Veuillez le raccourcir.",
    unauthorized: "Veuillez vous connecter pour continuer.",
    generic: "Un problème est survenu. Veuillez réessayer plus tard.",
  },

  invite: {
    pageTitle: "MedScoutX — Invitation du cabinet",
    heading: "Interprète médical lors de votre consultation",
    loading: "Vérification du lien d'invitation…",
    statusAriaPrefix: "État de l'invitation :",
    statusActive: "Le lien d'invitation est valide",
    statusExpired: "Le lien d'invitation a expiré",
    statusRevoked: "Le lien d'invitation n'est plus disponible",
    statusInvalid: "Le lien d'invitation n'est pas valide",
    statusUnavailable: "La validation de l'invitation n'est pas disponible",
    networkError: "Impossible de vérifier l'invitation. Vérifiez votre connexion et réessayez.",
    moduleDisabled: "L'interprète médical n'est pas disponible pour le moment.",
    practiceLabel: "Cabinet",
    communicationNotice:
      "Soutien à la communication uniquement — pas de diagnostic, triage ni conseil de traitement.",
    noticeNoDiagnosis: "Pas de diagnostic médical",
    noticeNoTriage: "Pas d'évaluation d'urgence ni de triage",
    noticeNoTreatment: "Pas de recommandations de traitement ou de médicaments",
    consentHeading: "Votre conversation reste privée",
    consentNoAutoShare:
      "Ouvrir ce lien du cabinet ne partage pas votre conversation avec le cabinet.",
    consentExplicitStep:
      "Une fois la conversation terminée, vous pourrez choisir séparément de partager la documentation avec le cabinet.",
    consentPatientControl: "Vous gardez le contrôle de ce qui est partagé et pouvez révoquer l'accès ultérieurement.",
    languagesHeading: "Choisissez les langues ensuite",
    languagesIntro:
      "À l'écran suivant, vous choisissez votre langue et celle de l'équipe soignante avant le début de la conversation.",
    continueLoggedIn: "Choisir les langues et continuer",
    authRequired: "Connectez-vous pour utiliser l'Interprète médical avec ce lien du cabinet.",
    guestUnsupported:
      "L'utilisation invité sans compte n'est pas encore prise en charge pour l'interprète (vérification dépôt requise). Veuillez vous connecter ou créer un compte.",
    loginToContinue: "Se connecter pour continuer",
    createAccount: "Créer un compte",
    setupBannerTitle: "Lien du cabinet",
    setupBannerBody:
      "Vous avez démarré depuis une invitation pour {practice}. Rien n'est partagé avec le cabinet tant que vous n'y consentez pas explicitement à une étape ultérieure.",
    setupPracticePrefill: "Nom du cabinet issu de l'invitation (modifiable)",
  },

  practiceShare: {
    heading: "Partager avec le cabinet (facultatif)",
    communicationNotice:
      "Soutien à la communication uniquement — pas un dossier médical ni une évaluation clinique.",
    intro:
      "Vous pouvez partager une copie de cette documentation de conversation avec {practice}. L'audio n'est jamais partagé.",
    noticeNoAudio: "Les enregistrements audio ne sont pas partagés avec le cabinet.",
    noticeDocumentation:
      "Seule la documentation écrite de la conversation (texte original et traduit) peut être partagée.",
    noticeRevoke: "Vous pouvez révoquer l'accès du cabinet ultérieurement.",
    noticeNotMedicalRecord: "Il ne s'agit pas d'un dossier médical.",
    consentLabel:
      "Je consens au partage de cette documentation de conversation avec le cabinet nommé ci-dessus.",
    grantButton: "Partager la documentation avec le cabinet",
    granting: "Partage en cours…",
    grantSuccess: "Accès du cabinet accordé. Vous pouvez le révoquer dans vos paramètres interprète.",
    grantError: "Impossible de partager avec le cabinet. Réessayez plus tard.",
    tokenMissing:
      "Rouvrez le lien d'invitation du cabinet pour activer le partage depuis cet appareil.",
  },

  aria: {
    hubCard: "Interprète médical dans l'espace patient",
    startInterpreter: "Démarrer l'Interprète médical",
    wizardProgress: "Progression de la configuration",
    languagePatient: "Sélectionner votre langue",
    languageDoctor: "Sélectionner la langue de l'équipe soignante",
    profileConsent: "Utiliser les données de profil pour cette conversation",
    privacyAccept: "Informations lues et comprises",
    privacyStorage: "Enregistrer la conversation sur cet appareil",
    liveRegion: "Traduction et état actuels",
    transcriptEditor: "Modifier le texte parlé",
    translationRegion: "Zone de traduction",
    speakerRole: "Qui parle actuellement",
    startRecording: "Démarrer la saisie vocale",
    stopRecording: "Arrêter la saisie vocale",
    preparingMic: "Préparation du microphone",
    stoppingRecording: "Finalisation de l'enregistrement",
    replayTranslation: "Écouter la traduction",
    replaySimplified: "Écouter le texte simplifié",
    confirmTranscript: "Confirmer le texte et traduire",
    simplifyLanguage: "Simplifier le langage de la traduction",
    simplifiedRegion: "Formulation simplifiée",
    hideSimplified: "Masquer la formulation simplifiée",
    deleteSession: "Supprimer la conversation sur cet appareil",
    exportConversation: "Exporter la conversation",
    endSession: "Terminer la conversation",
    leaveRoom: "Quitter la salle en direct",
    turnList: "Historique des tours de conversation",
    historyList: "Conversations enregistrées sur cet appareil",
    reviewMetadata: "Détails de la conversation",
    renameSession: "Renommer la conversation",
    clearAllHistory: "Effacer tout l'historique interprète",
    deleteAllCloudData: "Supprimer toutes les données de sauvegarde de compte",
    exportCloudData: "Télécharger l'export JSON des conversations de sauvegarde de compte",
    searchHistory: "Rechercher les conversations enregistrées",
    languageSearch: "Filtrer les langues de conversation",
  },
};
