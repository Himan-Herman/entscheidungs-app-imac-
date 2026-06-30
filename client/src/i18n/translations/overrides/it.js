import { deepMerge } from "../../deepMerge.js";
import legalIt from "../legal/it/index.js";
import landing from "./it.landing.js";
import info from "./it.info.js";
import preVisit from "./it.preVisit.js";
import startseite from "./it.startseite.js";
import itCore from "./it/it.core.js";
import itAccount from "./it/it.account.js";
import itModules from "./it/it.modules.js";
import itPractice from "./it/it.practice.js";
import itPatient from "./it/it.patient.js";
import itMedicalInterpreter from "./it/it.medicalInterpreter.js";
import itPracticeModules from "./it/it.practice.modules.js";
import itVaccinations from "./it/it.vaccinations.js";
import itVitals from "./it/it.vitals.js";
import itHealthHistory from "./it/it.healthHistory.js";
import { itSymptomDiary } from "./it/it.symptomDiary.js";
import itErezept from "./it/it.erezept.js";
import itSosCard from "./it/it.sosCard.js";
import { itPracticeBillingPlausibility, itPracticeIntegrationsVendors } from "./it/it.practiceBillingPlausibility.js";
import { itPatientBillingExplain } from "./it/it.patientBillingExplain.js";
import { itPracticeDirectory } from "./it/it.practiceDirectory.js";
import { itTelemedicine } from "./it/it.telemedicine.js";

