/**
 * Interprete medico — modulo paziente B2C (IT).
 * Solo supporto alla comunicazione; senza diagnosi, triage né raccomandazioni terapeutiche.
 */
export default {
  hub: {
    title: "Interprete medico",
    subtitle: "Traduzione in tempo reale e supporto alla comunicazione",
    cta: "Avvia conversazione",
    newConversation: "Nuova conversazione",
    trustLine:
      "Solo supporto alla comunicazione — senza diagnosi né raccomandazioni terapeutiche.",
    privacyLine:
      "Microfono solo con la tua autorizzazione. Il contenuto delle conversazioni resta per impostazione predefinita su questo dispositivo.",
    ariaLabel: "Apri il modulo Interprete medico",
  },

  chrome: {
    moduleTitle: "Interprete medico",
    backToHub: "Torna all’area paziente",
    backToSetup: "Torna alla configurazione",
  },

  safety: {
    strip:
      "Supporto alla comunicazione — senza valutazione medica, diagnosi né raccomandazioni terapeutiche.",
    noDiagnosis: "Senza diagnosi",
    noTriage: "Senza valutazione di urgenza",
    noTreatment: "Senza raccomandazioni terapeutiche",
    verifyTranslation:
      "Le traduzioni automatiche possono contenere errori. Verifica le informazioni importanti con il tuo team sanitario.",
    communicationOnly:
      "Questo modulo supporta traduzione e documentazione delle conversazioni — non la valutazione medica della tua situazione.",
  },

  start: {
    pageTitle: "MedScoutX — Prepara la conversazione",
    heading: "Interprete medico",
    intro:
      "Prepara una conversazione multilingue con il tuo team sanitario. La configurazione richiede solo pochi passaggi.",
    stepOf: "Passaggio {{current}} di {{total}}",
    back: "Indietro",
    next: "Continua",
    cancel: "Annulla",
    cancelConfirm: "Annullare la configurazione?",
  },

  languages: {
    heading: "Scegli le lingue",
    intro:
      "Quali lingue userai tu e il tuo team sanitario durante la visita?",
    patientLabel: "La tua lingua",
    doctorLabel: "Lingua del team sanitario",
    patientHint: "La lingua che parli",
    doctorHint: "La lingua parlata dal team sanitario",
    required: "Seleziona entrambe le lingue.",
    selectEmpty: "Seleziona",
    loadingDefaults: "Caricamento lingue predefinite…",
    searchLabel: "Cerca lingua",
    searchPlaceholder: "Cerca per nome o codice…",
    searchEmpty: "Nessuna lingua corrisponde alla ricerca.",
    mixedDirectionNote:
      "Questa conversazione usa lingue da destra a sinistra e da sinistra a destra. Leggi ogni sezione nel proprio senso.",
  },

  profile: {
    heading: "Profilo per questa conversazione",
    intro:
      "Facoltativo: usa i dati salvati dell’account per questa conversazione (es. per documentazione successiva).",
    consentLabel: "Usa i dati profilo salvati per questa conversazione",
    consentHint:
      "Nome, data di nascita e contatti — solo se acconsenti. Non vengono usati dati del profilo salute.",
    accountLink: "Modifica nelle impostazioni account",
    loadError:
      "Impossibile caricare il profilo. Puoi continuare senza dati profilo.",
    skipped: "Continua senza dati profilo",
  },

  doctorInfo: {
    heading: "Dettagli della visita (facoltativo)",
    intro:
      "Queste informazioni facilitano l’orientamento e la documentazione successiva. Puoi lasciare tutti i campi vuoti.",
    toggleShow: "Aggiungi dettagli",
    toggleHide: "Nascondi dettagli",
    doctorName: "Nome del professionista",
    doctorNamePlaceholder: "es. Dott. Rossi",
    practiceName: "Studio o clinica",
    practiceNamePlaceholder: "Nome della struttura",
    specialty: "Specialità",
    specialtyPlaceholder: "es. Medicina generale",
    appointmentDate: "Appuntamento (data)",
    conversationTitle: "Titolo di questa conversazione",
    conversationTitlePlaceholder: "es. Visita di controllo",
  },

  privacy: {
    heading: "Informazioni e consenso",
    body1:
      "Questo modulo supporta traduzione e documentazione delle conversazioni tra te e il tuo team sanitario. Non offre diagnosi, valutazione di urgenza né raccomandazioni terapeutiche.",
    body2:
      "Traduzione automatica e riconoscimento vocale possono essere imprecisi o incompleti. Verifica le informazioni importanti con il tuo team sanitario.",
    body3:
      "L’audio viene inviato in modo sicuro solo per la trascrizione, elaborato in memoria e non archiviato sui server MedScoutX né in questa app.",
    body4:
      "I dati della conversazione restano solo su questo dispositivo nella fase 1 (locale). Non viene creato un registro server del contenuto delle conversazioni.",
    storageLabel: "Salva la conversazione su questo dispositivo",
    storageHint:
      "Ti permette di continuare e riaprire su questo dispositivo. Puoi eliminare la conversazione in seguito.",
    noStorageWarning:
      "Senza salvataggio, questa conversazione si perde uscendo dalla pagina.",
    acceptLabel: "Ho letto e compreso le informazioni",
    acceptRequired: "Conferma di aver preso visione delle informazioni.",
    beginCta: "Inizia la conversazione",
    legalLinks:
      "Ulteriori informazioni in Privacy e note legali.",
    linkPrivacy: "Privacy",
    linkDisclaimer: "Informazioni",
  },

  live: {
    mockOriginalPatient: "Vorrei parlare di qualcosa di importante.",
    mockOriginalDoctor: "Continua con le tue parole.",
    mockTranslationPreview:
      "Anteprima traduzione — il servizio di traduzione sarà collegato in una versione successiva.",
    statusRegion: "Stato registrazione",
    currentTurn: "Enunciato attuale",
  },

  room: {
    pageTitle: "MedScoutX — Conversazione in diretta",
    heading: "Conversazione in diretta",
    languagesLabel: "{{patient}} ↔ {{doctor}}",
    statusIdle: "Pronto",
    statusRecording: "Registrazione…",
    statusUploading: "Chiusura registrazione…",
    statusTranscribing: "Riconoscimento vocale…",
    statusTranslating: "Traduzione…",
    statusSimplifying: "Semplificazione linguaggio…",
    statusSpeaking: "Riproduzione audio…",
    statusReadyForNext: "Pronto per il prossimo enunciato",
    statusEditingDraft: "Rivedi il testo parlato prima di tradurre",
    statusBlocked: "Traduzione bloccata — modifica il testo",
    statusError: "Si è verificato un problema in questo turno",
    speakerDirection: "Parli in {{source}} · traduzione verso {{target}}",
    turnPatient: "Parli tu",
    turnClinician: "Parla il team sanitario",
    speakerTogglePatient: "Parlo io",
    speakerToggleClinician: "Parla il team sanitario",
    disclaimerStrip:
      "Supporto alla comunicazione — verifica le informazioni importanti con il tuo team sanitario.",
  },

  transcript: {
    heading: "Testo parlato",
    placeholder: "Il testo riconosciuto apparirà qui dopo la registrazione.",
    edit: "Modifica testo",
    saveEdit: "Applica modifiche",
    confirm: "Conferma testo e traduci",
    editingHint: "Rivedi il testo prima che venga tradotto.",
    empty: "Nessuna registrazione per questo turno.",
    lowConfidenceInput:
      "Il riconoscimento vocale può essere impreciso. Rivedi e correggi il testo prima di tradurre.",
    draftSavedHint: "La bozza viene salvata su questo dispositivo mentre modifichi.",
  },

  translation: {
    heading: "Traduzione",
    placeholder: "La traduzione appare dopo la conferma del testo.",
    empty: "Nessuna traduzione per questo turno.",
    lowConfidence:
      "Da verificare: il testo parlato potrebbe non essere stato riconosciuto correttamente. Chiarisci le informazioni importanti con il tuo team sanitario.",
    uncertainLabel:
      "Alcune formulazioni erano poco chiare — la traduzione potrebbe non rifletterle tutte. Confermate insieme i dettagli importanti.",
    terminologyWarning:
      "Nomi di farmaci, cifre, unità o negazioni possono richiedere verifica. Controlla i termini importanti con il tuo professionista sanitario.",
    unclearSourceWarning:
      "La formulazione originale sembrava poco chiara. Non affidarti solo a questa traduzione per dettagli medici importanti.",
    languagePairLimited:
      "Questa combinazione di lingue non è completamente supportata nell’app. Verifica i termini importanti con il tuo professionista sanitario.",
    mixedDirectionSession:
      "In questa conversazione si usano lingue da destra a sinistra e da sinistra a destra. Verifica ogni blocco di testo con attenzione.",
    verifyTermsNotice:
      "La traduzione automatica può essere imprecisa. Verifica nomi di farmaci, posologie, allergie e altri termini importanti con il tuo professionista sanitario.",
    blocked:
      "Impossibile mostrare la traduzione in modo sicuro. Riformula in modo neutro o parla direttamente.",
    replay: "Mostra di nuovo la traduzione",
  },

  speak: {
    listenTranslation: "Ascolta la traduzione",
    listenSimplified: "Ascolta il testo semplificato",
    loading: "Preparazione audio…",
    stop: "Interrompi riproduzione",
    playbackPlaying: "Riproduzione audio in corso",
    playbackStopped: "Riproduzione interrotta",
    retry: "Riprova riproduzione",
  },

  streamingTts: {
    heading: "Lettura vocale (quasi in tempo reale)",
    experimentalBadge: "Facoltativo — l’audio non parte mai automaticamente.",
    privacyNote:
      "L’audio viene generato su richiesta e conservato solo in memoria su questo dispositivo finché non lasci la pagina.",
    enablePreviewPlayback: "Consenti riproduzione anteprima traduzione (solo avvio manuale)",
    playPreview: "Ascolta anteprima traduzione",
    stopPlayback: "Interrompi riproduzione",
    playPreviewAria: "Ascolta ad alta voce l’anteprima traduzione quasi in tempo reale",
    stopPlaybackAria: "Interrompi lettura vocale",
    statusLoading: "Preparazione voce…",
    statusPlaying: "Riproduzione audio della traduzione",
    statusIdle: "Riproduzione interrotta",
    previewDisabledHint:
      "Attiva la riproduzione anteprima sopra per ascoltare la traduzione non confermata.",
    errorGeneric: "Impossibile avviare la riproduzione. Puoi riprovare o continuare senza audio.",
    staleBlockPlayback:
      "Il testo anteprima è cambiato — attendi un’anteprima aggiornata o scartala prima di avviare la riproduzione.",
  },

  simplify: {
    action: "Semplifica il linguaggio",
    heading: "Formulazione semplificata",
    note:
      "Solo semplificazione del linguaggio — nessun consiglio medico. Verifica le informazioni importanti con il tuo professionista sanitario.",
    hide: "Nascondi testo semplificato",
    loading: "Semplificazione…",
  },

  pushToTalk: {
    record: "Tieni premuto per parlare",
    recordTap: "Tocca per parlare",
    stop: "Interrompi registrazione",
    recording: "Registrazione",
    micTest: "Prova microfono",
    micTestHint: "Prova breve — non verrà tradotto nulla.",
    micDenied: "Accesso al microfono non disponibile.",
    micDeniedGuidance:
      "Autorizza l’accesso al microfono per questo sito nelle impostazioni del browser e tocca «Riprova microfono». Puoi anche scrivere il testo nel campo sopra.",
    micRetry: "Riprova microfono",
    tooShort: "Registrazione troppo breve. Parla un po’ più a lungo e riprova.",
    likelySilent:
      "Non abbiamo rilevato voce chiara. Controlla il microfono e riprova.",
    preparing: "Preparazione microfono…",
    stopping: "Chiusura registrazione…",
    maxDurationHint: "Durata massima di registrazione raggiunta. Interrompi la registrazione.",
    keyboardHint: "Suggerimento: seleziona il pulsante parla e premi Spazio o Invio.",
    disabledDraft:
      "Termina la revisione del testo attuale prima di avviare una nuova registrazione.",
    disabledBusy: "Attendi il completamento del passaggio in corso.",
    disabledOffline: "La registrazione richiede connessione Internet.",
  },

  streaming: {
    heading: "Anteprima trascrizione in flusso (sperimentale)",
    experimentalBadge: "Beta facoltativa — tocca per parlare resta la modalità predefinita e più sicura.",
    privacyNote:
      "L’audio viene inviato in segmenti brevi solo per la trascrizione. Nulla viene archiviato sui nostri server come audio. La trascrizione resta provvisoria finché non la aggiungi come bozza e la confermi prima di tradurre.",
    pttDefaultNote:
      "Per l’uso abituale continua con tocca per parlare sopra. Avvia il flusso solo se vuoi provare questa anteprima.",
    captionsAria: "Sottotitoli provvisori in flusso",
    captionsEmpty: "Nessun testo provvisorio. Avvia il flusso per vedere i sottotitoli qui.",
    provisionalLabel: "Bozza provvisoria (non confermata)",
    startButton: "Avvia anteprima in flusso",
    stopButton: "Interrompi flusso",
    stopping: "Interruzione…",
    cancelButton: "Annulla",
    useAsDraftButton: "Usa come bozza (modifica prima di tradurre)",
    startAria: "Avvia anteprima sperimentale trascrizione in flusso",
    stopAria: "Interrompi anteprima trascrizione in flusso",
    statusIdle: "Flusso inattivo",
    statusConnecting: "Connessione…",
    statusConnected: "Flusso attivo — microfono attivato",
    statusProcessing: "Elaborazione segmento audio…",
    statusFinalizing: "Finalizzazione trascrizione…",
    previewReady: "Flusso terminato. Rivedi il testo e usalo come bozza se serve.",
    unsupportedBrowser:
      "L’anteprima in flusso non è supportata in questo browser. Usa tocca per parlare.",
    errorGeneric: "Il flusso non ha potuto continuare. Interrompilo e usa tocca per parlare.",
    backpressureError:
      "L’audio arriva troppo velocemente. Il flusso si è interrotto — usa tocca per parlare o riprova più lentamente.",
    disabledWhileStreaming: "Termina o interrompi il flusso prima di usare tocca per parlare.",
    maxDurationReached:
      "Durata massima del flusso raggiunta. L’anteprima è stata finalizzata — usala come bozza o continua con tocca per parlare.",
    fallbackToPtt:
      "Se le modalità anteprima non sono disponibili, usa tocca per parlare sopra — resta la modalità predefinita.",
  },

  nearRealtime: {
    heading: "Anteprima traduzione quasi in tempo reale",
    experimentalBadge:
      "Solo anteprima facoltativa — non viene salvata finché non confermi un turno bozza sotto.",
    privacyNote:
      "Viene inviato solo il frammento di trascrizione attuale per tradurre. Nessuna cronologia conversazione, nessun audio, nulla archiviato sul server come sessione.",
    notConfirmedLabel: "Anteprima traduzione (non confermata)",
    previewAria: "Anteprima provvisoria traduzione quasi in tempo reale",
    previewEmpty:
      "Quando la trascrizione in flusso si stabilizza, può apparire qui un’anteprima di traduzione.",
    statusIdle: "Anteprima quasi in tempo reale inattiva",
    statusWaiting: "In attesa di una trascrizione stabile…",
    statusTranslating: "Generazione anteprima traduzione…",
    statusReady: "Anteprima traduzione pronta — non salvata",
    confirmRequiredNote:
      "Usa «Usa come bozza» nel flusso sopra, modifica se necessario e conferma la traduzione nel pannello trascrizione. Tocca per parlare resta la modalità predefinita.",
    discardButton: "Scarta anteprima traduzione",
    staleWarning:
      "La trascrizione è cambiata. Questa anteprima potrebbe non corrispondere più — scartala o attendi un’anteprima aggiornata.",
    lowConfidenceWarning:
      "Questa anteprima può essere incerta. Rivedila con attenzione prima di confermare.",
    unclearSourceWarning:
      "La formulazione di origine era poco chiara. Modifica la trascrizione prima di confermare.",
    errorGeneric:
      "Anteprima traduzione non disponibile. Puoi continuare con tocca per parlare e traduzione manuale.",
  },

  history: {
    heading: "Documentazione conversazioni su questo dispositivo",
    privacyNote:
      "Fase 1: le conversazioni sono archiviate solo su questo dispositivo — non sui server MedScoutX. Non vengono conservate registrazioni audio né del microfono. È documentazione orientativa e di comunicazione, non una cartella clinica. Puoi eliminare conversazioni singolarmente o cancellare tutta la cronologia sotto in qualsiasi momento.",
    fallbackTitle: "Conversazione del {{date}}",
    statusDraft: "Bozza",
    statusActive: "Attiva",
    statusEnded: "Terminata",
    continue: "Continua",
    review: "Consulta",
    rename: "Rinomina",
    clearAll: "Cancella tutto su questo dispositivo",
    clearAllConfirm:
      "Eliminare tutte le conversazioni dell’interprete su questo dispositivo? Questa azione è irreversibile.",
    renamePrompt: "Titolo di questa conversazione",
    renameTitle: "Rinomina conversazione",
    renameSave: "Salva titolo",
    renamed: "Titolo aggiornato.",
    deleted: "Conversazione eliminata.",
    cleared: "Tutte le conversazioni sono state cancellate.",
    languagePair: "{{patient}} ↔ {{doctor}}",
    titleWithAppointment: "Conversazione del {{date}}",
    titleWithAppointmentPractice: "Conversazione del {{date}} · {{practice}}",
    titleWithAppointmentDoctor: "Conversazione del {{date}} · {{doctor}}",
    titleWithPractice: "Conversazione · {{practice}}",
    titleWithDoctor: "Conversazione · {{doctor}}",
    titleLanguagePair: "Traduzione {{patient}} ↔ {{doctor}}",
    titleUnsafe:
      "Questo titolo non può essere usato. Scegli un nome neutro senza conclusioni mediche né riferimenti a urgenza.",
    turnCount: "{{count}} turni documentati ({{translated}} tradotti)",
    searchLabel: "Cerca conversazioni su questo dispositivo",
    searchPlaceholder: "Titolo, studio, lingua…",
    searchHintLocal: "La ricerca avviene solo su questo dispositivo. Nulla viene inviato al server.",
    searchResults: "{{count}} di {{total}} conversazioni mostrate",
    noSearchResults: "Nessuna conversazione corrisponde alla ricerca.",
  },

  sections: {
    opening: "Inizio conversazione",
    patientStatements: "Enunciati del paziente",
    clinicianStatements: "Enunciati del team sanitario",
    closing: "Fine conversazione",
    middle: "Scambio successivo",
  },

  pdf: {
    documentTitle: "Interprete medico — documentazione conversazione",
    documentSubtitle:
      "Riepilogo di supporto alla comunicazione · rapporto conversazione tradotta",
    legalParagraph1:
      "Questo documento supporta unicamente la comunicazione. Non costituisce cartella clinica, referto diagnostico, valutazione clinica né riepilogo terapeutico.",
    legalParagraph2:
      "Non contiene diagnosi, triage, valutazione di urgenza né raccomandazioni terapeutiche.",
    legalParagraph3:
      "Trascrizione e traduzione automatiche possono essere imprecise o incomplete.",
    sessionTitleLabel: "Titolo della conversazione",
    generatedNote: "Generato localmente su questo dispositivo · MedScoutX Interprete medico",
    footerPage: "Pagina",
    filenamePrefix: "medscoutx-interpreter",
    exportLoading: "Generazione PDF…",
    exportSuccess: "PDF scaricato sul dispositivo.",
    exportFailed: "Impossibile creare il PDF. Riprova.",
    exportNoTurns: "Nessun turno documentato da esportare.",
    rtlFontNotice:
      "Nota: alcuni sistemi di scrittura potrebbero non essere mostrati completamente in questo PDF finché non sarà aggiunto supporto esteso ai font.",
    rtlLimitationDetail:
      "L’esportazione PDF usa font standard. Arabo, persiano, curdo (sorani) e altri sistemi RTL possono apparire semplificati o disallineati. Usa la revisione a schermo per la lettura più fedele.",
    mixedScriptNotice:
      "Questo documento contiene direzioni di scrittura miste. Verifica le formulazioni a schermo se qualcosa appare poco chiaro nel PDF.",
  },

  review: {
    pageTitle: "MedScoutX — Documentazione conversazione",
    heading: "Documentazione conversazione",
    notMedicalRecord:
      "Solo documentazione orientativa e di comunicazione — non è una cartella clinica.",
    metadataHeading: "Dettagli sessione",
    turnsHeading: "Turni documentati",
    timelineHeading: "Cronologia conversazione",
    documentationNotice:
      "La traduzione automatica può essere imprecisa. Verifica nomi di farmaci, posologie, allergie e altri termini importanti con il tuo professionista sanitario.",
    summaryLine: "{{turns}} turni documentati · {{translated}} tradotti",
    summaryDrafts: "{{count}} turno/i bozza non ancora tradotto/i",
    summaryTurnsLabel: "Turni documentati",
    created: "Avviata",
    ended: "Terminata",
    status: "Stato",
    turnNumber: "Turno {{n}}",
    langDirection: "{{source}} → {{target}}",
    originalLabel: "Testo parlato",
    translatedLabel: "Traduzione",
    simplifiedLabel: "Formulazione semplificata",
    turnDraft: "Bozza — non ancora tradotta",
    turnBlocked: "Traduzione non disponibile (sicurezza)",
    turnError: "Questo turno non è stato completato",
    backToList: "Tutte le conversazioni",
  },

  confirm: {
    deleteTitle: "Eliminare la conversazione?",
    deleteBody:
      "Questo elimina la conversazione solo su questo dispositivo. L’azione è irreversibile.",
    clearAllTitle: "Cancellare tutte le conversazioni?",
    clearAllBody:
      "Eliminare tutte le conversazioni dell’interprete su questo dispositivo? L’azione è irreversibile.",
    endTitle: "Terminare la conversazione?",
    endBody: "La conversazione sarà contrassegnata come terminata su questo dispositivo.",
    endWithDraftBody:
      "Hai testo parlato non ancora tradotto. Terminare comunque la conversazione?",
    leaveTitle: "Uscire dalla sala in diretta?",
    leaveBody:
      "Hai testo parlato non ancora confermato né tradotto. Se esci ora, puoi scartarlo o continuare a modificare.",
    discardDraft: "Scarta ed esci",
    keepEditing: "Continua a modificare",
    endAnyway: "Termina comunque",
    confirmDelete: "Elimina",
    confirmClearAll: "Cancella tutto",
    confirmEnd: "Termina conversazione",
    cancel: "Annulla",
  },

  sessionActions: {
    heading: "Conversazione",
    end: "Termina conversazione",
    endHint: "Conversazione contrassegnata come terminata.",
    ended: "Conversazione terminata.",
    leave: "Esci dalla sala",
    leaveConfirm:
      "Uscire dalla conversazione? Il contenuto non salvato può andare perso.",
    delete: "Elimina su questo dispositivo",
    deleteConfirm: "Eliminare davvero questa conversazione da questo dispositivo?",
    export: "Scarica PDF",
    exportHint: "Scarica la documentazione conversazione in PDF su questo dispositivo.",
    exportUnavailable: "Aggiungi almeno un turno documentato prima di esportare.",
  },

  empty: {
    moduleDisabled: "L’interprete medico non è disponibile al momento.",
    noSession: "Conversazione non trovata. Avviane una nuova.",
    noTurns:
      "Nessun contributo orale. Tieni premuto il pulsante per iniziare.",
    historyEmpty: "Nessuna conversazione salvata su questo dispositivo.",
    setupIncomplete:
      "Completa la configurazione prima di entrare nella sala in diretta.",
  },

  cloud: {
    heading: "Backup account facoltativo",
    lead:
      "Per impostazione predefinita le conversazioni restano solo su questo dispositivo. Facoltativamente puoi salvare una copia crittografata nel tuo account MedScoutX per aprirla su un altro dispositivo.",
    bulletLocalStill:
      "La modalità solo locale resta disponibile — non sei obbligato a usare il backup account.",
    bulletWhatStored:
      "Il contenuto archiviato può includere testo conversazioni, traduzioni, formulazioni semplificate e dettagli sessione (lingue, titolo, dati appuntamento).",
    bulletNoAudio:
      "Audio e registrazioni del microfono non vengono mai archiviati sul server.",
    bulletDeleteAnytime:
      "Puoi eliminare una copia salvata o tutti i dati di backup account in qualsiasi momento.",
    bulletNotMedicalRecord:
      "È documentazione conversazione a titolo orientativo — non cartella clinica, diagnosi né piano terapeutico.",
    acceptLabel:
      "Comprendo e desidero autorizzare la copia crittografata nel mio account quando scelgo di salvare una conversazione",
    acceptRequired: "Conferma di comprendere il backup account.",
    enableAccount: "Attiva backup account",
    accountEnabled: "Il backup account è attivo. Nulla viene caricato finché non scegli di salvare una conversazione.",
    revokeConsent: "Interrompi futuri backup account",
    revokeHint:
      "Interrompe nuovi caricamenti. Le copie esistenti nell’account restano finché non le elimini separatamente.",
    consentGranted: "Backup account attivato.",
    consentRevoked: "Futuri backup account interrotti.",
    unavailable:
      "Il backup account non è disponibile in questo ambiente. Le conversazioni restano solo su questo dispositivo.",
    loading: "Verifica disponibilità backup account…",
    setupHeading: "Backup account (facoltativo)",
    setupBody:
      "Puoi continuare a usare l’interprete con conversazioni archiviate solo su questo dispositivo.",
    setupHint:
      "Per attivare la copia crittografata account vai all’elenco conversazioni dopo la configurazione — nulla viene caricato automaticamente.",
    badgeLocal: "Solo su questo dispositivo",
    badgeSynced: "Salvata anche nell’account",
    badgeStale: "Copia su dispositivo più recente che nell’account",
    saveToAccount: "Salva nell’account",
    updateSavedCopy: "Aggiorna copia salvata",
    deleteCloudCopy: "Elimina solo la copia account",
    sessionLocalNote:
      "Eliminare su questo dispositivo ed eliminare la copia account sono azioni distinte.",
    sessionNeedsConsent: "Attiva il backup account nella sezione sopra per salvare copie.",
    enableAccountFirst: "Attiva il backup account prima di salvare nell’account.",
    saveNeedsTurns: "Aggiungi almeno un contributo orale prima di salvare nell’account.",
    saveSuccess: "Conversazione salvata nell’account.",
    updateSuccess: "Copia account aggiornata.",
    deleteCopySuccess: "Copia account eliminata. La copia su questo dispositivo non cambia.",
    deleteLocalOnlyBody:
      "Eliminare questa conversazione solo su questo dispositivo? La copia account, se esiste, non viene eliminata.",
    deleteCopyConfirmTitle: "Eliminare la copia account?",
    deleteCopyConfirmBody:
      "Rimuovere la copia crittografata dal tuo account? La copia su questo dispositivo resta.",
    deleteCopyConfirmAction: "Elimina copia account",
    deleteAllHeading: "Tutti i dati di backup account",
    deleteAllBody:
      "Rimuovi tutte le conversazioni dell’Interprete medico archiviate nel tuo account. Le copie su dispositivo non vengono eliminate.",
    deleteAllAction: "Elimina tutti i dati di backup account",
    deleteAllConfirmTitle: "Eliminare tutti i dati di backup account?",
    deleteAllConfirmBody:
      "Questo elimina in modo permanente tutte le conversazioni dell’interprete dal tuo account. Le copie su dispositivo non sono interessate.",
    deleteAllConfirmAction: "Elimina tutti i dati account",
    deleteAllSuccess: "Tutti i dati di backup account sono stati eliminati.",
    exportHeading: "Esporta backup account",
    exportBody:
      "Scarica un file JSON delle conversazioni archiviate nel tuo account. L’audio non è incluso. Le copie solo su dispositivo non sono incluse salvo che le abbia salvate nell’account.",
    exportAction: "Scarica esportazione JSON",
    exportSuccess: "Esportazione scaricata.",
    dataControlHeading: "I tuoi dati interprete",
    statusUnavailable: "Il backup account non è disponibile qui. Le conversazioni restano solo su questo dispositivo.",
    statusSignInRequired: "Accedi per gestire il backup account delle conversazioni dell’interprete.",
    statusLocalOnly: "Il backup account è disattivato. Le conversazioni su questo dispositivo non vengono caricate salvo attivazione del backup sotto.",
    statusAccountActive: "Il backup account è attivo. {{count}} conversazione/i hanno copia salvata nell’account.",
    statusConsentNoSessions: "Il backup account è attivo. Nulla nell’account finché non salvi una conversazione.",
    factLocal: "Su questo dispositivo",
    factLocalBody: "Resta nel browser finché non la elimini o cancelli i dati del sito.",
    factCloud: "Nel tuo account",
    factCloudBody: "Copia crittografata che salvi manualmente — facoltativa, mai automatica.",
    factAudio: "Audio",
    factAudioBody: "Mai archiviato sul server.",
    consentHistoryHeading: "Cronologia consensi",
    historyGranted: "Backup attivato",
    historyRevoked: "Backup interrotto",
    scopeNoUser: "Accedi per usare il backup account.",
    scopeMismatch: "La sessione è cambiata. Aggiorna la pagina prima di salvare o eliminare dati account.",
    revokeDialogTitle: "Interrompere il backup account?",
    revokeDialogIntro:
      "I futuri salvataggi nell’account verranno interrotti. Scegli cosa fare con le copie già archiviate nell’account.",
    revokeKeepTitle: "Conserva le copie salvate nel mio account",
    revokeKeepBody:
      "Interrompe solo nuovi caricamenti. Potrai eliminare le copie account più tardi in questa sezione.",
    revokeDeleteTitle: "Interrompi backup ed elimina tutte le copie account",
    revokeDeleteBody:
      "Rimuove {{count}} conversazione/i salvata/e dal tuo account. Le copie su dispositivo non vengono eliminate.",
    revokeDeleteConfirmTitle: "Eliminare tutte le copie account?",
    revokeDeleteConfirmBody:
      "Questo elimina in modo permanente {{count}} conversazione/i dal tuo account e interrompe futuri backup.",
    revokeDeleteConfirmAction: "Elimina copie account e interrompi backup",
    revokeBackToChoices: "Torna alle opzioni",
    consentRevokedKeepData: "Backup account interrotto. Le copie account esistenti sono state conservate.",
    consentRevokedAndDeleted:
      "Backup account interrotto e tutte le copie account eliminate.",
    errors: {
      generic: "Impossibile eseguire il backup account. Riprova più tardi.",
      network: "Problema di connessione. Riprova.",
      unauthorized: "Accedi per continuare.",
      rateLimited: "Troppe richieste. Attendi un momento.",
      cloudDisabled: "Il backup account non è disponibile al momento.",
      encryptionUnavailable: "Il backup account non è configurato sul server.",
      consentRequired: "È richiesto il consenso per il backup account.",
      quotaExceeded: "Limite backup account raggiunto.",
      sessionNotFound: "Copia salvata non trovata nell’account.",
      validationRejected: "Questa conversazione non può essere salvata nella forma attuale.",
    },
  },

  reliability: {
    offlineBanner:
      "Sembra che tu sia offline. Ingresso vocale e traduzione sono sospesi finché la connessione non torna.",
    reconnectedBanner: "Connessione ripristinata. Puoi continuare quando sei pronto.",
    recoveryBody:
      "L’ultimo passaggio non è stato completato. Il tuo testo è ancora lì — puoi riprovare.",
    retryAction: "Riprova",
    dismissRecovery: "Ignora",
    errorBoundaryBody:
      "Si è verificato un problema nella vista interprete. Le altre aree dell’app non sono interessate.",
    errorBoundaryBack: "Torna all’inizio interprete",
  },

  errors: {
    moduleDisabled: "Questo modulo non è disponibile al momento.",
    sessionNotFound: "Conversazione non trovata. Ricomincia.",
    transcribeFailed: "Riconoscimento vocale non riuscito. Riprova.",
    translateFailed: "Traduzione non riuscita. Riprova.",
    simplifyFailed: "Semplificazione non riuscita. Riprova.",
    speakFailed: "Riproduzione non riuscita. Riprova.",
    ttsDisabled: "La lettura vocale non è disponibile al momento.",
    rateLimited: "Troppe richieste. Attendi un momento.",
    network: "Problema di connessione. Riprova.",
    offline: "Sembra che tu sia offline. Controlla la connessione e riprova.",
    transcribeTimeout:
      "Il riconoscimento vocale ha impiegato troppo tempo. Fai una registrazione più breve.",
    requestTimeout: "Questo passaggio ha impiegato troppo tempo. Riprova.",
    speakUnsupported: "La riproduzione audio non è supportata in questo browser.",
    textTooLong: "Il testo è troppo lungo. Accorcialo.",
    unauthorized: "Accedi per continuare.",
    generic: "Si è verificato un problema. Riprova più tardi.",
  },

  invite: {
    pageTitle: "MedScoutX — Invito dallo studio",
    heading: "Interprete medico nella tua visita",
    loading: "Verifica link invito…",
    statusAriaPrefix: "Stato invito:",
    statusActive: "Il link invito è valido",
    statusExpired: "Il link invito è scaduto",
    statusRevoked: "Il link invito non è più disponibile",
    statusInvalid: "Il link invito non è valido",
    statusUnavailable: "La verifica dell’invito non è disponibile",
    networkError: "Impossibile verificare l’invito. Controlla la connessione e riprova.",
    moduleDisabled: "L’interprete medico non è disponibile al momento.",
    practiceLabel: "Studio",
    communicationNotice:
      "Solo supporto alla comunicazione — senza diagnosi, triage né consigli terapeutici.",
    noticeNoDiagnosis: "Senza diagnosi medica",
    noticeNoTriage: "Senza valutazione di urgenza né triage",
    noticeNoTreatment: "Senza raccomandazioni terapeutiche né farmaci",
    consentHeading: "La tua conversazione resta privata",
    consentNoAutoShare:
      "Aprire questo link dello studio non condivide la conversazione con lo studio.",
    consentExplicitStep:
      "Dopo la conversazione potrai scegliere separatamente di condividere la documentazione con lo studio.",
    consentPatientControl: "Controlli cosa condividere e puoi revocare l’accesso in seguito.",
    languagesHeading: "Scegli le lingue qui sotto",
    languagesIntro:
      "Nella schermata successiva sceglierai la tua lingua e quella del team sanitario prima di iniziare.",
    continueLoggedIn: "Scegli lingue e continua",
    authRequired: "Accedi per usare l’Interprete medico con questo link dello studio.",
    guestUnsupported:
      "L’uso come ospite senza account non è ancora supportato per l’interprete (è richiesta verifica repository). Accedi o crea un account.",
    loginToContinue: "Accedi per continuare",
    createAccount: "Crea account",
    setupBannerTitle: "Link dallo studio",
    setupBannerBody:
      "Hai iniziato da un invito per {practice}. Nulla viene condiviso con lo studio finché non acconsenti esplicitamente in un passaggio successivo.",
    setupPracticePrefill: "Nome studio dall’invito (modificabile)",
  },

  practiceShare: {
    heading: "Condividi con lo studio (facoltativo)",
    communicationNotice:
      "Solo supporto alla comunicazione — non è cartella clinica né valutazione clinica.",
    intro:
      "Puoi condividere una copia di questa documentazione conversazione con {practice}. L’audio non viene mai condiviso.",
    noticeNoAudio: "Le registrazioni audio non vengono condivise con lo studio.",
    noticeDocumentation:
      "Può essere condivisa solo la documentazione scritta della conversazione (testo originale e tradotto).",
    noticeRevoke: "Puoi revocare l’accesso dello studio in seguito.",
    noticeNotMedicalRecord: "Non è una cartella clinica.",
    consentLabel:
      "Acconsento a condividere questa documentazione conversazione con lo studio indicato sopra.",
    grantButton: "Condividi documentazione con lo studio",
    granting: "Condivisione…",
    grantSuccess: "Accesso studio concesso. Puoi revocarlo nelle impostazioni interprete.",
    grantError: "Impossibile condividere con lo studio. Riprova più tardi.",
    tokenMissing:
      "Riapri il link invito dello studio per attivare la condivisione da questo dispositivo.",
  },

  aria: {
    hubCard: "Interprete medico nell’area paziente",
    startInterpreter: "Avvia Interprete medico",
    wizardProgress: "Progresso configurazione",
    languagePatient: "Seleziona la tua lingua",
    languageDoctor: "Seleziona lingua del team sanitario",
    profileConsent: "Usa dati profilo per questa conversazione",
    privacyAccept: "Informazioni lette e comprese",
    privacyStorage: "Salva conversazione su questo dispositivo",
    liveRegion: "Traduzione e stato attuali",
    transcriptEditor: "Modifica testo parlato",
    translationRegion: "Zona traduzione",
    speakerRole: "Chi parla attualmente",
    startRecording: "Avvia ingresso vocale",
    stopRecording: "Interrompi ingresso vocale",
    preparingMic: "Preparazione microfono",
    stoppingRecording: "Chiusura registrazione",
    replayTranslation: "Ascolta traduzione",
    replaySimplified: "Ascolta testo semplificato",
    confirmTranscript: "Conferma testo e traduci",
    simplifyLanguage: "Semplifica linguaggio della traduzione",
    simplifiedRegion: "Formulazione semplificata",
    hideSimplified: "Nascondi formulazione semplificata",
    deleteSession: "Elimina conversazione su questo dispositivo",
    exportConversation: "Esporta conversazione",
    endSession: "Termina conversazione",
    leaveRoom: "Esci dalla sala in diretta",
    turnList: "Cronologia turni conversazione",
    historyList: "Conversazioni salvate su questo dispositivo",
    reviewMetadata: "Dettagli conversazione",
    renameSession: "Rinomina conversazione",
    clearAllHistory: "Cancella tutta la cronologia interprete",
    deleteAllCloudData: "Elimina tutti i dati di backup account",
    exportCloudData: "Scarica esportazione JSON conversazioni backup account",
    searchHistory: "Cerca conversazioni salvate",
    languageSearch: "Filtra lingue conversazione",
  },
};
