/** Processi di uscita, chiusura e richiesta di cancellazione (paziente + studio). Registro informale (tu), coerente con il resto del bundle IT. */
export const itLifecycleExit = {
  patient: {
    dangerTitle: "Elimina account",
    dangerIntro:
      "L'eliminazione del tuo account MedScoutX è definitiva e non può essere annullata. Prima di eliminare, leggi che cosa verrà eliminato — e che cosa potrebbe non esserlo.",
    whatDeletedTitle: "Che cosa verrà eliminato",
    whatDeletedItems: [
      "Il tuo account personale MedScoutX",
      "I dati paziente che hai salvato in MedScoutX",
      "I tuoi collegamenti personali con gli studi medici",
      "Le tue autorizzazioni personali e i token di accesso",
      "Le tue impostazioni personali e le sessioni",
    ],
    whatRemainsTitle: "Che cosa potrebbe non essere eliminato",
    whatRemainsItems: [
      "La documentazione creata da uno studio medico",
      "Le copie già scaricate o esportate",
      "I dati conservati al di fuori di MedScoutX",
      "I dati che uno studio deve conservare per obblighi propri",
    ],
    whatRemainsNote:
      "MedScoutX non può eliminare dati su sistemi di terzi. Gli studi medici possono essere soggetti a propri obblighi di conservazione e documentazione.",
    exportHint:
      "Consiglio: scarica una copia dei tuoi dati prima dell'eliminazione (sezione «Esportazione dati» qui sopra). Dopo l'eliminazione non è più possibile alcuna esportazione.",
    receiptHint:
      "Dopo l'eliminazione riceverai una conferma scritta con numero di pratica al tuo indirizzo e-mail registrato.",
    openDialogButton: "Elimina account …",
    ownerNoticeTitle: "Possiedi uno studio medico",
    ownerNotice:
      "Al tuo account è collegato almeno uno studio medico. Prima che il tuo account possa essere eliminato, devi decidere che cosa succede allo studio.",
    ownerManageButton: "Gestisci studio",
    dialogTitle: "Eliminare definitivamente il tuo account?",
    dialogWarning:
      "Questa azione non può essere annullata. Il tuo account e i dati paziente salvati in MedScoutX verranno eliminati definitivamente.",
    checkboxLabel:
      "Ho capito quali dati verranno eliminati e quali documenti potrebbero rimanere presso i miei studi medici.",
    phraseLabel: "Digita esattamente questa frase per confermare:",
    phraseExpected: "ELIMINA DEFINITIVAMENTE IL MIO ACCOUNT",
    phraseMismatch: "La frase inserita non corrisponde.",
    confirmButton: "Elimina definitivamente il mio account adesso",
    cancelButton: "Annulla",
    deleting: "Eliminazione dell'account …",
    successTitle: "Il tuo account è stato eliminato",
    successBody:
      "Il tuo account MedScoutX è stato eliminato definitivamente. Numero di pratica: {caseNumber}",
    successEmailHint:
      "Una conferma scritta è stata predisposta per il tuo indirizzo e-mail registrato. La documentazione dei tuoi studi medici o le copie già esportate possono rimanere al di fuori di MedScoutX.",
    supportLabel: "Contatto:",
    errorGeneric: "L'eliminazione non è stata completata. Il tuo account non è stato modificato.",
    errorOwnerBlocked:
      "Al tuo account è collegato almeno uno studio medico. L'eliminazione dell'account non è al momento automatica per i titolari — decidi prima che cosa succede allo studio.",
    errorContextBlocked:
      "L'eliminazione non è stata completata in sicurezza ed è stata annullata completamente. Il tuo account è invariato. Contatta l'assistenza.",
  },
  practice: {
    sectionTitle: "Adesione e stato dello studio",
    sectionIntro:
      "Qui puoi mettere in pausa o chiudere il tuo studio, riattivarlo o richiedere la cancellazione definitiva. Solo il titolare dello studio può eseguire queste azioni.",
    statusLabel: "Stato attuale",
    status: {
      active: "Attivo",
      suspended: "Temporaneamente in pausa",
      closed: "Chiuso",
      reactivation_requested: "Riattivazione richiesta",
      deletion_requested: "Cancellazione definitiva richiesta",
    },
    statusBanner: {
      suspended:
        "Il tuo studio è in pausa. L'accesso operativo è terminato; i dati salvati restano protetti.",
      closed:
        "Il tuo studio è chiuso. L'accesso operativo è terminato. È possibile richiedere una riattivazione.",
      reactivation_requested:
        "La tua richiesta di riattivazione è stata inviata a MedScoutX ed è in esame. Riceverai una risposta scritta.",
      deletion_requested:
        "La tua richiesta di cancellazione definitiva è stata registrata. Non è stato ancora cancellato nulla — MedScoutX esamina prima gli obblighi di conservazione e documentazione.",
    },
    pauseTitle: "Metti temporaneamente in pausa lo studio",
    pauseBody:
      "Lo studio resta salvato e potrà essere riattivato in seguito. L'accesso operativo viene interrotto temporaneamente.",
    pauseRecommendedTitle: "Consigliato per:",
    pauseRecommended: [
      "una pausa temporanea",
      "ferie o riorganizzazione",
      "ritardi nei pagamenti",
      "un ritorno successivo a MedScoutX",
    ],
    pauseButton: "Metti in pausa …",
    pauseConfirmTitle: "Mettere temporaneamente in pausa lo studio?",
    pauseConfirmBody:
      "L'accesso operativo del tuo team termina subito. I dati dei pazienti non vengono eliminati. Puoi riattivare lo studio in qualsiasi momento.",
    closeTitle: "Chiudi lo studio su MedScoutX",
    closeBody:
      "L'adesione termina. Lo studio non può più lavorare operativamente. I dati conservati restano protetti e in seguito è possibile richiedere una riattivazione.",
    closeRecommendedNote:
      "Consigliato se lo studio vuole lasciare MedScoutX senza escludere un ritorno futuro.",
    closeButton: "Chiudi studio …",
    closeConfirmTitle: "Chiudere lo studio su MedScoutX?",
    closeConfirmBody:
      "Tutte le sessioni del team e gli accessi terminano. Non sono possibili nuovi collegamenti con pazienti o condivisioni. Lo studio non viene cancellato; in seguito è possibile richiedere una riattivazione.",
    reactivateTitle: "Riattiva lo studio",
    reactivateBody:
      "Termina la pausa dopo una conferma di sicurezza. I consensi revocati, le condivisioni ritirate e gli accessi del team rimossi non vengono ripristinati automaticamente.",
    reactivateButton: "Riattiva studio …",
    reactivateConfirmTitle: "Riattivare lo studio?",
    reactivateConfirmBody:
      "Il tuo studio torna operativo. Verifica poi la struttura attuale del team e delle autorizzazioni — le revoche precedenti restano valide.",
    requestReactivateTitle: "Richiedi la riattivazione",
    requestReactivateBody:
      "Uno studio chiuso può essere riattivato solo da MedScoutX. La richiesta viene inviata a MedScoutX; riceverai una conferma di ricezione scritta.",
    requestReactivateButton: "Richiedi riattivazione …",
    requestReactivateConfirmTitle: "Richiedere la riattivazione a MedScoutX?",
    requestReactivateConfirmBody:
      "MedScoutX esamina la tua richiesta e risponde per iscritto. Le vecchie condivisioni con i pazienti, i consensi revocati e gli accessi del team non vengono riattivati automaticamente.",
    deleteTitle: "Richiedi la cancellazione definitiva",
    deleteWarning:
      "Una cancellazione definitiva non può essere annullata. Prima della cancellazione devono essere verificati gli obblighi di conservazione, documentazione e protezione dei dati.",
    deleteBody:
      "Questa opzione non cancella subito. Viene creata una richiesta scritta con numero di pratica; la cancellazione resta tecnicamente bloccata finché MedScoutX non ha esaminato e approvato la richiesta.",
    deleteButton: "Richiedi cancellazione definitiva …",
    deleteConfirmTitle: "Richiedere la cancellazione definitiva?",
    deleteConfirmBody:
      "L'accesso operativo termina e viene creata una richiesta scritta di cancellazione. Non viene cancellato nulla finché MedScoutX non ha completato l'esame.",
    reasonLabel: "Motivo oggettivo (facoltativo, nessun contenuto medico)",
    passwordLabel: "Conferma con la tua password",
    passwordHelp:
      "Per motivi di sicurezza devi autenticarti di nuovo con la tua password per questa azione.",
    dialogConfirm: "Conferma",
    dialogCancel: "Annulla",
    working: "In corso …",
    receiptHint:
      "Per ognuna di queste azioni ricevi una conferma scritta con numero di pratica al tuo indirizzo e-mail registrato.",
    afterRequestTitle: "Richiesta di cancellazione registrata",
    afterRequestBody:
      "La tua richiesta è stata registrata. Non è stato ancora cancellato nulla. Numero di pratica: {caseNumber}",
    emailConfirmHint:
      "Conferma la tua richiesta anche via e-mail a {supportEmail}.",
    openMailButton: "Apri e-mail a MedScoutX",
    mailNotSentNote:
      "Nota: aprire il programma di posta non equivale all'invio. La richiesta è confermata solo quando la tua e-mail è stata effettivamente inviata.",
    copyCaseButton: "Copia numero di pratica",
    copySubjectButton: "Copia oggetto",
    copied: "Copiato.",
    copyFailed: "Copia non riuscita — copia manualmente.",
    caseListTitle: "Pratiche",
    mailSubject: "Cancellazione definitiva del mio studio – richiesta {requestId}",
    mailBody:
      "Buongiorno,\n\ncon la presente confermo la richiesta di cancellazione definitiva del mio studio su MedScoutX.\n\nStudio: {practiceName}\nID richiesta: {requestId}\nIndirizzo e-mail registrato: {ownerEmail}\n\nSono consapevole che la cancellazione verrà eseguita solo dopo la verifica di eventuali obblighi di conservazione e documentazione.\n\nCordiali saluti\n{ownerName}",
    supportLabel: "Indirizzo di contatto ufficiale:",
    errors: {
      practice_lifecycle_transition_invalid:
        "Questo cambio di stato non è possibile nello stato attuale.",
      practice_owner_required: "Solo il titolare dello studio può eseguire questa azione.",
      practice_already_suspended: "Lo studio è già in pausa.",
      practice_already_closed: "Lo studio è già chiuso.",
      reactivation_already_requested: "Esiste già una richiesta di riattivazione in corso.",
      deletion_already_requested: "Esiste già una richiesta di cancellazione attiva.",
      confirmation_required: "Conferma l'azione con la password corretta.",
      unsupported_field: "La richiesta conteneva campi imprevisti ed è stata rifiutata.",
      email_delivery_pending:
        "La conferma scritta verrà recapitata non appena l'invio sarà possibile.",
      practice_deletion_locked:
        "La cancellazione definitiva è tecnicamente bloccata finché MedScoutX non ha esaminato e approvato la tua richiesta.",
      generic: "L'azione non è stata eseguita. Non è stato modificato nulla.",
    },
  },
};
