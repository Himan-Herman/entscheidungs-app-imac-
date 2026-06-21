/** Sections 8–15 — FR */
export default [
  {
    id: "ds-8-speicherfristen",
    heading: "8. Durées de conservation",
    blocks: [
      {
        type: "p",
        text:
          "En règle générale, MedScoutX ne conserve pas durablement sur serveur les historiques de chat, symptômes ou images. Les contenus liés à la santé sont stockés uniquement en local sur votre appareil (p. ex. LocalStorage) et peuvent être supprimés à tout moment.",
      },
      {
        type: "ul",
        items: [
          "Données de compte : adresse e-mail, hachage du mot de passe et langue sont conservés pendant la durée de vie du compte. Après suppression du compte, ces données sont effacées ou anonymisées, sauf obligations légales de conservation.",
          "Données de chat et symptômes : non stockées sur serveur ; elles restent sur votre appareil et sont supprimées lorsque vous utilisez « Nouvelle conversation » ou « Supprimer l’historique ».",
          "Téléchargements d’images : traités brièvement pour transmission au service IA, puis supprimés ; aucune conservation permanente.",
          "Journaux techniques / journaux serveur : pour l’exploitation, la sécurité et l’analyse d’erreurs, les hébergeurs conservent souvent des journaux techniques (horodatage, IP tronquée, détails d’erreur) pendant environ 14 à 30 jours. Ces données ne sont pas reliées à votre profil ni utilisées à des fins publicitaires.",
          "Données locales (LocalStorage, stockage app) : historiques, réglages (langue, accessibilité) restent sur l’appareil et peuvent être effacés via « Supprimer l’historique » ou les réglages de l’appareil.",
        ],
      },
    ],
  },
  {
    id: "ds-9-sicherheit",
    heading: "9. Sécurité",
    blocks: [
      {
        type: "p",
        text:
          "Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre la perte, l’altération, l’accès non autorisé ou d’autres abus, notamment :",
      },
      {
        type: "p",
        text:
          "Le traitement de vos données de santé n’a lieu qu’après consentement explicite lors de la première utilisation des fonctions concernées (chat symptômes, carte corporelle, analyse d’images) via case à cocher et confirmation. Vous pouvez retirer ce consentement à tout moment dans les réglages de l’application.",
      },
      {
        type: "ul",
        items: [
          "chiffrement du transport (TLS/HTTPS),",
          "restrictions d’accès et gestion des rôles/droits,",
          "minimisation des données et pseudonymisation lorsque c’est possible,",
          "mises à jour régulières des systèmes.",
        ],
      },
    ],
  },
  {
    id: "ds-10-kinder",
    heading: "10. Enfants et adolescents",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX ne s’adresse pas aux enfants de moins de 16 ans. Les mineurs ne devraient utiliser l’application qu’avec le consentement de la personne ayant l’autorité parentale. Si nous apprenons qu’un enfant de moins de 16 ans a été traité sans ce consentement, nous supprimerons les données concernées.",
      },
    ],
  },
  {
    id: "ds-11-rechte",
    heading: "11. Vos droits (droits des personnes concernées)",
    blocks: [
      {
        type: "p",
        text:
          "Au titre du RGPD, vous disposez notamment des droits suivants :",
      },
      {
        type: "ul",
        items: [
          "Droit d’accès (art. 15 RGPD) : savoir quelles données personnelles nous traitons à votre sujet.",
          "Droit de rectification (art. 16 RGPD) : corriger des données inexactes ou compléter des données incomplètes.",
          "Droit à l’effacement (art. 17 RGPD) : demander la suppression, sauf obligations légales de conservation.",
          "Droit à la limitation (art. 18 RGPD) : demander la limitation du traitement.",
          "Droit à la portabilité (art. 20 RGPD) : recevoir vos données dans un format structuré et couramment utilisé.",
          "Droit d’opposition (art. 21 RGPD) : vous opposer au traitement fondé sur l’intérêt légitime, compte tenu de votre situation particulière.",
          "Retrait du consentement (art. 7, par. 3 RGPD) : retirer à tout moment un consentement donné, avec effet pour l’avenir.",
          "Droit de réclamation (art. 77 RGPD) : introduire une réclamation auprès d’une autorité de contrôle compétente.",
        ],
      },
      {
        type: "p",
        text:
          "Pour exercer vos droits, contactez-nous aux coordonnées indiquées ci-dessus.",
      },
    ],
  },
  {
    id: "ds-12-cookies",
    heading: "12. Cookies et LocalStorage",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX n’utilise pas de cookies de suivi à des fins publicitaires. Pour des fonctions de confort, un stockage local peut être utilisé sur votre appareil, par exemple :",
      },
      {
        type: "ul",
        items: [
          "mémorisation de la langue,",
          "stockage facultatif de l’historique de chat,",
          "options d’accessibilité (p. ex. taille de police).",
        ],
      },
      {
        type: "p",
        text:
          "Vous pouvez supprimer ces données via les fonctions de l’application ou les réglages de l’appareil ou du navigateur.",
      },
    ],
  },
  {
    id: "ds-13-berechtigungen",
    heading: "13. Autorisations de l’application",
    blocks: [
      {
        type: "p",
        text:
          "Selon l’usage, MedScoutX peut demander les autorisations suivantes :",
      },
      {
        type: "ul",
        items: [
          "Caméra / fichiers : pour prendre ou sélectionner des images à analyser. Facultatif ; révocable dans les réglages du système.",
          "Stockage : pour traiter des fichiers image ou des données temporaires.",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX n’accède pas à vos contenus sans action de votre part et n’envoie pas de données en arrière-plan à des tiers sans nécessité pour le fonctionnement de l’app.",
      },
    ],
  },
  {
    id: "ds-14-ki",
    heading: "14. Informations sur le traitement par IA",
    blocks: [
      {
        type: "ul",
        items: [
          "Vos textes et, le cas échéant, vos images sont traités automatiquement pour proposer des indications et suggestions.",
          "L’IA peut se tromper ou interpréter incorrectement une situation. Vérifiez les résultats de façon critique et utilisez-les uniquement pour vous orienter.",
          "Ne transmettez pas de noms ni de données identifiant des tiers ; évitez les données personnelles excessives.",
          "L’application ne remplace pas un avis médical personnel, un diagnostic ou des soins prodigués par des professionnels de santé.",
        ],
      },
    ],
  },
  {
    id: "ds-15-entscheid",
    heading: "15. Pas de décision automatisée au sens de l’art. 22 RGPD",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX ne pose pas de diagnostics et ne prend pas de décisions automatisées produisant des effets juridiques ou similaires significatifs. Les contenus générés par IA servent uniquement à la préparation structurée et à la documentation de vos informations et ne remplacent pas un avis médical. Dans les situations médicalement pertinentes, vous êtes invité à consulter un professionnel de santé.",
      },
    ],
  },
];
