/** Forma del "tu", come nel resto dell'area paziente. */
export const itPatientPractices = {
  pageTitle: "I miei dati e i miei studi – MedScoutX",
  heading: "I miei dati e i miei studi",
  intro:
    "I tuoi dati personali e quelli di ogni studio restano separati, così vedi sempre da dove proviene una voce.",
  loading: "Caricamento …",
  loadError: "Non è stato possibile caricare i tuoi dati.",
  retry: "Riprova",

  ownData: {
    title: "I miei dati personali",
    description:
      "Voci che hai inserito tu stesso o importato dal tuo dispositivo. Non appartengono a nessuno studio.",
    empty: "Non hai ancora inserito voci personali.",
  },

  practices: {
    title: "I miei studi",
    description:
      "Ogni studio ha la propria area. Una voce legata a uno studio compare solo lì.",
    tablistLabel: "Seleziona uno studio",
    empty: "Al momento non sei collegato a nessuno studio.",
    single: "Sei collegato a uno studio.",
    emptySection: "Per questo studio non ci sono ancora voci.",
    inactiveTitle: "Collegamenti terminati",
    inactiveDescription:
      "Questi collegamenti non sono più attivi. Gli studi non hanno più accesso.",
    statusRevoked: "Terminato",
    statusInvited: "Richiesta in sospeso",
    statusArchived: "Archiviato",
  },

  provenance: {
    own: "I tuoi dati personali",
    selfEntered: "Inserito da te",
    deviceImport: "Importato dal tuo dispositivo",
    context: "Riferimento allo studio",
    contextWith: "Riferimento allo studio: {practice}",
    contextUnavailable: "Riferimento allo studio non disponibile",
    unavailableHint:
      "Questa voce al momento non può essere associata a nessuno dei tuoi collegamenti con uno studio.",
  },

  sections: {
    vitals: "Misurazioni",
    vaccinations: "Vaccinazioni",
    allergies: "Allergie",
    diagnoses: "Diagnosi e informazioni sulla salute",
  },

  counts: {
    entries: "{count} voci",
    entry: "1 voce",
    none: "Nessuna voce",
  },
};

export const itDocumentSharing = {
  sharedData: {
    title: "Dati condivisi",
    description:
      "Documenti che hai condiviso deliberatamente con un altro studio. Puoi revocare ogni condivisione in qualsiasi momento.",
    empty: "Non hai ancora condiviso alcun documento con un altro studio.",
    listLabel: "Le tue condivisioni di documenti",
    loading: "Caricamento delle condivisioni …",
    loadError: "Non è stato possibile caricare le tue condivisioni.",
    retry: "Riprova",
  },

  fields: {
    document: "Documento",
    sourcePractice: "Studio di origine",
    targetPractice: "Studio destinatario",
    status: "Stato",
    grantedAt: "Condiviso il",
    revokedAt: "Revocato il",
    expiresAt: "Valido fino al",
  },

  status: {
    active: "Attivo",
    revoked: "Revocato",
    expired: "Scaduto",
  },

  share: {
    action: "Condividi con uno studio",
    dialogTitle: "Condividi il documento con uno studio",
    selectPractice: "Seleziona uno studio",
    selectPlaceholder: "Scegli",
    readOnlyNotice:
      "Lo studio selezionato riceve esclusivamente l'accesso in lettura a questo documento. Non può modificarlo, eliminarlo né trasmetterlo.",
    readOnly: "Accesso in lettura",
    confirm: "Condividi",
    cancel: "Annulla",
    submitting: "Condivisione in corso …",
    success: "Condivisione riuscita.",
    noOtherPractice:
      "Non è disponibile nessun altro studio attivo con cui condividere questo documento.",
    alreadyShared: "Questo documento è già condiviso con questo studio.",
    ariaLabel: "Condividi il documento {document} con {practice}",
  },

  revoke: {
    action: "Revoca la condivisione",
    dialogTitle: "Revoca la condivisione",
    confirm: "Revoca",
    cancel: "Annulla",
    submitting: "Revoca in corso …",
    success: "Revoca riuscita.",
    notice:
      "Dopo la revoca lo studio destinatario non può più aprire né scaricare il documento tramite MedScoutX.",
    externalCopies:
      "Le copie già salvate al di fuori di MedScoutX non possono essere richiamate automaticamente.",
    ariaLabel: "Revoca la condivisione del documento {document} per {practice}",
  },

  practiceView: {
    sharedByPatient: "Condiviso dal paziente",
    origin: "Origine: {practice}",
    readOnlyHint:
      "Accesso in lettura. Questo documento appartiene a un altro studio ed è stato condiviso dalla paziente o dal paziente.",
  },

  errors: {
    document_not_found: "Il documento non è disponibile.",
    link_not_found: "Questo collegamento con lo studio non è disponibile.",
    link_not_active: "Questo collegamento con lo studio non è attivo.",
    document_already_available_to_practice:
      "Questo documento proviene già da quello studio.",
    share_already_active: "Questo documento è già condiviso con questo studio.",
    grant_not_found: "Questa condivisione non è disponibile.",
    unsupported_field: "La richiesta conteneva dati inattesi.",
    forbidden: "Non hai l'autorizzazione necessaria.",
    server_error: "Si è verificato un errore. Riprova più tardi.",
  },
};