/** Base Italian overrides — extended layers merged below */
const itBase = {
  roleEntry: {
    hero: {
      title: "Un unico accesso che rende la visita più serena.",
      lead: "MedScoutX ti aiuta a mettere in ordine le tue esigenze prima dell’appuntamento — per colloqui più chiari, una documentazione curata e dati che restano nelle tue mani.",
    },
    flow: {
      eyebrow: "Come funziona",
      title: "Dall’incertezza a un colloquio strutturato",
      aria: "Flusso in tre passaggi: Raccogliere, Strutturare, Consegnare",
      steps: [
        {
          title: "Raccogliere",
          body: "Prepara con calma sintomi, domande e documenti, al tuo ritmo.",
        },
        {
          title: "Strutturare",
          body: "MedScoutX trasforma i tuoi dati in una panoramica chiara e leggibile.",
        },
        {
          title: "Consegnare",
          body: "Condividila in sicurezza con il tuo studio in PDF o tramite codice QR.",
        },
      ],
    },
    metrics: {
      eyebrow: "Ciò che distingue MedScoutX",
      title: "Ponderato, multilingue, sicuro",
      note: "Caratteristiche del prodotto — non statistiche d’uso.",
      aria: "Caratteristiche del prodotto MedScoutX",
      items: [
        {
          value: 2,
          label: "Aree",
          hint: "Pazienti e studi — un unico accesso",
        },
        {
          value: 5,
          label: "Lingue dell’interfaccia",
          hint: "Deutsch · English · Français · Español · Italiano",
        },
        {
          value: 14,
          label: "Moduli di preparazione",
          hint: "Sette per i pazienti, sette per gli studi",
        },
        {
          value: 3,
          label: "Passaggi per prepararsi",
          hint: "Raccogliere, Strutturare, Consegnare",
        },
      ],
    },
    manifesto: {
      eyebrow: "Digitalizzazione centrata sulla persona",
      title: "Tecnologia al servizio del colloquio — non il contrario.",
      body: [
        "La buona medicina inizia dall’ascolto. MedScoutX ti solleva dalle scartoffie e dall’incertezza prima dell’appuntamento, così nello studio resta tempo per ciò che conta: il colloquio tra una persona e il suo medico.",
        "Chi arriva preparato ricorda le domande giuste, descrive i sintomi con più precisione e comprende meglio le decisioni. La struttura porta calma — e la calma porta colloqui migliori.",
        "I tuoi dati sanitari appartengono a te. MedScoutX elabora solo ciò che serve alla preparazione, rende trasparente ogni autorizzazione e consegna i documenti cifrati. La fiducia non è un extra — è il fondamento.",
      ],
      trust: [
        "Conforme al GDPR",
        "Nessuna diagnosi, nessuna terapia — solo preparazione",
        "I tuoi dati restano nelle tue mani",
      ],
    },
    video: {
      eyebrow: "MedScoutX in azione",
      title: "Uno sguardo veloce",
      body: "Scopri in pochi secondi com'è una preparazione strutturata: calma, chiara e completamente nei tuoi tempi.",
      aria: "Video di presentazione di MedScoutX",
      play: "Riproduci video",
      pause: "Metti in pausa il video",
      mute: "Disattiva audio",
      unmute: "Attiva audio",
    },
  },
  legal: legalIt,
  landing,
  info,
  preVisit,
  header: {
    skip: "Vai al contenuto",
    homeAria: "Vai alla home",
    navToggle: "Apri o chiudi la navigazione",
    nav: "Navigazione principale",
    appLabel: "Area professionale",
    home: "Home",
    logout: "Esci",
    languageLabel: "Lingua",
    themeLight: "Passa alla modalità chiara",
    themeDark: "Passa alla modalità scura",
    account: {
      menuAria: "Apri il menu dell'account",
      rolePatient: "Account paziente",
      rolePractice: "Account studio",
      avatarPatientAlt: "Immagine del profilo del paziente",
      avatarPracticeAlt: "Logo dello studio",
    },
  },
  accountPortal: {
    imageTitle: "Immagine del profilo",
    imageUpload: "Carica immagine del profilo",
    imageChange: "Cambia immagine del profilo",
    imageRemove: "Rimuovi immagine del profilo",
    imageUploading: "Caricamento…",
    imageHint: "PNG, JPEG o WebP, max. 2 MB.",
    imageAlt: "Immagine del profilo del paziente",
    imageErrorType: "Tipo di file non supportato. Usa PNG, JPEG o WebP.",
    imageErrorTooLarge: "File troppo grande. Massimo 2 MB.",
    imageErrorGeneric: "Caricamento non riuscito. Riprova.",
  },
  login: {
    badge: "MedScoutX — preparazione alla visita",
    title: "Accesso",
    subtitle:
      "Preparazione strutturata per il colloquio medico — non sostituisce il parere clinico.",
    email: "E-mail",
    emailPlaceholder: "es. nome@mail.com",
    password: "Password",
    passwordPlaceholder: "Password",
    submitting: "Accesso in corso…",
    submit: "Accedi",
    forgot: "Password dimenticata?",
    noAccount: "Non hai un account?",
    register: "Registrati",
    imprint: "Impressum / Note legali",
    privacy: "Privacy",
    emailFirst: "Conferma prima l’e-mail.",
    loginFailed: "Accesso non riuscito.",
    loginError: "Errore di accesso.",
    verifyOk: "E-mail confermata. Ora puoi accedere.",
    verifyInvalid:
      "Il link non è valido o è scaduto. Registrati di nuovo.",
    verifyError:
      "Errore durante la conferma. Riprova più tardi.",
    resetOk:
      "Password reimpostata. Accedi con la nuova password.",
    sessionExpired:
      "Sessione scaduta. Accedi di nuovo per continuare a usare MedScoutX.",
  },
  register: {
    alert: "Avviso:",
    alertText: "MedScoutX non è un servizio di emergenza (112 / 911).",
    title: "Crea account",
    subtitle:
      "Account per preparare le visite — non per formulare una diagnosi.",
    required: "Campo obbligatorio",
    email: "E-mail",
    emailPlaceholder: "es. nome@mail.com",
    emailHint:
      "Usiamo l’e-mail per l’account e gli aggiornamenti importanti.",
    password: "Password",
    passwordPlaceholder: "Min. 8 caratteri, lettera e numero",
    passwordHint: "Almeno 8 caratteri, con lettera e numero.",
    firstName: "Nome",
    lastName: "Cognome",
    birthDate: "Data di nascita",
    minorTitle: "Avviso:",
    minorText:
      "Non sei maggiorenne. MedScoutX è solo per utenti di almeno 18 anni.",
    gender: "Genere",
    genderPlaceholder: "Seleziona…",
    genderFemale: "Donna",
    genderMale: "Uomo",
    genderDiverse: "Altro",
    genderNone: "Preferisco non dirlo",
    consents: "Consensi",
    ageConfirm: "Confermo di avere almeno 18 anni",
    termsOpen: "Apri termini e condizioni",
    privacyOpen: "Apri informativa sulla privacy",
    disclaimerOpen: "Apri avviso informativo sui limiti della piattaforma",
    legalTextStart: "Ho letto i",
    legalTextMiddle: "l’informativa sulla privacy",
    legalTextEnd: " e accetto quanto indicato.",
    submit: "Continua",
    saving: "Salvataggio…",
    cancel: "Annulla",
    imprint: "Note legali",
    privacy: "Privacy",
    disclaimer: "avviso informativo",
    terms: "Termini e condizioni",
    language: "Lingua",
    enterBirth: "Inserisci la data di nascita.",
    underage:
      "Non sei maggiorenne. MedScoutX è solo per utenti di almeno 18 anni.",
    confirmAge: "Conferma di avere almeno 18 anni.",
    checkFields: "Controlla campi obbligatori e consensi.",
    emailExists: "Questa e-mail è già registrata.",
    failed: "Registrazione non riuscita.",
    requestError: "Errore di registrazione.",
    srRequired: "(obbligatorio)",
    firstNamePlaceholder: "es. Maria",
    lastNamePlaceholder: "es. Rossi",
    conjunctionAnd: "e l’",
    legalLinksAria: "Informazioni legali",
  },
  footer: {
    imprint: "Note legali",
    privacy: "Privacy",
    terms: "Termini",
    disclaimer: "Disclaimer",
    ariaLabel: "Link legali",
  },
  common: {
    continue: "Continua",
    cancel: "Annulla",
    close: "Chiudi",
  },
  startseite,
  forgotPassword: {
    title: "Reimposta password",
    text: "Inserisci l’e-mail. Ti invieremo un link di reimpostazione.",
    email: "E-mail",
    placeholder: "nome@mail.com",
    submit: "Richiedi link",
    submitting: "Invio…",
    back: "Torna all’accesso",
    badge: "Recupero account sicuro",
    success: "Se l’e-mail esiste, è stato inviato un link.",
    error: "Si è verificato un errore. Riprova più tardi.",
    network: "Errore di rete. Riprova più tardi.",
  },
  checkEmail: {
    badge: "Accesso MedScoutX sicuro",
    title: "Conferma l’e-mail",
    text: "Ti abbiamo inviato un’e-mail di verifica. Aprila e conferma per attivare l’account.",
    tip: "Suggerimento:",
    tipText: "Controlla anche spam o promozioni.",
    resend: "Invia di nuovo l’e-mail",
    resending: "Invio…",
    success: "E-mail reinviata.",
    error: "Si è verificato un errore. Riprova più tardi.",
    network: "Errore di rete. Controlla la connessione.",
    missing: "Nessuna e-mail in attesa. Registrati di nuovo.",
    footer:
      "Se non hai richiesto MedScoutX, puoi ignorare questo messaggio.",
  },
  resetPassword: {
    title: "Nuova password",
    text: "Imposta una password sicura.",
    label: "Nuova password",
    placeholder: "Almeno 8 caratteri",
    hint: "Almeno 8 caratteri; numero e simbolo consigliati.",
    save: "Salva password",
    saving: "Salvataggio…",
    invalidLink: "Link non valido o mancante.",
    shortPassword: "La password deve avere almeno 8 caratteri.",
    unknownError: "Errore sconosciuto.",
    requestError: "Errore: ",
    success: "Password aggiornata. Reindirizzamento…",
    network: "Errore di rete. Riprova più tardi.",
  },
};

