import { deepMerge } from "../../deepMerge.js";
import legalFr from "../legal/fr/index.js";
import landing from "./fr.landing.js";
import info from "./fr.info.js";
import preVisit from "./fr.preVisit.js";
import startseite from "./fr.startseite.js";
import frCore from "./fr/fr.core.js";
import frAccount from "./fr/fr.account.js";
import frModules from "./fr/fr.modules.js";
import frPractice from "./fr/fr.practice.js";
import frPatient from "./fr/fr.patient.js";
import frMedicalInterpreter from "./fr/fr.medicalInterpreter.js";
import frPracticeModules from "./fr/fr.practice.modules.js";
import frVitals from "./fr/fr.vitals.js";
import frHealthHistory from "./fr/fr.healthHistory.js";
import frErezept from "./fr/fr.erezept.js";
import frSosCard from "./fr/fr.sosCard.js";
import { frPracticeBillingPlausibility, frPracticeIntegrationsVendors } from "./fr/fr.practiceBillingPlausibility.js";
import { frPatientBillingExplain } from "./fr/fr.patientBillingExplain.js";

const frBase = {
  legal: legalFr,
  info,
  preVisit,
  header: {
    skip: "Aller au contenu",
    homeAria: "Aller à l’accueil",
    navToggle: "Afficher ou masquer la navigation",
    nav: "Navigation principale",
    appLabel: "Espace professionnel",
    home: "Accueil",
    logout: "Se déconnecter",
    languageLabel: "Langue",
    themeLight: "Passer en mode clair",
    themeDark: "Passer en mode sombre",
  },
  login: {
    badge: "MedScoutX — préparation au rendez-vous",
    title: "Connexion",
    subtitle:
      "Préparation structurée pour l’échange médical — ne remplace pas un avis clinique.",
    email: "E-mail",
    emailPlaceholder: "ex. nom@mail.com",
    password: "Mot de passe",
    passwordPlaceholder: "Mot de passe",
    submitting: "Connexion…",
    submit: "Se connecter",
    forgot: "Mot de passe oublié ?",
    noAccount: "Pas encore de compte ?",
    register: "Créer un compte",
    imprint: "Mentions légales",
    privacy: "Confidentialité",
    emailFirst: "Veuillez d’abord confirmer votre e-mail.",
    loginFailed: "Échec de la connexion.",
    loginError: "Erreur de connexion.",
    verifyOk:
      "Votre e-mail est confirmé. Vous pouvez vous connecter.",
    verifyInvalid:
      "Le lien de confirmation est invalide ou expiré. Veuillez vous réinscrire.",
    verifyError:
      "Une erreur s’est produite lors de la confirmation. Réessayez plus tard.",
    resetOk:
      "Mot de passe réinitialisé. Connectez-vous avec le nouveau mot de passe.",
    sessionExpired:
      "Session expirée. Reconnectez-vous pour continuer à utiliser MedScoutX.",
  },
  register: {
    alert: "Attention :",
    alertText: "MedScoutX n’est pas un service d’urgence (112 / 911).",
    title: "Créer un compte",
    subtitle:
      "Compte pour préparer les rendez-vous — pas pour poser un diagnostic.",
    required: "Champ obligatoire",
    email: "E-mail",
    emailHint: "Nous utilisons votre e-mail pour le compte et les informations importantes.",
    password: "Mot de passe",
    passwordPlaceholder: "Au moins 8 caractères, lettre et chiffre",
    passwordHint: "Au moins 8 caractères, dont une lettre et un chiffre.",
    firstName: "Prénom",
    lastName: "Nom",
    birthDate: "Date de naissance",
    minorTitle: "Attention :",
    minorText:
      "Vous n’avez pas l’âge légal. MedScoutX est réservé aux personnes majeures.",
    gender: "Genre",
    genderPlaceholder: "Choisir…",
    genderFemale: "Femme",
    genderMale: "Homme",
    genderDiverse: "Autre",
    genderNone: "Préfère ne pas dire",
    consents: "Consentements",
    ageConfirm: "Je confirme avoir au moins 18 ans",
    termsOpen: "Ouvrir les conditions générales",
    privacyOpen: "Ouvrir la politique de confidentialité",
    disclaimerOpen: "Ouvrir l’avertissement médical",
    legalTextStart: "J’ai lu les",
    legalTextMiddle: "la politique de confidentialité",
    legalTextEnd: " et je les accepte.",
    submit: "Continuer",
    saving: "Enregistrement…",
    cancel: "Annuler",
    imprint: "Mentions légales",
    privacy: "Confidentialité",
    disclaimer: "Avertissement",
    terms: "CGU",
    language: "Langue",
    enterBirth: "Indiquez votre date de naissance.",
    underage:
      "Vous n’avez pas l’âge légal. MedScoutX est réservé aux majeurs.",
    confirmAge: "Confirmez que vous avez au moins 18 ans.",
    checkFields: "Vérifiez les champs obligatoires et les consentements.",
    emailExists: "Cette adresse e-mail est déjà enregistrée.",
    failed: "Inscription impossible.",
    requestError: "Erreur d’inscription.",
    srRequired: "(obligatoire)",
    firstNamePlaceholder: "ex. Marie",
    lastNamePlaceholder: "ex. Dupont",
    conjunctionAnd: "et",
    legalLinksAria: "Informations juridiques",
  },
  footer: {
    imprint: "Mentions légales",
    privacy: "Confidentialité",
    terms: "CGU",
    disclaimer: "Avertissement",
    ariaLabel: "Liens juridiques",
  },
  landing,
  common: {
    continue: "Continuer",
    cancel: "Annuler",
    close: "Fermer",
  },
  startseite,
  forgotPassword: {
    title: "Réinitialiser le mot de passe",
    text: "Saisissez votre e-mail. Nous enverrons un lien de réinitialisation.",
    email: "E-mail",
    placeholder: "nom@mail.com",
    submit: "Demander le lien",
    submitting: "Envoi…",
    back: "Retour à la connexion",
    badge: "Récupération de compte sécurisée",
    success: "Si l’adresse existe, un lien a été envoyé.",
    error: "Une erreur s’est produite. Réessayez plus tard.",
    network: "Erreur réseau. Réessayez plus tard.",
  },
  checkEmail: {
    badge: "Connexion MedScoutX sécurisée",
    title: "Confirmez votre e-mail",
    text: "Nous venons d’envoyer un e-mail de vérification. Ouvrez-le et confirmez pour activer le compte.",
    tip: "Astuce :",
    tipText: "Vérifiez les courriers indésirables ou promotions.",
    resend: "Renvoyer l’e-mail",
    resending: "Envoi…",
    success: "E-mail renvoyé.",
    error: "Une erreur s’est produite. Réessayez plus tard.",
    network: "Erreur réseau. Vérifiez la connexion.",
    missing: "Aucune adresse en attente. Inscrivez-vous à nouveau.",
    footer:
      "Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.",
  },
  resetPassword: {
    title: "Nouveau mot de passe",
    text: "Choisissez un mot de passe sécurisé.",
    label: "Nouveau mot de passe",
    placeholder: "Au moins 8 caractères",
    hint: "Au moins 8 caractères — chiffre et symbole recommandés.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    invalidLink: "Lien invalide ou manquant.",
    shortPassword: "Le mot de passe doit contenir au moins 8 caractères.",
    unknownError: "Erreur inconnue.",
    requestError: "Erreur : ",
    success: "Mot de passe mis à jour. Redirection…",
    network: "Erreur réseau. Réessayez plus tard.",
  },
};

/** fr → merging layers: extended FR modules override base; runtime getMessages merges fr → en → de per key */
export default deepMerge(
  deepMerge(
    deepMerge(deepMerge(deepMerge(frBase, frCore), frAccount), frModules),
    frPractice,
  ),
  deepMerge(
    deepMerge(deepMerge(frPatient, frMedicalInterpreter), frPracticeModules),
    deepMerge(
      deepMerge(deepMerge(deepMerge({ vitals: frVitals }, { healthHistory: frHealthHistory }), { erezept: frErezept }), { sosCard: frSosCard }),
      deepMerge(
        deepMerge(
          { practiceBillingPlausibility: frPracticeBillingPlausibility },
          { practiceIntegrations: frPracticeIntegrationsVendors },
        ),
        { patientBillingExplain: frPatientBillingExplain },
      ),
    ),
  ),
);
