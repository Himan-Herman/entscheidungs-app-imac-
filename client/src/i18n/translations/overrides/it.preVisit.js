export default {
  language: {
    pageTitle: "MedScoutX — Preparazione alla visita",
    eyebrow: "Pre-visita",
    title: "Preparazione alla visita medica",
    explanation:
      "Questo strumento ti aiuta a strutturare dubbi e domande per una visita medica. Non fornisce diagnosi né raccomandazioni mediche.",
    trust: "Tutte le informazioni si basano solo su ciò che indichi tu.",
    valueProp:
      "Prepara sintomi, farmaci, documenti e domande in modo strutturato — nella tua lingua.",
    languageLabel: "Lingua che vuoi usare con MedScoutX",
    languageHint:
      "Puoi inserire le informazioni nella lingua in cui ti senti più a tuo agio.",
    doctorLanguageLabel: "Lingua della versione medico",
    doctorLanguageHint:
      "Scegli qui in quale lingua dovrà essere preparata la versione destinata al medico.",
    continue: "Continua",
  },
  qrLanding: {
    pageTitle: "MedScoutX — Contesto studio via QR",
    title: "Conferma il contesto dello studio",
    loading: "Caricamento del contesto QR…",
    invalid: "Questo link QR non è valido o non è disponibile.",
    inactive: "Questa destinazione QR non è attiva al momento.",
    cta: "Prepara la visita per questo studio",
  },
  chrome: {
    backHome: "Torna alla home MedScoutX",
    backPatientHub: "Torna all’area paziente",
    moduleLabel: "Prepara la visita medica",
    libraryModuleLabel: "Le mie preparazioni",
    safety:
      "Questo modulo serve solo a preparare e documentare le tue informazioni. Non sostituisce il parere medico.",
    librarySafety:
      "Gestisci qui le preparazioni salvate. Nulla viene sincronizzato automaticamente — nella libreria compaiono solo gli elementi che hai salvato esplicitamente.",
    navAria: "Navigazione pre-visita",
  },
  chat: {
    pageTitle: "MedScoutX — Raccolta pre-visita",
    progressTemplate: "Passaggio {{current}} di {{total}}",
    answerPlaceholder: "La tua risposta…",
    next: "Continua",
    back: "Indietro",
    changeLanguage: "Cambia lingua di inserimento",
    sectionLabelQuestion: "Domanda",
    sectionLabelAnswer: "La tua risposta",
    devInsertDemo: "Inserisci dati dimostrativi",
    devOnlyNote: "Visibile solo in sviluppo locale.",
    adaptiveSeedHint:
      "Descrivi questo punto con parole tue, nel modo più concreto e neutro possibile.",
    adaptiveFollowupLabel: "Domanda aggiuntiva per la preparazione",
    adaptiveSeedRequired:
      "Descrivi brevemente la situazione con parole tue.",
    adaptiveAnswerRequired:
      "Rispondi brevemente alla domanda aggiuntiva.",
    adaptiveBusy: "Un momento…",
    adaptiveProgressMeta:
      "Domande aggiuntive per questa voce: {{n}} di massimo {{max}}",
    adaptiveSkip: "Salta",
    adaptiveServiceError:
      "La domanda aggiuntiva adattiva non può essere creata ora. Puoi continuare o modificare più tardi.",
    audioHint: "Puoi ascoltare la domanda o dettare la risposta.",
    audioPrivacy:
      "Per la lettura ad alta voce e l’inserimento vocale, testo o audio vengono inviati al servizio AI per l’elaborazione. Questa funzione non memorizza nulla in modo permanente.",
    audioMicUnsupported:
      "La registrazione audio non è supportata da questo browser.",
    audioListenAria: "Leggi ad alta voce la domanda",
    audioListenTitle:
      "Leggi ad alta voce la domanda e una breve guida",
    audioDictateAria: "Detta la risposta",
    audioDictateTitle:
      "Tocca per iniziare la registrazione; tocca di nuovo per fermarla",
    audioStatusLoading: "Preparazione audio…",
    audioStatusPlaying: "Riproduzione…",
    audioStatusRecording:
      "Registrazione… tocca di nuovo quando hai finito.",
    audioStatusTranscribing: "Trasformo la tua voce in testo…",
    audioErrorGeneric:
      "La funzione audio non è disponibile al momento. Riprova più tardi.",
    audioErrorPlayback:
      "Non è stato possibile avviare la riproduzione.",
    audioMicPermission:
      "L’accesso al microfono è stato negato o non è disponibile.",
    longitudinalCaseBanner:
      "Facoltativo: è collegata una cronologia nel tempo. La raccolta usa solo le tue dichiarazioni precedenti, senza interpretazione medica.",
  },
  review: {
    pageTitle: "MedScoutX — Riepilogo pre-visita",
    title: "Riepilogo delle tue risposte",
    intro:
      "Così verranno usate le tue risposte per preparare la visita. Puoi ancora modificare.",
    empty: "non indicato",
    edit: "Modifica",
    clearField: "Rimuovi voce",
    trustBeforeActions:
      "Puoi rivedere, modificare o eliminare le informazioni in qualsiasi momento prima di creare il documento.",
    newSession: "Nuova sessione",
    wipeSession: "Elimina completamente la sessione",
    prepareDocument: "Prepara documento",
    resumeFromArchive:
      "Stai riprendendo una preparazione salvata. Controlla le tue voci e continua quando tutto è corretto.",
  },
  document: {
    pageTitle: "MedScoutX — Anteprima documento",
    title: "Prepara documento per il medico",
    explanation:
      "Il PDF per il medico viene creato in tedesco. Le tue dichiarazioni originali restano comunque incluse nella tua lingua.",
    pageLeadFlexible:
      "Controlla le tue informazioni e scegli in quale lingua deve essere creata la versione strutturata per il medico. Le tue dichiarazioni originali come paziente restano inoltre allegate separatamente.",
    doctorLangLabel: "Lingua della versione medico",
    doctorLangHint:
      "La versione strutturata per il medico e il PDF inviato allo studio vengono creati in tedesco.",
    doctorLangSelectableHint:
      "Qui puoi definire in quale lingua deve essere creata la versione destinata al medico.",
    practiceContextTitle: "Contesto dello studio selezionato",
    practiceContextPractice: "Studio",
    practiceContextTarget: "Destinazione",
    practiceContextDoctor: "Medico",
    practiceContextSpecialty: "Specializzazione",
    patientMetaSection: "Dettagli facoltativi del paziente",
    patientMetaNote:
      "Queste informazioni sono facoltative e aiutano lo studio a identificare il documento.",
    patientIdentityPdfConsent:
      "Includi questi dati del paziente nel PDF per lo studio/medico.",
    patientIdentityPdfConsentHint:
      "I dati identificativi compaiono nel PDF solo se attivi questa opzione. Puoi comunque lasciare i campi compilati localmente per usarli più tardi.",
    patientNameLabel: "Nome",
    patientEmailLabel: "E-mail",
    patientDateOfBirthLabel: "Data di nascita",
    patientGenderOrSalutationLabel: "Genere / appellativo",
    patientPhoneLabel: "Telefono (facoltativo)",
    timelineSection: "Decorso / collegamento al caso",
    timelineHint:
      "Facoltativo: collega questa preparazione a un caso simile precedente per confrontare i cambiamenti basandoti solo sulle tue dichiarazioni.",
    timelineTopicLabel: "Argomento / etichetta del caso (facoltativo)",
    timelineTopicPlaceholder:
      "ad es. sintomi ricorrenti dalla primavera",
    timelineSelectLabel: "Seleziona una preparazione precedente",
    timelineSelectNone: "Nessuna preparazione precedente selezionata",
    timelineUntitled: "Senza titolo",
    timelineCompare: "Confronta il decorso",
    timelineComparing: "Confronto in corso…",
    timelineResultTitle:
      "Decorso fattuale (senza interpretazione medica)",
    timelineNewlyMentioned: "Nuovo rispetto a prima",
    timelineStillMentioned: "Ancora menzionato",
    timelineNoLongerMentioned: "Non più menzionato",
    timelineUnclear: "Non chiaro",
    timelinePatientAddedNewInformation:
      "Nuove informazioni aggiunte dal paziente",
    timelinePatientDidNotMentionPrior:
      "Informazioni riferite in precedenza ma non menzionate in questa sessione",
    timelineIncludePdf:
      "Voglio includere questo riepilogo del decorso nel PDF per il medico.",
    timelineLoadError:
      "Non è stato possibile caricare le preparazioni precedenti.",
    timelineSummaryError:
      "Il riepilogo del decorso non può essere creato ora.",
    timelineSelectCaseFirst:
      "Seleziona prima una preparazione precedente.",
    sectionStructured: "Versione strutturata per il medico",
    sectionOriginal: "Dichiarazioni originali del paziente",
    disclaimer:
      "La versione medico si basa solo sulle dichiarazioni del paziente. Non vengono create diagnosi, raccomandazioni né valutazioni di urgenza.",
    empty: "non indicato",
    backReview: "Torna al riepilogo",
    pdfDisabled: "Crea PDF",
    pdfLocalNote:
      "Il PDF viene creato localmente nel browser. Nessun dato viene trasmesso.",
    qrShareButton: "Codice QR (condividi senza e-mail)",
    qrShareTitle: "Condividi senza e-mail",
    qrShareIntro:
      "Questo codice QR contiene solo una breve nota e un link a MedScoutX. Non include le tue voci né dettagli medici. Una persona nelle vicinanze può scansionarlo dallo schermo.",
    qrSharePayloadNote:
      "Preparato con MedScoutX — il file PDF è stato salvato su questo dispositivo.",
    qrShareClose: "Chiudi",
    qrShareGenerateError:
      "Non è stato possibile creare il codice QR. Riprova.",
    consentCheckbox:
      "Voglio salvare questa sessione localmente in questo browser per consultarla dopo.",
    consentExpl:
      "La sessione resta solo localmente in questo browser. Nessun invio a MedScoutX.",
    saveLocal: "Salva sessione in locale",
    saveSuccess: "Sessione salvata in locale.",
    archiveNote:
      "Potrai eliminare le sessioni salvate in seguito. Questa funzione non sostituisce la cartella clinica.",
    historyLink: "Vedi sessioni salvate",
    consentSectionTitle: "Copia locale facoltativa",
    createDoctorVersion: "Crea versione medico",
    creatingDoctorVersion: "Creazione versione medico…",
    aiError:
      "La versione medico non può essere creata ora. Puoi comunque usare l’anteprima PDF locale.",
    aiSuccessStatus:
      "La versione medico è stata creata in base alle tue dichiarazioni.",
    accountSectionTitle: "Salva nel mio account",
    accountConsentCheckbox:
      "Voglio salvare questa preparazione nel mio account MedScoutX.",
    accountConsentExpl:
      "Questo salvataggio è facoltativo. Potrai vedere o eliminare le preparazioni salvate in seguito.",
    saveToAccount: "Salva nell’account",
    accountLoginHint:
      "Accedi per salvare le preparazioni nel tuo account.",
    accountLoginLink: "Accedi",
    accountSaveSuccess:
      "La preparazione è stata salvata nel tuo account.",
    accountSaveError:
      "La preparazione non può essere salvata ora.",
    sessionTitleDe: "Vorbereitung Arztgespräch",
    sessionTitleEn: "Preparazione alla visita medica",
    sessionTitleIt: "Preparazione alla visita medica",
    viewMyPreparations: "Le mie preparazioni",
    mainNavAria:
      "Versione medico, export PDF, torna al riepilogo",
    doctorRecipientSection: "Destinatario (contatti medici)",
    doctorRecipientFieldLabel: "Seleziona contatto",
    doctorRecipientHint:
      "Facoltativo: scegli un contatto dalla tua lista dei contatti medici per una condivisione pianificata.",
    doctorRecipientNone: "Nessun medico selezionato",
    doctorRecipientManage: "Gestisci contatti medici",
    longitudinalPdfSection: "Caso / decorso nel PDF (facoltativo)",
    longitudinalPdfNote:
      "Solo se lo attivi esplicitamente. Nessuna diagnosi o valutazione medica. Puoi eliminare in qualsiasi momento decorsi e voci.",
    longitudinalPdfCaseTitle: "Includi titolo del caso",
    longitudinalPdfContinuity:
      "Riepilogo della continuità del caso (solo dichiarazioni del paziente)",
    longitudinalPdfSessionsOverview:
      "Panoramica delle preparazioni precedenti (data e motivo)",
    longitudinalPdfRelatedReports:
      "Referti precedenti collegati (dal confronto di sessione, se disponibili)",
    longitudinalLoadOverview:
      "Carica panoramica dal caso collegato",
    longitudinalLoadOverviewBusy: "Caricamento…",
    longitudinalLoadOverviewError:
      "Non è stato possibile caricare la panoramica.",
    longitudinalPdfCompareHint:
      "Per includere il confronto fattuale nel PDF, genera prima il confronto sopra nella sezione Decorso.",
    linkMyCases: "Le mie cronologie",
    doctorRecipientLoading: "Caricamento contatti…",
    doctorRecipientEmailMissing:
      "Per questo contatto non è registrato alcun indirizzo e-mail.",
    vitalsAttach: {
      heading: "Allega le mie misurazioni",
      intro:
        "Hai registrato misurazioni in MedScoutX. Puoi allegare automaticamente il valore più recente di ciascuna a questo documento.",
      consent:
        "Acconsento che le mie misurazioni attuali siano allegate a questo documento e trasmesse con esso allo studio medico.",
      previewTitle: "Questi valori verranno allegati",
      minimisationNote:
        "Viene trasmesso solo il valore più recente per tipo di misurazione degli ultimi 90 giorni — senza le tue note. Puoi annullare la selezione in qualsiasi momento.",
      importedLabel: "dal dispositivo",
      attachError: "Non è stato possibile allegare le misurazioni.",
      attachedHint: "Le tue misurazioni saranno allegate a questo PDF.",
    },
    emailPdfSection: "Invia PDF via e-mail",
    emailPdfPrivacy:
      "Se invii il PDF, MedScoutX trasmetterà il file all’indirizzo e-mail salvato per quel contatto nei tuoi contatti medici. Nulla viene inviato automaticamente: l’invio parte solo da te. Il contenuto riflette solo le tue dichiarazioni e non costituisce diagnosi né raccomandazione terapeutica.",
    emailPdfConsent:
      "Confermo che questo documento può contenere dati sanitari personali e può essere inviato allo studio/medico selezionato.",
    emailPdfSend: "Invia PDF adesso",
    emailPdfSending: "Invio in corso…",
    emailPdfSuccess:
      "Il PDF è stato inviato per la consegna. Se necessario, puoi controllare il tuo client di posta per una conferma.",
    emailPdfError:
      "L’invio non è possibile al momento. Riprova più tardi oppure usa “Crea PDF”.",
    emailPdfRequiresDoctor:
      "Scegli un contatto con un indirizzo e-mail valido oppure lascia “Nessun medico selezionato”.",
    emailPdfRequiresConsent:
      "Conferma prima l’avviso e il consenso per l’invio.",
    emailPdfNoPdf:
      "Non è stato possibile generare il PDF. Riprova.",
    structuredRowLabels: {
      appointmentReason: "Motivo attuale della visita",
      symptomsOwnWords: "Sintomi con parole del paziente",
      onsetAndCourse: "Inizio e decorso nel tempo",
      medications: "Terapia attuale",
      preExistingConditions: "Patologie pregresse note",
      relevantDocuments: "Documenti rilevanti",
      patientQuestions: "Domande per il medico",
    },
    assistantQuestions: {
      sectionTitle: "Domande di orientamento per la visita",
      intro:
        "In base alle tue indicazioni su sintomi, decorso e preparazione, l’IA propone alcune domande strutturanti. Servono solo alla tua preparazione e non contengono valutazioni cliniche.",
      noAiAnswersNote:
        "Vengono suggerite solo domande. Le tue risposte restano nella tua preparazione personale e non vengono inviate al medico come blocco di domande separato.",
      generateButton: "Crea domande di orientamento",
      generating: "Preparazione domande…",
      successStatus:
        "Le domande di orientamento sono state create dalle tue indicazioni.",
      error:
        "Le domande di orientamento non possono essere create ora. Puoi continuare o riprovare più tardi.",
      staleHint:
        "Le tue indicazioni sono cambiate. Rigenera le domande per allinearle allo stato attuale.",
      emptyState:
        "Nessuna domanda di orientamento ancora. Creale facoltativamente per preparare il colloquio.",
      questionCounter: "Domanda {{current}} di {{total}}",
      doctorVersionLabel: "Formulazione per il medico",
      answerLabel: "La tua risposta",
      answerPlaceholder:
        "La tua risposta con parole tue — solo da te, non dall’IA…",
      previewSectionTitle:
        "Domande di orientamento per la tua preparazione",
      pdfSectionHeading:
        "Domande di orientamento (risposte del paziente)",
      pdfPatientQuestionLabel: "Domanda (paziente)",
      pdfDoctorQuestionLabel: "Domanda (medico)",
      pdfPatientAnswerLabel: "Risposta del paziente",
    },
  },
  localHistory: {
    pageTitle: "Sessioni salvate — Pre-visita — MedScoutX",
    title: "Sessioni salvate in locale",
    expl:
      "Queste sessioni sono solo in questo browser. Non sono state inviate a MedScoutX.",
    privacyNote:
      "Le sessioni locali restano solo su questo dispositivo e browser.",
    empty: "Nessuna sessione salvata in locale.",
    patientLang: "Lingua del paziente",
    doctorLang: "Lingua del medico",
    savedAt: "Salvato",
    view: "Apri",
    delete: "Elimina",
    clearAll: "Elimina tutte le sessioni locali",
    clearConfirm:
      "Eliminare definitivamente tutte le sessioni locali? Operazione irreversibile.",
    listAriaLabel: "Sessioni salvate",
  },
  accountHistory: {
    pageTitle: "MedScoutX — Le mie preparazioni",
    workspaceBadge: "Libreria",
    title: "Le mie preparazioni",
    subtitle:
      "Qui vedi le preparazioni che hai salvato esplicitamente nel tuo account MedScoutX.",
    loginHint: "Accedi per vedere le preparazioni salvate.",
    loginCta: "Accedi",
    loading: "Caricamento…",
    loadError:
      "Impossibile caricare l’elenco ora. Riprova più tardi.",
    empty: "Non hai ancora salvato preparazioni nell’account.",
    emptyHint:
      "Gli elementi compaiono qui solo dopo che li hai salvati nel tuo account alla fine del flusso.",
    patientLang: "Lingua del paziente",
    doctorLang: "Lingua del medico",
    created: "Creato",
    savedAt: "Salvato",
    statusLabel: "Stato",
    open: "Apri",
    resume: "Riprendi",
    downloadPdf: "Scarica PDF",
    deleteOne: "Elimina",
    deleteAll: "Elimina tutte le preparazioni",
    confirmDeleteOne:
      "Eliminare questa preparazione? Operazione irreversibile.",
    confirmDeleteAll:
      "Eliminare tutte le preparazioni salvate nell’account? Operazione irreversibile.",
    confirmDeleteDevice:
      "Rimuovere questa copia locale da questo dispositivo?",
    privacyNote:
      "Le preparazioni salvate possono essere eliminate in qualsiasi momento. Questa funzione non sostituisce la cartella clinica.",
    defaultTitle: "Preparazione visita medica",
    deleteError: "Impossibile eliminare la preparazione ora.",
    deleteAllError:
      "Impossibile eliminare le preparazioni ora.",
    statusDraft: "Bozza",
    statusPdfCreated: "PDF creato",
    statusCompleted: "Completato",
    statusLocalSaved: "Salvata in locale",
    linkCases: "Apri le mie cronologie",
    startNewPrep: "Avvia nuova preparazione",
    retryLoad: "Riprova",
    listAriaLabel: "Preparazioni salvate",
    searchLabel: "Cerca",
    searchPlaceholder: "Cerca titolo o anteprima…",
    filterLabel: "Stato",
    filterAll: "Tutte",
    sectionAccount: "Salvate nell’account",
    sectionAccountHint:
      "Queste preparazioni sono collegate al tuo account MedScoutX e visibili su qualsiasi dispositivo in cui hai effettuato l’accesso.",
    sectionDevice: "Solo su questo dispositivo",
    sectionDeviceHint:
      "Le copie locali restano solo in questo browser. Non vengono aggiunte automaticamente al tuo account.",
    storageAccount: "Account MedScoutX",
    storageDevice: "Solo su questo dispositivo",
    linkDocuments: "Documenti e PDF",
    linkDocumentsHint:
      "Link protetti e metadati PDF nella tua area documenti",
    linkedCase: "Cronologia collegata",
    noAccountResults: "Nessun risultato nel tuo account.",
    clearDeviceAll: "Elimina tutte le copie locali",
    confirmClearDevice:
      "Eliminare definitivamente tutte le copie salvate localmente su questo dispositivo?",
  },
  cases: {
    backPracticeHub: "Torna ai miei studi",
    title: "Le mie cronologie",
    pageTitle: "MedScoutX — Le mie cronologie",
    intro:
      "Raggruppa più preparazioni attorno a un tema nel tempo. Sei tu a controllare contenuti ed eliminazione.",
    safetyNote:
      "Nessuna diagnosi, nessuna urgenza, nessun consiglio terapeutico. Vengono confrontate e organizzate solo le tue voci.",
    searchPlaceholder: "Cerca…",
    showArchived: "Mostra archiviate",
    createCase: "Crea cronologia",
    fieldTitle: "Titolo",
    fieldCategory: "Categoria (facoltativo)",
    fieldDescription: "Descrizione (facoltativa)",
    save: "Salva",
    cancel: "Annulla",
    loading: "Caricamento…",
    loadError: "Impossibile caricare le cronologie.",
    saveError: "Impossibile salvare la cronologia.",
    empty: "Ancora nessuna cronologia.",
    sessionCount: "Preparazioni",
    loginHint: "Accedi per gestire le cronologie.",
    loginCta: "Accedi",
    linkPreparations: "Le mie preparazioni",
    backHome: "Torna alla home",
  },
  caseDetail: {
    pageTitle: "MedScoutX — Cronologia",
    backPracticeHub: "Torna ai miei studi",
    backToList: "Tutte le cronologie",
    notFound:
      "Questa cronologia non è stata trovata o non è più disponibile.",
    unnamedSession: "Preparazione senza titolo",
    loading: "Caricamento…",
    loadError: "Impossibile caricare la cronologia.",
    saveError: "Impossibile salvare le modifiche.",
    deleteError: "Impossibile eliminare la cronologia.",
    loginHint: "Accedi.",
    loginCta: "Accedi",
    safetyNote:
      "Hai sempre il controllo: i decorsi sono facoltativi e possono essere eliminati in qualsiasi momento. Nessuna valutazione medica.",
    archived: "Archiviata",
    fieldTitle: "Titolo",
    fieldCategory: "Categoria",
    fieldDescription: "Descrizione",
    saveMeta: "Salva dettagli",
    archive: "Archivia cronologia",
    unarchive: "Ripristina cronologia",
    deleteCase: "Elimina intera cronologia",
    confirmDeleteCase:
      "Eliminare questa cronologia? Le preparazioni collegate restano nel tuo account ma vengono scollegate dalla cronologia.",
    followUp: "Crea preparazione di follow-up",
    followUpError: "Impossibile avviare il follow-up.",
    attachSession: "Collega preparazione",
    selectSession: "Scegli preparazione…",
    attachConfirm: "Collega",
    attachError: "Collegamento non riuscito.",
    unlinkError: "Impossibile rimuovere il collegamento.",
    timeline: "Decorso",
    emptyTimeline:
      "Ancora nessuna preparazione in questa cronologia.",
    reopen: "Apri / continua a modificare",
    clearPdf: "Azzera stato PDF",
    pdfClearError: "Impossibile aggiornare lo stato PDF.",
    unlink: "Rimuovi dalla cronologia",
    deleteSession: "Elimina preparazione",
    confirmDeleteSession:
      "Eliminare definitivamente questa preparazione salvata dal tuo account?",
    deleteSessionError: "Eliminazione non riuscita.",
    pdfReady: "PDF contrassegnato",
    reopenError: "Impossibile aprire.",
    compareTitle: "Confronta due preparazioni",
    compareHint:
      "Solo differenze fattuali nella formulazione — nessun giudizio medico.",
    sessionA: "Prima preparazione",
    sessionB: "Seconda preparazione",
    compareRun: "Genera confronto",
    comparing: "Confronto in corso…",
    compareError: "Confronto non riuscito.",
    pickTwoSessions:
      "Seleziona due preparazioni diverse.",
    diffNew: "Nuovo rispetto a prima",
    diffStill: "Ancora menzionato",
    diffGone: "Non più menzionato",
    diffUnclear: "Non chiaro",
    diffAddedInfo:
      "Il paziente ha aggiunto nuove informazioni",
    diffOmittedPrior:
      "Informazioni riferite in precedenza ma non menzionate in questa sessione",
    continuityTitle: "Riepilogo di continuità",
    continuityHint:
      "Temi ricorrenti solo dal tuo testo — nessuna inferenza, nessun giudizio.",
    continuityGenerate: "Genera riepilogo",
    continuityBusy: "Generazione…",
    continuityError:
      "Impossibile generare il riepilogo.",
    continuitySymptoms:
      "Sintomi / disturbi menzionati più volte",
    continuityMeds: "Farmaci menzionati più volte",
    continuityQuestions: "Domande del paziente ripetute",
    continuityConcerns: "Preoccupazioni ripetute",
    continuityToPrep: "Usa nella nuova preparazione",
  },
  followUps: {
    pageTitle: "MedScoutX — Domande di follow-up",
    loading: "Caricamento…",
    title: "Domande di follow-up",
    intro:
      "Messaggi di chiarimento dal tuo studio sulla preparazione salvata.",
    safetyNote:
      "Queste domande di follow-up servono solo a chiarire le tue informazioni prima dell’appuntamento medico. In caso di sintomi acuti contatta direttamente personale sanitario o i servizi di emergenza.",
    empty: "Ancora nessuna domanda di follow-up.",
    loadError:
      "Impossibile caricare i thread di follow-up.",
    open: "Apri conversazione",
    statusLabel: "Stato",
    practiceLabel: "Studio",
    targetLabel: "Medico/destinazione",
    relatedPreparation: "Preparazione collegata",
    createdAt: "Creato",
    waitingForPatient: "In attesa del paziente",
    answered: "Risposto",
    closed: "Chiuso",
    archived: "Archiviato",
    openStatus: "Aperto",
    threadBack: "Torna all’elenco follow-up",
    threadSend: "Invia risposta",
    threadPlaceholder: "Scrivi la tua risposta",
    threadLoadError: "Impossibile caricare il thread.",
    threadSendError:
      "Impossibile inviare la tua risposta.",
    threadEmpty: "Ancora nessun messaggio.",
    senderPractice: "Studio",
    senderPatient: "Tu",
    senderSystem: "Sistema",
  },
};
