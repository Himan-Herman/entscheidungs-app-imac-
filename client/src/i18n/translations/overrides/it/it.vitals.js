export default {
  pageTitle: "Le mie misurazioni",
  pageHeading: "Le mie misurazioni",
  intro: "Pressione sanguigna, polso, glicemia, peso e altro — tutto in un unico posto.",
  disclaimer:
    "Panoramica personale — non è un documento medico ufficiale. Mostra le tue misurazioni al medico durante le visite.",

  addEntry: "Aggiungi misurazione",
  noEntries: "Nessuna misurazione registrata.",
  noEntriesHint: "Aggiungi la tua prima misurazione per iniziare il monitoraggio.",
  loadingError: "Impossibile caricare le misurazioni.",

  types: {
    blood_pressure: "Pressione sanguigna",
    heart_rate: "Polso / Frequenza cardiaca",
    glucose: "Glicemia",
    weight: "Peso",
    oxygen: "Saturazione di ossigeno",
    temperature: "Temperatura corporea",
  },

  status: {
    normal: "Normale",
    elevated: "Elevato",
    low: "Basso",
    unknown: "Nessun riferimento",
  },

  chart: {
    title: "Andamento",
    noData: "Dati insufficienti per visualizzare il grafico.",
    systolic: "Sistolica",
    diastolic: "Diastolica",
    value: "Valore",
  },

  form: {
    addHeading: "Nuova misurazione",
    editHeading: "Modifica misurazione",
    typeLabel: "Tipo di misurazione *",
    typePlaceholder: "Selezionare …",
    systolic: "Sistolica (mmHg) *",
    systolicPlaceholder: "es. 120",
    diastolic: "Diastolica (mmHg) *",
    diastolicPlaceholder: "es. 80",
    value: "Valore *",
    unit: "Unità",
    measuredAt: "Data e ora *",
    notes: "Note (opzionale)",
    notesPlaceholder: "Circostanze, come vi sentite, informazioni aggiuntive …",
    save: "Salva",
    saving: "Salvataggio …",
    cancel: "Annulla",
    required: "* Campo obbligatorio",
    fieldRequired: "Questo campo è obbligatorio.",
    dateInvalid: "Data non valida.",
    dateFuture: "La data non può essere nel futuro.",
    valueInvalid: "Inserire un numero valido.",
    valueOutOfRange: "Il valore è fuori dall'intervallo plausibile.",
    saveError: "Salvataggio fallito. Riprovare.",
  },

  card: {
    measuredAt: "Misurato il",
    notes: "Note",
    edit: "Modifica",
    editAria: "Modifica misurazione",
    delete: "Elimina",
    deleteAria: "Elimina misurazione",
    source: "Fonte",
    manual: "Manuale",
  },

  deleteDialog: {
    heading: "Eliminare la misurazione?",
    body: "Questa voce verrà rimossa definitivamente. Questa azione non può essere annullata.",
    confirm: "Sì, elimina",
    cancel: "Annulla",
    deleting: "Eliminazione …",
    error: "Eliminazione fallita. Riprovare.",
  },

  tabs: {
    all: "Tutte",
    blood_pressure: "Pressione",
    heart_rate: "Polso",
    glucose: "Glicemia",
    weight: "Peso",
    oxygen: "SpO₂",
    temperature: "Temperatura",
  },

  refRanges: {
    blood_pressure: "Normale: < 120/80 mmHg",
    heart_rate: "Normale: 60–100 bpm",
    glucose: "Normale a digiuno: 70–100 mg/dL",
    weight: "In base all'altezza (BMI 18,5–24,9)",
    oxygen: "Normale: 95–100 %",
    temperature: "Normale: 36,1–37,2 °C",
  },

  practice: {
    noEntries: "Questo paziente non ha ancora registrato alcuna misurazione.",
    noConsent: "Il paziente non ha ancora autorizzato l'accesso alle misurazioni.",
  },
};
