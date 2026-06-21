/** Sections 1–7 — merged in datenschutz.js */
export default [
  {
    id: "ds-1-verantwortlich",
    heading: "1. Responsable du traitement",
    blocks: [
      {
        type: "p",
        text:
          "La présente politique de confidentialité explique comment l’application MedScoutX traite les données personnelles.",
      },
      {
        type: "address",
        lineStrong: "Responsable du traitement au sens du RGPD",
        lines: [
          "Himan Khorshidi",
          "Eisenstraße 64",
          "40227 Düsseldorf, Allemagne",
        ],
      },
      {
        type: "dl",
        items: [
          { dt: "E-mail", dd: "contact@medscoutx.com", href: "mailto:contact@medscoutx.com" },
          { dt: "Téléphone", dd: "+49 211 15895272", href: "tel:+4921115895272" },
        ],
      },
    ],
  },
  {
    id: "ds-2-worum",
    heading: "2. De quoi s’agit-il ?",
    blocks: [
      {
        type: "p",
        text:
          "Ce document décrit comment MedScoutX traite vos données personnelles lorsque vous :",
      },
      {
        type: "ul",
        items: [
          "installez l’application et créez un compte,",
          "saisissez de façon structurée des informations pour une consultation médicale et les préparez éventuellement en PDF,",
          "saisissez des symptômes via le chat texte,",
          "sélectionnez des régions du corps via la carte corporelle,",
          "téléchargez des images (par ex. photos cutanées ou images médicales).",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX n’est pas un outil de diagnostic ou de traitement et ne remplace pas un examen médical ni des conseils professionnels. L’application aide à préparer et à documenter de façon structurée vos propres informations avant des rendez-vous médicaux. Si vous générez un PDF uniquement en local sans transmission, les indications particulières décrites dans ce cadre s’appliquent.",
      },
    ],
  },
  {
    id: "ds-3-kategorien",
    heading: "3. Catégories de données personnelles",
    blocks: [
      {
        type: "p",
        text:
          "Selon votre utilisation de l’application, les catégories suivantes de données personnelles peuvent être traitées :",
      },
      {
        type: "ul",
        items: [
          "Données de compte : adresse e-mail, éventuellement nom ou identifiant, hachage du mot de passe (pas de mot de passe en clair), langue.",
          "Données relatives à la santé : saisies textuelles sur les symptômes, réponses dans le chat symptômes, sélection de régions corporelles sur la carte, informations sanitaires dans des champs libres.",
          "Données d’image : images que vous téléchargez (par ex. lésions cutanées, photos de zones du corps ou autres zones pertinentes pour la santé). MedScoutX utilise ces images pour décrire des éléments visibles importants, mais pas pour un diagnostic médical autonome.",
          "Données d’usage et journaux : horodatage des requêtes, journaux d’erreurs techniques, éventuellement adresse IP tronquée, informations navigateur/appareil, système d’exploitation, version de l’app.",
          "Données d’abonnement et contractuelles (si vous utilisez un abonnement payant) : formule, durée, statut, informations techniques d’achat (via App Store / Play Store). Les données de paiement complètes (p. ex. numéros de carte) ne sont pas stockées par MedScoutX mais traitées par le prestataire de paiement de la plateforme.",
          "Données locales sur votre appareil : par ex. historique de chat stocké localement ou réglages (langue, accessibilité) dans le LocalStorage ou mécanismes comparables.",
        ],
      },
    ],
  },
  {
    id: "ds-4-zwecke",
    heading: "4. Finalités du traitement",
    blocks: [
      {
        type: "ul",
        items: [
          "Fourniture des fonctions de l’application : connexion, inscription, gestion du compte et fonctions principales de MedScoutX.",
          "Chat symptômes et questions complémentaires assistées par IA : traitement de vos saisies textuelles pour fournir des questions et indications utiles pour une clarification ultérieure.",
          "Carte corporelle : mise en correspondance des régions sélectionnées avec des questions complémentaires et indications IA adaptées.",
          "Analyse d’images : traitement des images téléchargées pour décrire des éléments visibles importants et suggérer des pistes (par ex. clarification médicale). Aucun diagnostic automatique n’est posé au sens médico-légal.",
          "Stabilité et sécurité : analyse d’erreurs, détection d’abus, protection des systèmes et des données.",
          "Exigences légales : respect d’obligations légales (par ex. documentation des mesures de sécurité IT, durées de conservation).",
        ],
      },
    ],
  },
  {
    id: "ds-5-rechtsgrundlagen",
    heading: "5. Bases juridiques (RGPD)",
    blocks: [
      {
        type: "p",
        text:
          "Selon les cas, nous nous appuyons sur les bases juridiques suivantes :",
      },
      {
        type: "ul",
        items: [
          "Art. 6, par. 1, let. b RGPD — exécution du contrat : pour fournir les fonctions techniques telles que l’inscription, la connexion et la gestion du compte.",
          "Art. 6, par. 1, let. f RGPD — intérêt légitime : sécurité des systèmes informatiques, analyse d’erreurs et détection d’abus.",
          "Art. 6, par. 1, let. c RGPD — obligation légale : lorsque des obligations légales de conservation existent (p. ex. obligations fiscales liées aux abonnements).",
          "Art. 9, par. 2, let. a RGPD — consentement explicite : base principale pour le traitement des données de santé, y compris symptômes saisis volontairement, sélection sur la carte corporelle et téléchargement/analyse d’images. Avant la première utilisation, un consentement explicite est demandé (case à cocher et confirmation). Vous pouvez retirer votre consentement à tout moment pour l’avenir.",
        ],
      },
    ],
  },
  {
    id: "ds-6-auftragsverarbeiter",
    heading: "6. Sous-traitants et transmission à des tiers",
    blocks: [
      {
        type: "p",
        text:
          "Pour certaines fonctions, MedScoutX fait appel à des prestataires en qualité de sous-traitants au sens de l’art. 28 RGPD. Les principales catégories sont :",
      },
      {
        type: "ul",
        items: [
          "Hébergeurs (UE) : un fournisseur cloud européen fournit l’infrastructure pour serveurs et bases de données (p. ex. Render.com avec localisation UE).",
          "Prestataire IA — OpenAI (États-Unis) : pour le traitement IA de vos textes, données d’image et informations de carte corporelle, MedScoutX utilise les services d’OpenAI LLC (San Francisco, USA). Les contenus sont transmis de façon chiffrée, traités puis supprimés après traitement.",
          "Prestataires e-mail : un prestataire technique assure l’envoi des e-mails système (p. ex. vérification).",
        ],
      },
      {
        type: "p",
        text:
          "Tous les sous-traitants sont contractuellement tenus conformément à l’art. 28 RGPD et ne traitent les données que sur instruction. Il n’y a pas de transmission à des fins publicitaires ou marketing.",
      },
    ],
  },
  {
    id: "ds-7-drittland",
    heading: "7. Transferts vers des pays tiers",
    blocks: [
      {
        type: "p",
        text:
          "Lors de l’utilisation des fonctions IA de MedScoutX, des contenus (textes, symptômes, données d’image, etc.) sont transférés vers OpenAI LLC aux États-Unis. Ce transfert constitue un transfert vers un pays tiers au sens du RGPD.",
      },
      {
        type: "p",
        text:
          "Pour garantir un niveau de protection adéquat, le transfert repose sur les clauses contractuelles types de l’UE (art. 46 RGPD) ainsi que sur des mesures techniques et organisationnelles complémentaires (chiffrement pendant le transit, durée de traitement courte, suppression après réponse du service IA).",
      },
      {
        type: "p_link",
        before: "Pour en savoir plus, voir la documentation sur la confidentialité d’OpenAI : ",
        href: "https://openai.com/policies/privacy-policy",
        linkText: "https://openai.com/policies/privacy-policy",
        after: "",
      },
    ],
  },
];