const itComposed = deepMerge(
  deepMerge(
    deepMerge(deepMerge(deepMerge(itBase, itCore), itAccount), itModules),
    itPractice,
  ),
  deepMerge(
    deepMerge(deepMerge(itPatient, itMedicalInterpreter), itPracticeModules),
    deepMerge(
      deepMerge(deepMerge(deepMerge(deepMerge(deepMerge({ vaccinations: itVaccinations }, { vitals: itVitals }), { healthHistory: itHealthHistory }), { symptomDiary: itSymptomDiary }), { erezept: itErezept }), { sosCard: itSosCard }),
      deepMerge(
        deepMerge(
          { practiceBillingPlausibility: itPracticeBillingPlausibility },
          { practiceIntegrations: itPracticeIntegrationsVendors },
        ),
        deepMerge({ patientBillingExplain: itPatientBillingExplain }, { practiceDirectory: itPracticeDirectory }),
      ),
    ),
  ),
);

/** Public Messe/DemoDay showcase — sample data only, no API. */
const itPublicDemo = {
  publicDemo: {
    pageTitle: "MedScoutX — Demo",
    badge: "Demo · dati di esempio",
    entryButton: "Guarda la demo",
    heading: "MedScoutX in sintesi",
    sub: "Esplora una demo sicura con dati di esempio, senza accedere. Tutti i contenuti sono fittizi e servono solo a scopo illustrativo.",
    bannerTitle: "Questa è una demo con dati di esempio.",
    bannerBody:
      "Non vengono mostrati dati reali di pazienti o studi. Per usare l’app reale con i tuoi dati, accedi normalmente.",
    backToSite: "Torna alla home",
    loginCta: "Vai all’accesso",
    sectionPatient: "Per i pazienti",
    sectionPatientSub: "Cosa possono vedere e gestire gli assistiti in MedScoutX.",
    sectionPractice: "Per gli studi",
    sectionPracticeSub: "Come lavorano i team con MedScoutX.",
    openLabel: "Vedi esempio",
    modalClose: "Chiudi",
    sampleNote: "Dati di esempio — solo a scopo illustrativo.",
    badges: {
      ok: "Aggiornato",
      pending: "In sospeso",
      info: "Info",
      done: "Fatto",
      scheduled: "Pianificato",
      review: "Da verificare",
    },
    tiles: {
      appointments: {
        label: "Appuntamenti",
        sub: "Prossimi appuntamenti",
        detail: "Appuntamenti in arrivo e richiesti — riuniti in un unico posto.",
      },
      messages: {
        label: "Messaggi",
        sub: "Scambio sicuro con lo studio",
        detail: "Messaggi tra paziente e studio quando esiste un collegamento.",
      },
      medication: {
        label: "Piano terapeutico",
        sub: "Farmaci attuali",
        detail: "Il piano terapeutico attuale con dosaggio e indicazioni di assunzione.",
      },
      documents: {
        label: "Referti e documenti",
        sub: "Documenti archiviati in sicurezza",
        detail: "Referti condivisi dallo studio e documenti personali.",
      },
      vitals: {
        label: "Parametri vitali",
        sub: "Pressione, polso e altro",
        detail: "Parametri vitali registrati da te, nel tempo.",
      },
      vaccinations: {
        label: "Libretto vaccinale",
        sub: "Vaccini e richiami",
        detail: "Panoramica digitale dei vaccini e dei richiami in programma.",
      },
      patients: {
        label: "Pazienti",
        sub: "Persone collegate",
        detail: "Persone collegate allo studio — solo con consenso attivo.",
      },
      booking: {
        label: "Appuntamenti e richieste",
        sub: "Gestire le richieste",
        detail: "Accettare, pianificare e confermare le richieste di appuntamento.",
      },
      anamnesis: {
        label: "Anamnesi",
        sub: "Modelli e risposte",
        detail: "Creare modelli di anamnesi e consultare le risposte ricevute.",
      },
      billing: {
        label: "Verifica GOÄ / PKV",
        sub: "Verificare la plausibilità",
        detail: "Verifica deterministica delle voci di fatturazione — non vincolante.",
      },
      telemedicine: {
        label: "Videoconsulto",
        sub: "Appuntamenti in video",
        detail: "Pianificare e svolgere videoconsulti.",
      },
      activity: {
        label: "Attività",
        sub: "Eventi recenti",
        detail: "Panoramica tracciabile dell’attività recente del team.",
      },
    },
  },
};

export default deepMerge(deepMerge(itComposed, itTelemedicine), itPublicDemo);
