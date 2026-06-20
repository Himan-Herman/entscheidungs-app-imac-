// Patient symptom diary ("Storico dei sintomi") — Italian override.
// Documentation only. No diagnosis, therapy, triage, or urgency.
export const itSymptomDiary = {
  tabName: "Storico dei sintomi",
  addTitle: "Aggiungi voce sintomo",
  editTitle: "Modifica voce sintomo",

  privacyNote:
    "I suoi dati vengono salvati nella sua cartella sanitaria e possono essere eliminati da lei in qualsiasi momento. Questa funzione serve solo a documentare – non fornisce una diagnosi né raccomandazioni terapeutiche.",

  addBtn: "Aggiungi voce",
  save: "Salva",
  saving: "Salvataggio…",
  cancel: "Annulla",
  edit: "Modifica",
  delete: "Elimina",

  loading: "Caricamento…",
  loadingError: "Impossibile caricare le voci.",
  empty: "Nessun sintomo ancora documentato.",
  emptyHint: "Annoti i disturbi nel tempo per averli a portata di mano durante la visita.",
  confirmDelete: "Eliminare davvero questa voce sintomo?",

  symptomLabel: "Sintomo / disturbo",
  symptomPlaceholder: "es. mal di testa, nausea, mal di schiena",
  severityLabel: "Intensità (0–10)",
  occurredAtLabel: "Data / ora",
  durationLabel: "Durata (facoltativo)",
  durationPlaceholder: "es. 2 ore, da ieri",
  bodyRegionLabel: "Parte del corpo (facoltativo)",
  bodyRegionPlaceholder: "es. fronte, zona lombare",
  triggerLabel: "Fattore scatenante (facoltativo)",
  triggerPlaceholder: "es. dopo i pasti, stress",
  betterWithLabel: "Migliora con (facoltativo)",
  betterWithPlaceholder: "es. riposo, calore",
  worseWithLabel: "Peggiora con (facoltativo)",
  worseWithPlaceholder: "es. movimento, luce",
  measuresLabel: "Farmaci / misure (facoltativo)",
  measuresPlaceholder: "es. antidolorifico, bevuto acqua",
  notesLabel: "Nota (facoltativo)",
  notesPlaceholder: "Altri dettagli…",

  error_symptomRequired: "Inserisca un sintomo o un disturbo.",
  error_occurredAtRequired: "Indichi la data e l’ora.",
  error_generic: "Al momento non ha funzionato. Riprovi.",
};
