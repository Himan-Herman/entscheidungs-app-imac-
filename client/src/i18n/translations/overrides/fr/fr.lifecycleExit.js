/** Processus de sortie, fermeture et demande de suppression (patient + cabinet). Vouvoiement. */
export const frLifecycleExit = {
  patient: {
    dangerTitle: "Supprimer le compte",
    dangerIntro:
      "La suppression de votre compte MedScoutX est définitive et irréversible. Avant de supprimer, veuillez lire ce qui sera supprimé — et ce qui pourrait ne pas l'être.",
    whatDeletedTitle: "Ce qui sera supprimé",
    whatDeletedItems: [
      "Votre compte personnel MedScoutX",
      "Les données patient que vous avez enregistrées dans MedScoutX",
      "Vos liens personnels avec des cabinets",
      "Vos autorisations personnelles et jetons d'accès",
      "Vos paramètres personnels et vos sessions",
    ],
    whatRemainsTitle: "Ce qui pourrait ne pas être supprimé",
    whatRemainsItems: [
      "La documentation créée par un cabinet lui-même",
      "Les copies déjà téléchargées ou exportées",
      "Les données stockées en dehors de MedScoutX",
      "Les données qu'un cabinet doit conserver en raison de ses propres obligations",
    ],
    whatRemainsNote:
      "MedScoutX ne peut pas supprimer des données sur des systèmes tiers. Les cabinets peuvent être soumis à leurs propres obligations de conservation et de documentation.",
    exportHint:
      "Recommandation : téléchargez une copie de vos données avant la suppression (section « Export des données » ci-dessus). Après la suppression, aucun export n'est plus possible.",
    receiptHint:
      "Après la suppression, vous recevrez une confirmation écrite avec un numéro de dossier à votre adresse e-mail enregistrée.",
    openDialogButton: "Supprimer le compte …",
    ownerNoticeTitle: "Vous possédez un cabinet",
    ownerNotice:
      "Au moins un cabinet est lié à votre compte. Avant que votre compte puisse être supprimé, vous devez décider du sort du cabinet.",
    ownerManageButton: "Gérer le cabinet",
    dialogTitle: "Supprimer définitivement votre compte ?",
    dialogWarning:
      "Cette action est irréversible. Votre compte et les données patient enregistrées dans MedScoutX seront définitivement supprimés.",
    checkboxLabel:
      "J'ai compris quelles données seront supprimées et quels documents pourraient rester auprès de mes cabinets.",
    phraseLabel: "Saisissez exactement cette phrase pour confirmer :",
    phraseExpected: "SUPPRIMER DÉFINITIVEMENT MON COMPTE",
    phraseMismatch: "La phrase saisie ne correspond pas.",
    confirmButton: "Supprimer définitivement mon compte maintenant",
    cancelButton: "Annuler",
    deleting: "Suppression du compte …",
    successTitle: "Votre compte a été supprimé",
    successBody:
      "Votre compte MedScoutX a été définitivement supprimé. Votre numéro de dossier : {caseNumber}",
    successEmailHint:
      "Une confirmation écrite a été programmée vers votre adresse e-mail enregistrée. Les documents détenus par vos cabinets ou les copies déjà exportées peuvent subsister en dehors de MedScoutX.",
    supportLabel: "Contact :",
    errorGeneric: "La suppression n'a pas pu être effectuée. Votre compte n'a pas été modifié.",
    errorOwnerBlocked:
      "Au moins un cabinet est lié à votre compte. La suppression du compte n'est actuellement pas automatique pour les propriétaires de cabinet — veuillez d'abord décider du sort du cabinet.",
    errorContextBlocked:
      "La suppression n'a pas pu être effectuée en toute sécurité et a été entièrement annulée. Votre compte est inchangé. Veuillez contacter le support.",
  },
  practice: {
    sectionTitle: "Adhésion et statut du cabinet",
    sectionIntro:
      "Mettez ici votre cabinet en pause, fermez-le, réactivez-le ou demandez la suppression définitive. Seul le ou la propriétaire du cabinet peut effectuer ces actions.",
    statusLabel: "Statut actuel",
    status: {
      active: "Actif",
      suspended: "Temporairement en pause",
      closed: "Fermé",
      reactivation_requested: "Réactivation demandée",
      deletion_requested: "Suppression définitive demandée",
    },
    statusBanner: {
      suspended:
        "Votre cabinet est en pause. L'accès opérationnel a pris fin ; les données enregistrées restent protégées.",
      closed:
        "Votre cabinet est fermé. L'accès opérationnel a pris fin. Une réactivation peut être demandée.",
      reactivation_requested:
        "Votre demande de réactivation a été transmise à MedScoutX et est en cours d'examen. Vous recevrez une réponse écrite.",
      deletion_requested:
        "Votre demande de suppression définitive a été enregistrée. Rien n'a encore été supprimé — MedScoutX examine d'abord les obligations de conservation et de documentation.",
    },
    pauseTitle: "Mettre le cabinet temporairement en pause",
    pauseBody:
      "Le cabinet reste enregistré et pourra être réactivé plus tard. L'accès opérationnel est temporairement interrompu.",
    pauseRecommendedTitle: "Recommandé pour :",
    pauseRecommended: [
      "une pause temporaire",
      "des congés ou une restructuration",
      "un retard de paiement",
      "un retour ultérieur à MedScoutX",
    ],
    pauseButton: "Mettre en pause …",
    pauseConfirmTitle: "Mettre le cabinet temporairement en pause ?",
    pauseConfirmBody:
      "L'accès opérationnel de votre équipe prend fin immédiatement. Les données patient ne sont pas supprimées. Vous pouvez réactiver le cabinet vous-même à tout moment.",
    closeTitle: "Fermer le cabinet chez MedScoutX",
    closeBody:
      "L'adhésion prend fin. Le cabinet ne peut plus travailler de manière opérationnelle. Les données conservées restent protégées et une réactivation ultérieure peut être demandée.",
    closeRecommendedNote:
      "Recommandé lorsque le cabinet souhaite quitter MedScoutX sans exclure un retour ultérieur.",
    closeButton: "Fermer le cabinet …",
    closeConfirmTitle: "Fermer le cabinet chez MedScoutX ?",
    closeConfirmBody:
      "Toutes les sessions d'équipe et tous les accès prennent fin. Aucune nouvelle connexion patient ni aucun partage n'est possible. Le cabinet n'est pas supprimé ; une réactivation ultérieure peut être demandée.",
    reactivateTitle: "Réactiver le cabinet",
    reactivateBody:
      "Met fin à la pause après une confirmation de sécurité. Les consentements révoqués, les partages retirés et les accès d'équipe supprimés ne sont pas rétablis automatiquement.",
    reactivateButton: "Réactiver le cabinet …",
    reactivateConfirmTitle: "Réactiver le cabinet ?",
    reactivateConfirmBody:
      "Votre cabinet redevient opérationnel. Vérifiez ensuite votre structure actuelle d'équipe et d'autorisations — les révocations antérieures restent en vigueur.",
    requestReactivateTitle: "Demander la réactivation",
    requestReactivateBody:
      "Un cabinet fermé ne peut être réactivé que par MedScoutX. La demande est envoyée à MedScoutX ; vous recevrez un accusé de réception écrit.",
    requestReactivateButton: "Demander la réactivation …",
    requestReactivateConfirmTitle: "Demander la réactivation à MedScoutX ?",
    requestReactivateConfirmBody:
      "MedScoutX examine votre demande et répond par écrit. Les anciens partages patients, les consentements révoqués et les accès d'équipe ne sont pas réactivés automatiquement.",
    deleteTitle: "Demander la suppression définitive",
    deleteWarning:
      "Une suppression définitive est irréversible. Les obligations de conservation, de documentation et de protection des données doivent être examinées avant la suppression.",
    deleteBody:
      "Cette option ne supprime pas immédiatement. Une demande écrite avec numéro de dossier est créée ; la suppression reste techniquement verrouillée jusqu'à ce que MedScoutX ait examiné et approuvé la demande.",
    deleteButton: "Demander la suppression définitive …",
    deleteConfirmTitle: "Demander la suppression définitive ?",
    deleteConfirmBody:
      "L'accès opérationnel prend fin et une demande écrite de suppression est créée. Rien n'est supprimé tant que MedScoutX n'a pas terminé son examen.",
    reasonLabel: "Motif factuel (facultatif, aucun contenu médical)",
    passwordLabel: "Confirmez avec votre mot de passe",
    passwordHelp:
      "Pour des raisons de sécurité, vous devez vous authentifier à nouveau avec votre mot de passe pour cette action.",
    dialogConfirm: "Confirmer",
    dialogCancel: "Annuler",
    working: "En cours …",
    receiptHint:
      "Pour chacune de ces actions, vous recevez une confirmation écrite avec numéro de dossier à votre adresse e-mail enregistrée.",
    afterRequestTitle: "Demande de suppression enregistrée",
    afterRequestBody:
      "Votre demande a été enregistrée. Rien n'a encore été supprimé. Votre numéro de dossier : {caseNumber}",
    emailConfirmHint:
      "Veuillez confirmer votre demande également par e-mail à {supportEmail}.",
    openMailButton: "Ouvrir un e-mail à MedScoutX",
    mailNotSentNote:
      "Remarque : l'ouverture de votre messagerie ne vaut pas envoi. La demande n'est confirmée qu'une fois votre e-mail réellement envoyé.",
    copyCaseButton: "Copier le numéro de dossier",
    copySubjectButton: "Copier l'objet",
    copied: "Copié.",
    copyFailed: "Copie impossible — veuillez copier manuellement.",
    caseStatus: {
      recorded: "Enregistré",
      awaiting_email_confirmation: "En attente de votre confirmation par e-mail",
      in_review: "En cours d'examen par MedScoutX",
      withdrawn: "Retiré",
      completed: "Terminé",
    },
    caseListTitle: "Dossiers",
    mailSubject: "Suppression définitive de mon cabinet – demande {requestId}",
    mailBody:
      "Bonjour,\n\nje confirme par la présente la demande de suppression définitive de mon cabinet chez MedScoutX.\n\nCabinet : {practiceName}\nID de la demande : {requestId}\nAdresse e-mail enregistrée : {ownerEmail}\n\nJe sais que la suppression ne sera effectuée qu'après examen des éventuelles obligations de conservation et de documentation.\n\nCordialement\n{ownerName}",
    supportLabel: "Adresse de contact officielle :",
    errors: {
      practice_lifecycle_transition_invalid:
        "Ce changement de statut n'est pas possible dans l'état actuel.",
      practice_owner_required:
        "Seul le ou la propriétaire du cabinet peut effectuer cette action.",
      practice_already_suspended: "Le cabinet est déjà en pause.",
      practice_already_closed: "Le cabinet est déjà fermé.",
      reactivation_already_requested: "Une demande de réactivation est déjà en cours.",
      deletion_already_requested: "Une demande de suppression active existe déjà.",
      confirmation_required: "Veuillez confirmer l'action avec votre mot de passe correct.",
      unsupported_field: "La requête contenait des champs inattendus et a été rejetée.",
      email_delivery_pending:
        "La confirmation écrite sera remise dès que l'envoi sera possible.",
      practice_deletion_locked:
        "La suppression définitive est techniquement verrouillée jusqu'à l'examen et l'approbation de votre demande par MedScoutX.",
      generic: "L'action n'a pas pu être exécutée. Rien n'a été modifié.",
    },
  },
};
