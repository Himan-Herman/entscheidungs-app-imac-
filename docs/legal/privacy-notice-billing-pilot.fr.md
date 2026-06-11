# Avis de confidentialité — Plausibilité de facturation GOÄ/PKV (pilote) — PROJET

> ⚠️ **PROJET DE TRADUCTION — RÉVISION JURIDIQUE REQUISE AVANT PUBLICATION.**
> Ceci est un **projet** de traduction de la version allemande de référence ; ce n'est
> **pas un conseil juridique**, ce n'est **pas contraignant** et **pas définitif**. La
> version de référence est la version allemande
> ([`privacy-notice-billing-pilot.de.md`](privacy-notice-billing-pilot.de.md)). Une
> révision indépendante (DPO/juriste) est requise avant publication. Les espaces
> réservés `«entre chevrons»` doivent être complétés au préalable.
>
> Documents associés : [projet d'AVV/DPA](avv-dpa-medscoutx-pilot.de.md) ·
> [MTO/TOM](tom-medscoutx-pilot.de.md) ·
> [Sous-traitants](subprocessors-medscoutx-pilot.de.md)

---

## 1. Responsable / Sous-traitant

- **Cabinet (Responsable du traitement) :** `«nom, adresse, contact»` — responsable des
  données de facturation et de contexte saisies pendant le pilote.
- **MedScoutX (Sous-traitant) :** `«société exploitante, adresse, contact»` — traite les
  données **pour le compte et sur instruction** du cabinet, sur la base d'un accord de
  traitement (AVV/DPA, voir [projet](avv-dpa-medscoutx-pilot.de.md)).
- **Contact protection des données :** `«e-mail / DPO le cas échéant»`
- La répartition finale des rôles est à confirmer lors de la révision juridique.

---

## 2. Finalités

- Aide à la **plausibilité de facturation** (GOÄ/PKV)
- Génération d'**avertissements/indications déterministes**
- Génération d'un **rapport PDF**
- Soutien à l'**export, à la suppression et à la conservation** (droits des personnes)
- **Journalisation, audit et sécurité internes**

---

## 3. Catégories de données personnelles

- Identifiants de compte/personnel (`createdByUserId`, `actorUserId`)
- Identifiants de profil de cabinet (`practiceProfileId`)
- Code GOÄ, facteur, quantité
- **Texte de contexte libre** facultatif (`contextText`)
- Métadonnées d'avertissement/résultat
- Métadonnées de correspondance catalogue
- Métadonnées du rapport PDF
- Métadonnées du journal d'audit
- Journaux techniques
- **Métadonnées de revue IA** — uniquement si l'IA est activée en interne (désactivée
  par défaut en externe, voir §5)

---

## 4. Données à NE PAS saisir

Aucun identifiant de patient ne doit être saisi — en particulier dans le champ libre
`contextText` :

- Nom du patient
- Date de naissance
- Numéro d'assuré
- Texte de diagnostic complet
- Texte clinique libre
- Autres identifiants directs de patient

Les champs patient nommés sont rejetés par le système (HTTP 400). Le champ libre ne peut
pas empêcher techniquement la saisie de données patient — le cabinet l'assure par la
**formation** du personnel.

---

## 5. Statut de l'IA

- La revue assistée par IA est **désactivée par défaut** en externe
  (`ENABLE_BILLING_AI_REVIEW=false`).
- L'IA n'est utilisée qu'en **interne/staging** et uniquement sur accord séparé.
- Une activation ultérieure exige OpenAI comme sous-traitant divulgué, une base légale
  documentée et une analyse de transfert (voir AVV §15).
- Les sorties IA sont **non contraignantes** et ne constituent **pas** une décision
  médicale, juridique ou de remboursement.

---

## 6. Bases légales (espaces réservés)

- **Pour le cabinet (responsable) :** base légale `«à confirmer par le cabinet/juriste»`
  — probablement exécution du contrat (art. 6, §1, b RGPD) ou intérêt légitime
  (art. 6, §1, f RGPD).
- **Pour MedScoutX (sous-traitant) :** traitement au titre de l'AVV/DPA et des
  instructions du cabinet.
- La base légale définitive n'est déterminée qu'après révision juridique ; ce projet ne
  fait **aucune** déclaration contraignante.

---

## 7. Destinataires / Sous-traitants

- Hébergeur/compute : `«à confirmer»`
- Base de données/hébergement : `«à confirmer»`
- Fournisseur e-mail : `«à confirmer, le cas échéant»`
- **OpenAI :** uniquement si l'IA est activée (désactivée par défaut en externe)
- Détails : [annexe sous-traitants](subprocessors-medscoutx-pilot.de.md). Les
  fournisseurs non confirmés sont marqués « à confirmer » et ne sont pas inventés.

---

## 8. Conservation et suppression

- **Durée de conservation :** recommandation **180 jours**
  (`BILLING_SESSION_RETENTION_DAYS=180`, indicatif) — à finaliser par le cabinet/DPO.
  **Aucune** purge automatique ; la conservation est appliquée via un script manuel (D5).
- **Suppression de compte :** la suppression complète du compte supprime les données de
  facturation associées dans la même transaction (D2).
- **Effacement opérateur :** suppression ciblée par cabinet/utilisateur/session via un
  script opérateur avec dry-run et garde de production (D4).
- **Export :** export JSON respectueux de la vie privée de ses propres données (D3 ;
  `contextText` brut exclu).

---

## 9. Droits des personnes concernées

Sous réserve des conditions légales, vous disposez des droits suivants :

- Accès (art. 15 RGPD)
- Rectification (art. 16)
- Effacement (art. 17)
- Limitation (art. 18)
- Portabilité (art. 20)
- Opposition le cas échéant (art. 21)
- Réclamation auprès d'une autorité de contrôle (art. 77)

Contact pour l'exercice : `«responsable / contact protection des données»`.

---

## 10. Sécurité

- Contrôle d'accès et accès par rôle au cabinet (propriétaire/admin uniquement)
- Chiffrement en transit (TLS, à confirmer côté hébergeur)
- Journaux d'audit des événements de cycle de vie des sessions
- Scripts opérateur avec dry-run par défaut et garde de production
- **Aucun** connecteur PVS/FHIR/KIS en production sans accord séparé
- Détails : [annexe MTO/TOM](tom-medscoutx-pilot.de.md)

---

## 11. Portée et limites

- Aide à la plausibilité **non contraignante**
- Utilise un **sous-catalogue GOÄ local** (pas une source officielle complète)
- **Pas** de diagnostic
- **Pas** de recommandation thérapeutique
- **Pas** de triage
- **Pas** de garantie/prédiction de remboursement
- **Pas** de décision de facturation juridiquement contraignante

---

*Statut : **PROJET DE TRADUCTION — révision juridique requise avant publication.** La
version allemande de référence prévaut en cas de divergence.*
