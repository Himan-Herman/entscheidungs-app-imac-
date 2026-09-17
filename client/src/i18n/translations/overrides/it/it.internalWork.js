/**
 * Fasi 5A–5C in italiano — note interne, promemoria e centro notifiche.
 *
 * «Promemoria» e non «follow-up»: è un segnale di lavoro per il team, mai un
 * follow-up clinico, e la parola non deve suggerire urgenza medica.
 * «Struttura» segue la terminologia già in uso. Dai del tu.
 */
export const itInternalWork = {
  practiceInternalWork: {
    sectionTitle: "Note interne e promemoria",
    teamOnlyBadge: "Solo per il team della struttura",
    teamOnlyExplainer:
      "Queste voci sono visibili solo al tuo team e solo all'interno di questa relazione con il paziente. Non vengono mostrate né inviate al paziente.",

    notesTitle: "Note interne",
    noteComposerLabel: "Scrivi una nota interna",
    noteComposerHint: "Non viene inviata al paziente.",
    notePlaceholder: "es. richiamare, richiedere referto",
    notePlaceholderShort: "Nota interna",
    saveNote: "Salva nota",
    editNote: "Modifica",
    edited: "modificata",
    notesEmpty: "Ancora nessuna nota interna.",
    unknownAuthor: "Team della struttura",

    remindersTitle: "Promemoria",
    remindersHint:
      "Un promemoria è un segnale di lavoro per il tuo team. Il testo non viene analizzato.",
    reminderTitleLabel: "Che cosa c'è da fare?",
    reminderPlaceholder: "es. ricontrollare il 30/08",
    reminderDueLabel: "Scadenza",
    saveReminder: "Crea promemoria",
    remindersEmpty: "Nessun promemoria in questa vista.",
    dueOn: "Scadenza:",
    assignedTo: "Responsabile:",
    markDone: "Segna come completato",
    statusOpen: "Da fare",
    statusDone: "Completato",
    filterLabel: "Filtra i promemoria",
    filter_open: "Da fare",
    filter_completed: "Completati",
    filter_all: "Tutti",

    loading: "Caricamento…",
    saving: "Salvataggio…",
    cancel: "Annulla",
    loadError: "Impossibile caricare le note interne e i promemoria.",
    saveError: "Salvataggio non riuscito. Riprova.",
  },

  notificationCenter: {
    toggleLabel: "Posta in arrivo",
    toggleAria: "Apri la posta in arrivo",
    toggleAriaWithCount: "Apri la posta in arrivo, {count} non letti",
    panelTitle: "Novità per te",
    panelTitlePractice: "Novità della struttura",
    unreadLabel: "{count} non letti",
    newLabel: "{count} nuovi",
    unreadOne: "1 non letto",
    newOne: "1 nuovo",
    empty: "Nessuna novità.",
    emptyHint: "I nuovi messaggi compaiono qui e nella posta in arrivo.",
    showAll: "Mostra tutte le notifiche",
    itemUnread: "Non letto",
    loading: "Caricamento…",
    error: "Caricamento non riuscito.",
    retry: "Riprova",
    remindersHeading: "Promemoria da fare",
    remindersCount: "{count} da fare",
    remindersOne: "1 da fare",
    remindersLink: "Apri nell'elenco pazienti",
    remindersNone: "Nessun promemoria da fare",
  },

  practicePatients: {
    tabInternalWork: "Note interne",
    filterOpenReminders: "Promemoria da fare",
    filterOpenRemindersYes: "Con promemoria da fare",
    filterOpenRemindersNo: "Senza promemoria da fare",
    openRemindersBadge: "{count} da fare",
    openRemindersAria: "{count} promemoria da fare",
    internalNotesBadge: "{count} note",
    internalNotesAria: "{count} note interne del team",
  },
};

export default itInternalWork;
