export default {
  pageTitle: "Mes mesures",
  pageHeading: "Mes mesures",
  intro: "Tension artérielle, pouls, glycémie, poids et plus — tout en un seul endroit.",
  disclaimer:
    "Aperçu personnel — pas un document médical officiel. Présentez vos mesures à votre médecin lors des consultations.",

  addEntry: "Ajouter une mesure",
  noEntries: "Aucune mesure enregistrée pour le moment.",
  noEntriesHint: "Ajoutez votre première mesure pour commencer le suivi.",
  loadingError: "Impossible de charger les mesures.",

  types: {
    blood_pressure: "Tension artérielle",
    heart_rate: "Pouls / Fréquence cardiaque",
    glucose: "Glycémie",
    weight: "Poids",
    oxygen: "Saturation en oxygène",
    temperature: "Température corporelle",
  },

  status: {
    normal: "Normal",
    elevated: "Élevé",
    low: "Bas",
    unknown: "Pas de référence",
  },

  chart: {
    title: "Évolution",
    noData: "Pas assez de données pour afficher un graphique.",
    systolic: "Systolique",
    diastolic: "Diastolique",
    value: "Valeur",
  },

  form: {
    addHeading: "Nouvelle mesure",
    editHeading: "Modifier la mesure",
    typeLabel: "Type de mesure *",
    typePlaceholder: "Veuillez sélectionner …",
    systolic: "Systolique (mmHg) *",
    systolicPlaceholder: "ex. 120",
    diastolic: "Diastolique (mmHg) *",
    diastolicPlaceholder: "ex. 80",
    value: "Valeur *",
    unit: "Unité",
    measuredAt: "Date et heure *",
    notes: "Notes (optionnel)",
    notesPlaceholder: "Circonstances, ressenti, informations complémentaires …",
    save: "Enregistrer",
    saving: "Enregistrement …",
    cancel: "Annuler",
    required: "* Champ obligatoire",
    fieldRequired: "Ce champ est obligatoire.",
    dateInvalid: "Date invalide.",
    dateFuture: "La date ne peut pas être dans le futur.",
    valueInvalid: "Veuillez saisir un nombre valide.",
    valueOutOfRange: "La valeur est en dehors de la plage plausible.",
    saveError: "Échec de l'enregistrement. Veuillez réessayer.",
  },

  card: {
    measuredAt: "Mesuré le",
    notes: "Notes",
    edit: "Modifier",
    editAria: "Modifier la mesure",
    delete: "Supprimer",
    deleteAria: "Supprimer la mesure",
    source: "Source",
    manual: "Manuel",
  },

  deleteDialog: {
    heading: "Supprimer la mesure ?",
    body: "Cette entrée sera définitivement supprimée. Cette action est irréversible.",
    confirm: "Oui, supprimer",
    cancel: "Annuler",
    deleting: "Suppression …",
    error: "Échec de la suppression. Veuillez réessayer.",
  },

  tabs: {
    all: "Toutes",
    blood_pressure: "Tension",
    heart_rate: "Pouls",
    glucose: "Glycémie",
    weight: "Poids",
    oxygen: "SpO₂",
    temperature: "Température",
  },

  refRanges: {
    blood_pressure: "Normal : < 120/80 mmHg",
    heart_rate: "Normal : 60–100 bpm",
    glucose: "Normal à jeun : 70–100 mg/dL",
    weight: "Selon la taille (IMC 18,5–24,9)",
    oxygen: "Normal : 95–100 %",
    temperature: "Normal : 36,1–37,2 °C",
  },

  practice: {
    noEntries: "Ce patient n'a encore enregistré aucune mesure.",
    noConsent: "Le patient n'a pas encore autorisé l'accès à ses mesures.",
  },
};
