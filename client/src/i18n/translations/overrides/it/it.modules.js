/** Italian — symptom check, image, body map, settings privacy, doctor contacts */
export default {
  settingsPrivacy: {
    heading: "Esportazione ed eliminazione dati",
    intro:
      "Esporta o elimina dall’account i dati MedScoutX legati al Pre-Visit.",
    exportTitle: "Esportazione",
    exportHelp:
      "Scarichi un file JSON strutturato: profilo, contatti, profili struttura (senza segreti), preparazioni, cronologie, follow-up e metadati di audit.",
    exportButton: "Esporta i miei dati",
    exporting: "Preparazione export…",
    exportDone: "Download avviato.",
    exportError: "Export non completato. Riprova più tardi.",
    dangerTitle: "Elimina i dati MedScoutX memorizzati",
    dangerHelp:
      "Rimuove preparazioni Pre-Visit, cronologie, contatti, profili struttura di tua proprietà (incl. destinazioni QR), appartenenze e follow-up associati. L’accesso resta attivo.",
    dangerPhraseLabel: "Digita esattamente la frase di conferma:",
    dangerPhraseHint: "Frase di conferma:",
    dangerPlaceholder: "DELETE_MY_MEDSCOUTX_DATA",
    deleteButton: "Elimina i miei dati memorizzati",
    deleting: "Eliminazione…",
    deleteConfirmError: "La frase di conferma non corrisponde.",
    deleteSuccess:
      "I dati Pre-Visit di MedScoutX sono stati eliminati. Il tuo account resta attivo.",
    deleteError: "Eliminazione non completata. Riprova più tardi.",
    backStart: "Torna all’inizio",
    legalLinksTitle: "Documentazione legale e strumenti account",
    legalLinksIntro:
      "Privacy, condizioni e link per esportare o eliminare dati in MedScoutX.",
    linkPrivacy: "Informativa sulla privacy",
    linkImprint: "Note legali",
    linkTerms: "Termini e condizioni",
    linkAccountPrivacyHub: "Privacy nell’account ed eliminazione Pre-Visit",
  },
  settingsDoctorContacts: {
    pageTitle: "MedScoutX — Contatti clinici",
    heading: "Contatti clinici",
    intro:
      "Gestisci i contatti per condividere la preparazione prima della visita. Solo tu puoi vedere queste voci.",
    backHome: "Torna all’inizio",
    backPatientHub: "Torna all’area paziente",
    retryLoad: "Riprova",
    addContact: "Aggiungi contatto",
    save: "Salva",
    cancel: "Annulla",
    edit: "Modifica",
    delete: "Elimina",
    deleteConfirm:
      "Eliminare definitivamente questo contatto? Le selezioni locali in una preparazione aperta restano finché non le modifichi.",
    empty: "Nessun contatto. Aggiungi ad esempio il tuo studio o specialista.",
    loadingContacts: "Caricamento…",
    loadError: "Impossibile caricare i contatti.",
    saveError: "Impossibile salvare il contatto.",
    deleteError: "Impossibile eliminare il contatto.",
    fieldDoctorName: "Nome del professionista",
    fieldPracticeName: "Struttura / studio",
    fieldSpecialty: "Specialità",
    fieldEmail: "E-mail",
    fieldPhone: "Telefono (facoltativo)",
    fieldAddress: "Indirizzo (facoltativo)",
    fieldNote: "Nota (facoltativo)",
    requiredHint: "I campi obbligatori sono indicati.",
    cardAria: "Contatto clinico",
    linkEmail: "Invia e-mail",
    linkPhone: "Chiama",
    linkAddress: "Indicazioni stradali",
  },
  symptomCheck: {
    pageTitle: "Raccolta guidata dei sintomi — MedScoutX",
    heading: "Raccolta guidata dei sintomi",
    subtitle:
      "Organizza sintomi e contesto prima della visita medica con orientazione generale. Non fornisce diagnosi né raccomandazioni terapeutiche.",
    chipPrimary: "Raccolta guidata",
    chipSecondary: "Preparazione alla visita",
    storeSafetyNotice:
      "MedScoutX non fornisce diagnosi medica, non sostituisce il consulto clinico e non è un servizio di emergenza. In caso di sintomi acuti o particolarmente gravi rivolgersi subito ai servizi di emergenza o a un clinico.",
    consentTitle: "Prima di continuare",
    consentCheckbox:
      "Comprendo che questa funzione non è per le emergenze, non offre diagnosi né raccomandazioni di trattamento e non valuta la gravità. Il testo della chat può restare su questo dispositivo finché non lo elimino; inviando un messaggio il testo viene elaborato sui server MedScoutX e presso fornitori di IA secondo l’Informativa privacy. La voce viene inviata solo quando avvio una registrazione.",
    consentContinue: "Continua",
    consentPrivacyLink: "Informativa sulla privacy",
    hintsTitle: "Suggerimenti per descrivere ciò che percepisci",
    hintsIntro:
      "Brevezza e precisione aiutano a preparare il tuo riassunto per la visita medica.",
    hintDuration: "Da quando lo percepisci?",
    hintLocation: "In quale zona lo senti?",
    hintSeverity:
      "Che intensità ha per te (ad esempio da 1 a 10)?",
    hintAssociated:
      "Vuoi aggiungere sonno, attività, febbre o altri elementi?",
    newChat: "Nuova conversazione",
    newChatAria: "Avvia una nuova conversazione",
    clearHistory: "Cancella cronologia",
    clearHistoryAria: "Cancella la cronologia salvata su questo dispositivo",
    chatTitle: "Conversazione",
    chatIntro:
      "Domande neutre e, se utile, un riepilogo strutturato per le tue note — non è una valutazione clinica.",
    placeholderEmpty: "Ancora nessun messaggio. Ad esempio puoi iniziare con:",
    placeholderExample:
      "«Da ieri dolore acuto in zona lombare quando mi piego.»",
    thinking: "Preparazione risposta…",
    analyzingAvoided: "Preparazione risposta…",
    inputLabel: "La tua descrizione con le tue parole",
    inputPlaceholder:
      "Descrivi ciò che percepisci — sede, durata, intensità, circostanze scatenanti, ecc.",
    maxCharsLabel: "Max {{max}} caratteri",
    sendAria: "Invia messaggio",
    offlineError:
      "Nessuna connessione. La raccolta guidata richiede rete.",
    offlineBadge: "Offline",
    serverError: "Qualcosa non ha funzionato. Riprova più tardi.",
    copyConversation: "Copia conversazione",
    downloadTxt: "Scarica come testo",
    copyDone: "Copiato negli appunti.",
    copyFail: "Copia non riuscita — seleziona manualmente il testo.",
    speakAria: "Leggi la risposta ad alta voce",
    micNotice:
      "Microfono: la registrazione inizia solo alla pressione del pulsante e termina alla pressione di stop.",
    voiceStart: "Avvia ingresso vocale",
    voiceStop: "Interrompi ingresso vocale",
    voiceMicError: "Microfono non disponibile.",
    voiceTxError: "Impossibile trascrivere.",
    statusReady: "Pronto",
    assistantLabel: "Assistente",
    userLabel: "Tu",
    accountDataHint:
      "Esportazione ed eliminazione dati salvati (se disponibili):",
    accountDataLink: "Privacy e dati",
  },
  imageAnalysis: {
    pageTitle: "Descrizione strutturata delle immagini — MedScoutX",
    heading: "Descrizione strutturata delle immagini",
    subtitle:
      "Organizza ciò che è visibile nell’immagine per preparare la visita medica. Non è diagnosi né valutazione clinica.",
    chipPrimary: "Immagine caricata dalla persona",
    chipSecondary: "Preparazione alla visita",
    storeDisclaimer:
      "MedScoutX non formula diagnosi dalle immagini e non sostituisce l’osservazione clinica. Supporta solo l’organizzazione di immagini che carichi ai fini dell’incontro con il clinico.",
    emergencyNote:
      "In caso di sintomi acuti o situazioni potenzialmente gravi rivolgersi subito ai servizi di emergenza o a un professionista sanitario.",
    storageNote:
      "L’anteprima resta su questo dispositivo per la sessione. La chat può essere salvata in locale finché non la elimini. L’immagine non resta memorizzata in modo permanente salvo tu lo decida esplicitamente.",
    consentTitle: "Prima di caricare l’immagine",
    consentCheckbox:
      "Confermo che l’immagine può essere trattata per generare una descrizione strutturata (incluso invio ai server MedScoutX e a fornitori di IA, come da Informativa privacy).",
    consentContinue: "Continua",
    consentPrivacyLink: "Informativa sulla privacy",
    panelUploadTitle: "Scegli immagine",
    panelUploadIntro:
      "Galleria, foto puntuale o webcam solo dopo un tuo comando. Nulla viene inviato prima che invii un messaggio.",
    uploadGallery: "Scegli dalla galleria",
    uploadCamera: "Scatta o scegli foto",
    uploadWebcam: "Usa webcam",
    webcamExplainer:
      "La telecamera si attiva solo dopo un tap/tocco; nessuna registrazione continua sullo sfondo.",
    removeImage: "Rimuovi immagine",
    removeImageAria: "Rimuovi l’immagine selezionata dall’anteprima",
    previewAlt: "Immagine selezionata per la descrizione strutturata",
    previewCaption: "Anteprima — non è giudizio clinico",
    previewEmpty: "Nessuna immagine selezionata ancora",
    processingNote:
      "Le descrizioni dipendono dall’immagine e da ciò che indichi — non costituiscono diagnosi.",
    newChat: "Reimposta tutto",
    newChatAria: "Elimina immagine, chat e thread locale da questo dispositivo",
    clearHistory: "Cancella solo la chat",
    clearHistoryAria: "Elimina solo il testo salvato in locale per questa chat",
    chatTitle: "Conversazione",
    chatIntro:
      "Aggiungi contesto in modo neutro. Le risposte sono appunti per la visita — senza interpretazione clinica.",
    placeholderEmpty:
      "Nessun messaggio. Dopo aver scelto l’immagine potresti scrivere:",
    placeholderExample:
      "«Descrivi in parole semplici cosa cambia o cosa vedi.»",
    loadingText: "Creazione descrizione strutturata…",
    questionLabel: "Domanda o contesto",
    questionPlaceholder:
      "Aggiungi contesto o chiedi una descrizione neutra e strutturata…",
    maxCharsLabel: "Max {{max}} caratteri",
    sendAria: "Invia per generare la descrizione strutturata",
    inputDisabledHint:
      "Seleziona l’immagine e conferma il consenso prima di inviare.",
    needImageWarning: "Seleziona un’immagine prima di inviare.",
    webcamTitle: "Foto con webcam",
      webcamIntro:
        "Inquadra la zona rilevante e scatta. Lo streaming si ferma dopo lo scatto o l’annullamento.",
    webcamCapture: "Scatta",
    webcamCancel: "Annulla",
    cameraDenied: "Accesso alla fotocamera negato o non disponibile.",
    offlineError: "Nessuna connessione. Questo passaggio richiede rete.",
    serverError: "Qualcosa non ha funzionato. Riprova più tardi.",
    speakAria: "Leggi la risposta ad alta voce",
    statusReady: "Pronto",
    offlineBadge: "Offline",
    micNotice:
      "L’audio viene inviato solo quando registri volontariamente; non viene salvato automaticamente.",
    voiceStart: "Avvia ingresso vocale",
    voiceStop: "Interrompi ingresso vocale",
    voiceMicError: "Microfono non disponibile.",
    voiceTxError: "Impossibile trascrivere.",
    accountDataHint:
      "Esportazione ed eliminazione dati dell’account (se offerte):",
    accountDataLink: "Privacy e dati",
    userLabel: "Tu",
    assistantLabel: "Nota strutturata",
  },
  bodyMap: {
    start: {
      pageTitle: "Mappa corporea — MedScoutX",
      title: "Mappa corporea",
      subtitle:
        "Segna regioni e raccogli osservazioni in vista della visita medica. Non è diagnosi né esame medico.",
      chip1: "Localizzazione",
      chip2: "Preparazione alla visita",
      storeDisclaimer:
        "La mappa corporea serve solo a segnare zone in modo visivo e a preparare informazioni per una visita medica. Nessuna conclusione clinica automatica ricavata dai segni sulla mappa.",
      emergencyNote:
        "Per sintomi acuti molto invalidanti rivolgersi subito a emergenza o a un clinico.",
      consentTitle: "Prima di usare la mappa corporea",
      consentCheckbox:
        "Comprendo che la mappa non formula diagnosi e non valuta l’urgenza; la chat può essere salvata su questo dispositivo finché non la elimino; inviando messaggi il testo transita nei server MedScoutX e in ambito IA come da Informativa privacy.",
      consentContinue: "Continua",
      consentPrivacyLink: "Informativa sulla privacy",
      panelTitle: "Scegli la vista",
      hint:
        "Passa dalla vista frontale a quella posteriore. I controlli sono utilizzabili da tastiera e da lettori di schermo.",
      open: "Apri selettore vista",
      close: "Chiudi selettore vista",
      frontAria: "Apri mappa — vista frontale",
      frontTitle: "Fronte",
      frontText: "Torace, addome, viso, braccia e gambe sulla parte anteriore.",
      backAria: "Apri mappa — dorso",
      backTitle: "Schiena",
      backText: "Dorso, nuca, spalle e facce posteriori di braccia e gambe.",
      footer:
        "Puoi cambiare vista anche dopo. La chat di una zona resta salvata sul dispositivo finché non la elimini.",
    },
    mapFront: {
      pageTitle: "Mappa corporea — fronte — MedScoutX",
      heading: "Mappa corporea — fronte",
      inlineDisclaimer:
        "Seleziona una zona per continuare con note neutre — non è esame clinico.",
      backToHub: "Torna all’inizio mappa",
      backToHubAria: "Torna all’introduzione della mappa corporea",
      diagramAria:
        "Schema corporeale frontale; seleziona una regione.",
    },
    mapBack: {
      pageTitle: "Mappa corporea — schiena — MedScoutX",
      heading: "Mappa corporea — schiena",
      inlineDisclaimer:
        "Seleziona una regione per prendere note neutre — non è esame clinico.",
      backToHub: "Torna all’inizio mappa",
      backToHubAria: "Torna all’introduzione della mappa corporea",
      diagramAria:
        "Schema corporeale di schiena; seleziona una regione.",
    },
    chat: {
      pageTitle: "Note regione corporea — MedScoutX",
      title: "Note sulla regione selezionata",
      subtitle:
        "Descrivi con le tue parole ciò che percepisci; riceverai domande neutre per ordinare gli appunti — senza giudizio clinico automatico.",
      chip1: "Mappa corporea",
      chip2: "Localizzazione",
      sectionChat: "Conversazione",
      chatHeading: "Descrivi in quest’area",
      chatIntro:
        "Condividi sensazioni o osservazioni che scegli di registrare. Non sostituisce l’accertamento del clinico.",
      placeholderEmpty:
        "Per prima cosa scegli una zona sulla mappa; poi descrivi ad esempio:",
      placeholderExample:
        "«Da diversi giorni tensione sulla spalla destra quando sollevo il braccio.»",
      loadingLine: "Preparazione risposta…",
      serverError: "Qualcosa non ha funzionato. Riprova più tardi.",
      httpError: "Richiesta non riuscita. Riprova più tardi.",
      inputLabel: "La tua descrizione in questa regione",
      inputPlaceholder:
        "Tipo di sensazione, durata, fattori scatenanti — con parole tue…",
      maxCharsLabel: "Max {{max}} caratteri",
      sendAria: "Invia messaggio",
      organHintIntro: "Mantieni il racconto collegato alla zona segnata.",
      organHintExample: "Esempio: «Nella/e {{region}}…»",
      organHintOutro:
        "Per temi che non dipendono da questa regione usa la raccolta guidata sintomi più generica.",
      btnNewChat: "Ripristina percorso mappa",
      btnNewChatTitle: "Elimina chat e torna all’introduzione mappa",
      btnClearHistory: "Cancella solo chat",
      btnClearHistoryTitle: "Elimina i messaggi locali di questa chat",
      speakAria: "Leggi ad alta voce",
      micNotice:
        "La registrazione vocale parte solo dopo il comando — nessuna ascolto continuo.",
      voiceStart: "Avvia ingresso vocale",
      voiceStop: "Interrompi ingresso vocale",
      voiceMicError: "Microfono non disponibile.",
      voiceTxError: "Impossibile trascrivere.",
      introAssistant:
        'Hai segnato "{{region}}" sulla mappa. Descrivi con parole tue cosa avverti qui.',
      userLabel: "Tu",
      assistantLabel: "Assistente",
      offlineError: "Nessuna connessione. Questo passaggio richiede rete.",
      accountDataHint: "Privacy, esportazione ed eliminazione:",
      accountDataLink: "Privacy e dati",
    },
  },
};
