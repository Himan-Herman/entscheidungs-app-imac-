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

/** Base Italian overrides — extended layers merged below */
const itBase = {
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
      preferences: "Preferenze",
      appearance: "Aspetto",
      themeLightShort: "Chiaro",
      themeDarkShort: "Scuro",
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

export default deepMerge(
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
