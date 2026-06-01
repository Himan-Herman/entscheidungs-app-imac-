/**
 * Client-side catalog of standard anamnesis questions.
 * Used in the editor "Insert standard question" dropdown.
 */
export const STANDARD_QUESTION_CATALOG = [
  {
    id: "hauptbeschwerde",
    labelKey: "stdQ_hauptbeschwerde",
    type: "textarea",
    isRequired: true,
    labelJson: { de: "Was ist Ihr Hauptanliegen / Ihre Hauptbeschwerde?", en: "What is your main complaint?", fr: "Quelle est votre plainte principale ?", it: "Qual è il suo problema principale?", es: "¿Cuál es su queja principal?" },
    hintJson:  { de: "Bitte so genau wie möglich beschreiben", en: "Please describe as precisely as possible", fr: "Décrivez aussi précisément que possible", it: "Descrivere il più precisamente possibile", es: "Describa lo más preciso posible" },
    optionsJson: null,
  },
  {
    id: "beschwerden_dauer",
    labelKey: "stdQ_beschwerden_dauer",
    type: "text",
    isRequired: false,
    labelJson: { de: "Seit wann bestehen die Beschwerden?", en: "How long have you had these symptoms?", fr: "Depuis quand avez-vous ces symptômes ?", it: "Da quanto tempo ha questi sintomi?", es: "¿Desde cuándo tiene estos síntomas?" },
    hintJson:  { de: "z. B. seit 3 Tagen, seit 2 Wochen", en: "e.g. for 3 days, for 2 weeks", fr: "p. ex. depuis 3 jours", it: "es. da 3 giorni", es: "p. ej. desde hace 3 días" },
    optionsJson: null,
  },
  {
    id: "schmerzstaerke",
    labelKey: "stdQ_schmerzstaerke",
    type: "number",
    isRequired: false,
    labelJson: { de: "Schmerzstärke (0 = kein Schmerz, 10 = unerträglicher Schmerz)", en: "Pain intensity (0 = no pain, 10 = unbearable)", fr: "Intensité de la douleur (0 = pas de douleur, 10 = insupportable)", it: "Intensità del dolore (0 = nessun dolore, 10 = insopportabile)", es: "Intensidad del dolor (0 = sin dolor, 10 = insoportable)" },
    hintJson:  null,
    optionsJson: null,
  },
  {
    id: "schmerzcharakter",
    labelKey: "stdQ_schmerzcharakter",
    type: "single_choice",
    isRequired: false,
    labelJson: { de: "Schmerzcharakter", en: "Pain character", fr: "Caractère de la douleur", it: "Carattere del dolore", es: "Carácter del dolor" },
    hintJson:  null,
    optionsJson: [
      { de: "Stechend", en: "Stabbing", fr: "Lancinant", it: "Pungente", es: "Punzante" },
      { de: "Dumpf", en: "Dull", fr: "Sourd", it: "Sordo", es: "Sordo" },
      { de: "Brennend", en: "Burning", fr: "Brûlant", it: "Bruciante", es: "Ardiente" },
      { de: "Drückend", en: "Pressing", fr: "Oppressif", it: "Pressante", es: "Opresivo" },
      { de: "Krampfartig", en: "Cramping", fr: "Crampes", it: "Cramposo", es: "Calambre" },
    ],
  },
  {
    id: "vorerkrankungen",
    labelKey: "stdQ_vorerkrankungen",
    type: "textarea",
    isRequired: false,
    labelJson: { de: "Bekannte Vorerkrankungen", en: "Known medical conditions", fr: "Maladies connues", it: "Malattie note", es: "Enfermedades conocidas" },
    hintJson:  { de: "z. B. Bluthochdruck, Diabetes, Herzerkrankung", en: "e.g. hypertension, diabetes, heart disease", fr: "p. ex. hypertension, diabète", it: "es. ipertensione, diabete", es: "p. ej. hipertensión, diabetes" },
    optionsJson: null,
  },
  {
    id: "operationen",
    labelKey: "stdQ_operationen",
    type: "textarea",
    isRequired: false,
    labelJson: { de: "Frühere Operationen", en: "Previous surgeries", fr: "Opérations précédentes", it: "Interventi chirurgici precedenti", es: "Cirugías previas" },
    hintJson:  null,
    optionsJson: null,
  },
  {
    id: "medikamente",
    labelKey: "stdQ_medikamente",
    type: "textarea",
    isRequired: false,
    labelJson: { de: "Aktuelle Medikamente (Name, Dosierung, Häufigkeit)", en: "Current medications (name, dosage, frequency)", fr: "Médicaments actuels (nom, dosage, fréquence)", it: "Farmaci attuali (nome, dosaggio, frequenza)", es: "Medicamentos actuales (nombre, dosis, frecuencia)" },
    hintJson:  null,
    optionsJson: null,
  },
  {
    id: "allergien",
    labelKey: "stdQ_allergien",
    type: "textarea",
    isRequired: false,
    labelJson: { de: "Allergien & Unverträglichkeiten", en: "Allergies & intolerances", fr: "Allergies et intolérances", it: "Allergie & intolleranze", es: "Alergias e intolerancias" },
    hintJson:  { de: "z. B. Penicillin, Latex, Nüsse", en: "e.g. penicillin, latex, nuts", fr: "p. ex. pénicilline, latex", it: "es. penicillina, lattice", es: "p. ej. penicilina, látex" },
    optionsJson: null,
  },
  {
    id: "blutverdünner",
    labelKey: "stdQ_blutverdünner",
    type: "yes_no",
    isRequired: false,
    labelJson: { de: "Nehmen Sie Blutverdünner / Gerinnungshemmer?", en: "Do you take blood thinners / anticoagulants?", fr: "Prenez-vous des anticoagulants ?", it: "Assume anticoagulanti?", es: "¿Toma anticoagulantes?" },
    hintJson:  null,
    optionsJson: null,
  },
  {
    id: "schwangerschaft",
    labelKey: "stdQ_schwangerschaft",
    type: "yes_no",
    isRequired: false,
    labelJson: { de: "Bestehende oder mögliche Schwangerschaft?", en: "Existing or possible pregnancy?", fr: "Grossesse existante ou possible ?", it: "Gravidanza esistente o possibile?", es: "¿Embarazo existente o posible?" },
    hintJson:  null,
    optionsJson: null,
  },
  {
    id: "rauchen",
    labelKey: "stdQ_rauchen",
    type: "yes_no",
    isRequired: false,
    labelJson: { de: "Rauchen Sie?", en: "Do you smoke?", fr: "Fumez-vous ?", it: "Fuma?", es: "¿Fuma usted?" },
    hintJson:  null,
    optionsJson: null,
  },
  {
    id: "alkohol",
    labelKey: "stdQ_alkohol",
    type: "single_choice",
    isRequired: false,
    labelJson: { de: "Alkoholkonsum", en: "Alcohol consumption", fr: "Consommation d'alcool", it: "Consumo di alcol", es: "Consumo de alcohol" },
    hintJson:  null,
    optionsJson: [
      { de: "Kein Alkohol", en: "No alcohol", fr: "Pas d'alcool", it: "Nessun alcol", es: "Sin alcohol" },
      { de: "Gelegentlich", en: "Occasionally", fr: "Occasionnellement", it: "Occasionalmente", es: "Ocasionalmente" },
      { de: "Regelmäßig", en: "Regularly", fr: "Régulièrement", it: "Regolarmente", es: "Regularmente" },
    ],
  },
  {
    id: "hinweise_praxis",
    labelKey: "stdQ_hinweise_praxis",
    type: "textarea",
    isRequired: false,
    labelJson: { de: "Wichtige Hinweise oder Anmerkungen für das Praxisteam", en: "Important notes for the practice team", fr: "Remarques importantes pour l'équipe", it: "Note importanti per il team dello studio", es: "Notas importantes para el equipo" },
    hintJson:  null,
    optionsJson: null,
  },
  {
    id: "dolmetscher",
    labelKey: "stdQ_dolmetscher",
    type: "yes_no",
    isRequired: false,
    labelJson: { de: "Benötigen Sie einen Dolmetscher?", en: "Do you need an interpreter?", fr: "Avez-vous besoin d'un interprète ?", it: "Ha bisogno di un interprete?", es: "¿Necesita un intérprete?" },
    hintJson:  null,
    optionsJson: null,
  },
];

export function emptyLangMap() {
  return { de: "", en: "", fr: "", it: "", es: "" };
}

export function newDraftQuestion() {
  return {
    _clientId: `_new_${Math.random().toString(36).slice(2)}`,
    type: "text",
    labelJson: emptyLangMap(),
    hintJson: emptyLangMap(),
    optionsJson: [],
    isRequired: false,
  };
}

export function questionFromCatalog(catalogItem) {
  return {
    _clientId: `_new_${Math.random().toString(36).slice(2)}`,
    type: catalogItem.type,
    labelJson: { ...emptyLangMap(), ...catalogItem.labelJson },
    hintJson: catalogItem.hintJson ? { ...emptyLangMap(), ...catalogItem.hintJson } : emptyLangMap(),
    optionsJson: Array.isArray(catalogItem.optionsJson) ? catalogItem.optionsJson.map((o) => ({ ...emptyLangMap(), ...o })) : [],
    isRequired: Boolean(catalogItem.isRequired),
  };
}
