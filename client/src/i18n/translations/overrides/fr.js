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
import { frSymptomDiary } from "./fr/fr.symptomDiary.js";
import frErezept from "./fr/fr.erezept.js";
import frSosCard from "./fr/fr.sosCard.js";
import { frPracticeBillingPlausibility, frPracticeIntegrationsVendors } from "./fr/fr.practiceBillingPlausibility.js";
import { frPatientBillingExplain } from "./fr/fr.patientBillingExplain.js";
import { frPracticeDirectory } from "./fr/fr.practiceDirectory.js";
import { frTelemedicine } from "./fr/fr.telemedicine.js";

const frBase = {
  roleEntry: {
    hero: {
      title: "Une entrée qui rend votre consultation plus sereine.",
      lead: "MedScoutX vous aide à organiser vos préoccupations avant le rendez-vous — pour des échanges plus clairs, une documentation soignée et des données qui restent entre vos mains.",
    },
    flow: {
      eyebrow: "Comment ça marche",
      title: "De l’incertitude à un échange structuré",
      aria: "Déroulé en trois étapes : Saisir, Structurer, Transmettre",
      steps: [
        {
          title: "Saisir",
          body: "Préparez sereinement vos symptômes, questions et documents, à votre rythme.",
        },
        {
          title: "Structurer",
          body: "MedScoutX transforme vos informations en un aperçu clair et lisible.",
        },
        {
          title: "Transmettre",
          body: "Partagez-le en sécurité avec votre cabinet en PDF ou via un QR code.",
        },
      ],
    },
    metrics: {
      eyebrow: "Ce qui définit MedScoutX",
      title: "Pensé, multilingue, sécurisé",
      note: "Caractéristiques du produit — pas des statistiques d’usage.",
      aria: "Caractéristiques du produit MedScoutX",
      items: [
        {
          value: 2,
          label: "Espaces",
          hint: "Patients et cabinets — une entrée commune",
        },
        {
          value: 5,
          label: "Langues d’interface",
          hint: "Deutsch · English · Français · Español · Italiano",
        },
        {
          value: 14,
          label: "Modules de préparation",
          hint: "Sept pour les patients, sept pour les cabinets",
        },
        {
          value: 3,
          label: "Étapes de préparation",
          hint: "Saisir, Structurer, Transmettre",
        },
      ],
    },
    manifesto: {
      eyebrow: "Une digitalisation centrée sur l’humain",
      title: "Une technologie au service de l’échange — et non l’inverse.",
      body: [
        "La bonne médecine commence par l’écoute. MedScoutX vous décharge de la paperasse et de l’incertitude avant le rendez-vous, pour que le cabinet ait le temps de l’essentiel : l’échange entre une personne et son médecin.",
        "Qui arrive préparé se souvient des bonnes questions, décrit ses symptômes avec plus de précision et comprend mieux les décisions. La structure apporte le calme — et le calme, de meilleurs échanges.",
        "Vos données de santé vous appartiennent. MedScoutX ne traite que ce que la préparation exige, rend chaque partage transparent et transmet les documents chiffrés. La confiance n’est pas une option — c’est le fondement.",
      ],
      trust: [
        "Conforme au RGPD",
        "Ni diagnostic ni traitement — uniquement la préparation",
        "Vos données restent entre vos mains",
      ],
    },
    video: {
      eyebrow: "MedScoutX en action",
      title: "Un bref aperçu",
      body: "Découvrez en quelques secondes ce que représente une préparation structurée — calme, claire et entièrement à votre rythme.",
      aria: "Vidéo de présentation de MedScoutX",
      play: "Lire la vidéo",
      pause: "Mettre la vidéo en pause",
      mute: "Couper le son",
      unmute: "Activer le son",
    },
  },
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
    account: {
      menuAria: "Ouvrir le menu du compte",
      rolePatient: "Compte patient",
      rolePractice: "Compte cabinet",
      avatarPatientAlt: "Photo de profil du patient",
      avatarPracticeAlt: "Logo du cabinet",
    },
  },
  accountPortal: {
    imageTitle: "Photo de profil",
    imageUpload: "Téléverser une photo de profil",
    imageChange: "Modifier la photo de profil",
    imageRemove: "Supprimer la photo de profil",
    imageUploading: "Téléversement…",
    imageHint: "PNG, JPEG ou WebP, max. 2 Mo.",
    imageAlt: "Photo de profil du patient",
    imageErrorType: "Type de fichier non pris en charge. Utilisez PNG, JPEG ou WebP.",
    imageErrorTooLarge: "Fichier trop volumineux. Maximum 2 Mo.",
    imageErrorGeneric: "Échec du téléversement. Veuillez réessayer.",
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
const frComposed = deepMerge(
  deepMerge(
    deepMerge(deepMerge(deepMerge(frBase, frCore), frAccount), frModules),
    frPractice,
  ),
  deepMerge(
    deepMerge(deepMerge(frPatient, frMedicalInterpreter), frPracticeModules),
    deepMerge(
      deepMerge(deepMerge(deepMerge(deepMerge({ vitals: frVitals }, { healthHistory: frHealthHistory }), { symptomDiary: frSymptomDiary }), { erezept: frErezept }), { sosCard: frSosCard }),
      deepMerge(
        deepMerge(
          { practiceBillingPlausibility: frPracticeBillingPlausibility },
          { practiceIntegrations: frPracticeIntegrationsVendors },
        ),
        deepMerge({ patientBillingExplain: frPatientBillingExplain }, { practiceDirectory: frPracticeDirectory }),
      ),
    ),
  ),
);

/** Public Messe/DemoDay showcase — sample data only, no API. */
const frPublicDemo = {
  publicDemo: {
    pageTitle: "MedScoutX — Démo",
    badge: "Démo · données fictives",
    entryButton: "Voir la démo",
    heading: "MedScoutX en un coup d’œil",
    sub: "Parcourez une démo sécurisée avec des données fictives — sans connexion. Tous les contenus sont fictifs et servent uniquement d’illustration.",
    bannerTitle: "Ceci est une démo avec des données fictives.",
    bannerBody:
      "Aucune donnée réelle de patient ou de cabinet n’est affichée. Pour utiliser l’application réelle avec vos données, connectez-vous normalement.",
    backToSite: "Retour à l’accueil",
    loginCta: "Aller à la connexion",
    notice: {
      badge: "DemoDay / Salon",
      title: "Bienvenue sur MedScoutX",
      body: "Une démo publique avec des données fictives est disponible pour le salon et le DemoDay. Vous pouvez découvrir MedScoutX sans compte, avec des données d’exemple, et explorer les principaux espaces.",
      body2: "Les utilisateurs existants peuvent toujours se connecter comme d’habitude. La démo contient uniquement des données fictives et n’affiche aucune donnée réelle de patient.",
      primary: "Voir la démo du salon",
      secondary: "Se connecter",
      dismiss: "Continuer vers l’accueil",
    },
    sectionPatient: "Pour les patients",
    sectionPatientSub: "Ce que les assurés peuvent consulter et gérer dans MedScoutX.",
    sectionPractice: "Pour les cabinets",
    sectionPracticeSub: "Comment les équipes travaillent avec MedScoutX.",
    openLabel: "Voir l’exemple",
    modalClose: "Fermer",
    sampleNote: "Données fictives — à titre d’illustration uniquement.",
    badges: {
      ok: "À jour",
      pending: "En attente",
      info: "Info",
      done: "Terminé",
      scheduled: "Planifié",
      review: "À vérifier",
    },
    tiles: {
      appointments: {
        label: "Rendez-vous",
        sub: "Vos prochains rendez-vous",
        detail: "Rendez-vous à venir et demandés — réunis au même endroit.",
      },
      messages: {
        label: "Messages",
        sub: "Échange sécurisé avec le cabinet",
        detail: "Messages entre le patient et le cabinet lorsqu’un lien existe.",
      },
      medication: {
        label: "Plan de médication",
        sub: "Médicaments actuels",
        detail: "Le plan de médication actuel avec posologie et conseils de prise.",
      },
      documents: {
        label: "Résultats & documents",
        sub: "Documents conservés en sécurité",
        detail: "Résultats partagés par le cabinet et documents personnels.",
      },
      vitals: {
        label: "Signes vitaux",
        sub: "Tension, pouls et plus",
        detail: "Signes vitaux saisis par vous-même, au fil du temps.",
      },
      vaccinations: {
        label: "Carnet de vaccination",
        sub: "Vaccins & rappels",
        detail: "Aperçu numérique des vaccins et des rappels à venir.",
      },
      patients: {
        label: "Patients",
        sub: "Personnes liées",
        detail: "Personnes liées au cabinet — uniquement avec un consentement actif.",
      },
      booking: {
        label: "Rendez-vous & demandes",
        sub: "Traiter les demandes",
        detail: "Accepter, planifier et confirmer les demandes de rendez-vous.",
      },
      anamnesis: {
        label: "Anamnèse",
        sub: "Modèles & réponses",
        detail: "Créer des modèles d’anamnèse et consulter les réponses reçues.",
      },
      billing: {
        label: "Contrôle GOÄ / PKV",
        sub: "Vérifier la plausibilité",
        detail: "Contrôle déterministe des postes de facturation — sans engagement.",
      },
      telemedicine: {
        label: "Téléconsultation",
        sub: "Rendez-vous en vidéo",
        detail: "Planifier et réaliser des téléconsultations.",
      },
      activity: {
        label: "Activité",
        sub: "Événements récents",
        detail: "Aperçu traçable de l’activité récente de l’équipe.",
      },
    },
  },
};

export default deepMerge(deepMerge(frComposed, frTelemedicine), frPublicDemo);
