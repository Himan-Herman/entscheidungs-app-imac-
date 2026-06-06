/** Sezioni 1–7 */
export default [
  {
    id: "ds-1-verantwortlich",
    heading: "1. Titolare del trattamento",
    blocks: [
      {
        type: "p",
        text:
          "La presente informativa spiega come l’app MedScoutX tratta i dati personali.",
      },
      {
        type: "address",
        lineStrong: "Titolare del trattamento ai sensi del GDPR",
        lines: [
          "Himan Khorshidi",
          "Eisenstraße 64",
          "40227 Düsseldorf, Germania",
        ],
      },
      {
        type: "dl",
        items: [
          { dt: "E-mail", dd: "himankhorshidy@gmail.com", href: "mailto:contact@medscoutx.com" },
          { dt: "Telefono", dd: "+49 211 15895272", href: "tel:+4921115895272" },
        ],
      },
    ],
  },
  {
    id: "ds-2-worum",
    heading: "2. Di cosa si tratta?",
    blocks: [
      {
        type: "p",
        text:
          "Questa informativa descrive come MedScoutX tratta i tuoi dati personali quando:",
      },
      {
        type: "ul",
        items: [
          "installi l’app e crei un account,",
          "raccolti in modo strutturato informazioni per una visita medica e le prepari facoltativamente come PDF,",
          "inserisci sintomi tramite la chat di testo,",
          "selezioni regioni corporee sulla mappa del corpo,",
          "carichi immagini (ad es. foto della pelle o immagini mediche).",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX non è uno strumento diagnostico o terapeutico e non sostituisce visita o parere medico. L’applicazione supporta la preparazione e documentazione strutturate delle tue informazioni prima degli appuntamenti medici. Se generi un PDF solo in locale senza trasmissione, valgono le note speciali ivi descritte.",
      },
    ],
  },
  {
    id: "ds-3-kategorien",
    heading: "3. Categorie di dati personali",
    blocks: [
      {
        type: "p",
        text:
          "A seconda dell’uso dell’app possono essere trattate le seguenti categorie di dati personali:",
      },
      {
        type: "ul",
        items: [
          "Dati dell’account: indirizzo e-mail, eventualmente nome o nome utente, hash della password (nessuna password in chiaro), impostazione della lingua.",
          "Dati sanitari: testi sui sintomi, risposte nella chat sintomi, selezione delle regioni corporee sulla mappa, informazioni sanitarie in campi di testo libero.",
          "Dati immagine: immagini che carichi (ad es. alterazioni cutanee, foto di regioni corporee o altre aree pertinenti alla salute). MedScoutX usa queste immagini per descrivere risultanze rilevanti, non per una diagnosi medica autonoma.",
          "Dati di utilizzo e log: timestamp delle richieste, log tecnici di errore, eventualmente indirizzo IP troncato, informazioni su browser/dispositivo, sistema operativo, versione dell’app.",
          "Dati di abbonamento e contratto (con abbonamento a pagamento): piano, durata, stato dell’abbonamento, dati tecnici di acquisto (tramite App Store / Play Store). I dati di pagamento completi (es. numeri di carta) non sono memorizzati da MedScoutX ma trattati dal servizio di pagamento della piattaforma.",
          "Dati locali sul dispositivo: ad es. cronologia chat o impostazioni (lingua, accessibilità) in LocalStorage o archiviazione comparabile.",
        ],
      },
    ],
  },
  {
    id: "ds-4-zwecke",
    heading: "4. Finalità del trattamento",
    blocks: [
      {
        type: "ul",
        items: [
          "Fornitura delle funzioni dell’app: accesso, registrazione, gestione account e funzioni principali di MedScoutX.",
          "Chat sintomi e domande di follow-up assistite da IA: elaborazione del testo per domande e suggerimenti di chiarimento.",
          "Mappa del corpo: collegamento delle regioni selezionate a domande e suggerimenti IA adeguati.",
          "Analisi immagini: elaborazione delle immagini caricate per descrivere risultanze rilevanti e suggerire possibili passi successivi (es. chiarimento da un clinico). Nessuna diagnosi automatica in senso medico-legale.",
          "Stabilità e sicurezza: analisi errori, rilevamento abusi, protezione di sistemi e dati.",
          "Obblighi di legge: adempimento di obblighi legali (es. documentazione delle misure di sicurezza IT, periodi di conservazione).",
        ],
      },
    ],
  },
  {
    id: "ds-5-rechtsgrundlagen",
    heading: "5. Basi giuridiche (GDPR)",
    blocks: [
      {
        type: "p",
        text:
          "A seconda del caso facciamo affidamento sulle seguenti basi giuridiche:",
      },
      {
        type: "ul",
        items: [
          "Art. 6 comma 1 lett. b GDPR – esecuzione del contratto: per funzioni tecniche come registrazione, login e gestione dell’account.",
          "Art. 6 comma 1 lett. f GDPR – interesse legittimo: sicurezza IT, analisi errori e rilevamento abusi.",
          "Art. 6 comma 1 lett. c GDPR – obbligo legale: ove esistano obblighi di conservazione (es. obblighi fiscali collegati agli abbonamenti).",
          "Art. 9 comma 2 lett. a GDPR – consenso esplicito: base principale per i dati sanitari che inserisci volontariamente (chat sintomi, mappa del corpo, caricamento e analisi immagini). Prima dell’uso ti chiederemo il consenso (es. checkbox e conferma). Puoi revocarlo in qualsiasi momento con effetto per il futuro.",
        ],
      },
    ],
  },
  {
    id: "ds-6-auftragsverarbeiter",
    heading: "6. Responsabili del trattamento e comunicazione a terzi",
    blocks: [
      {
        type: "p",
        text:
          "Per alcune funzioni MedScoutX utilizza fornitori come responsabili ai sensi dell’art. 28 GDPR. Le principali categorie sono:",
      },
      {
        type: "ul",
        items: [
          "Provider di hosting (UE): infrastruttura per server e database (es. Render.com con ubicazione UE).",
          "Fornitore IA – OpenAI (USA): per l’elaborazione IA di testo, immagini e dati della mappa corporea i contenuti sono trasmessi in forma crittografata a OpenAI LLC (San Francisco, USA), elaborati e cancellati dopo l’elaborazione.",
          "Provider di posta elettronica: invio di e-mail di sistema (es. verifica account).",
        ],
      },
      {
        type: "p",
        text:
          "Tutti i responsabili sono vincolati contrattualmente (art. 28 GDPR) e trattano i dati solo su nostra istruzione. Nessuna comunicazione per pubblicità o marketing.",
      },
    ],
  },
  {
    id: "ds-7-drittland",
    heading: "7. Trasferimenti verso paesi terzi",
    blocks: [
      {
        type: "p",
        text:
          "Con le funzioni IA di MedScoutX i contenuti (testo, sintomi, immagini) possono essere trasferiti al fornitore IA OpenAI LLC negli USA. Ciò costituisce un trasferimento verso paesi terzi ai sensi del GDPR.",
      },
      {
        type: "p",
        text:
          "Per garantire un livello adeguato di protezione il trasferimento si basa sulle clausole contrattuali standard dell’UE (art. 46 GDPR) e su misure tecniche e organizzative aggiuntive (crittografia in transito, durata breve, cancellazione dopo la risposta del servizio IA).",
      },
      {
        type: "p_link",
        before: "Ulteriori informazioni nella documentazione privacy di OpenAI: ",
        href: "https://openai.com/policies/privacy-policy",
        linkText: "https://openai.com/policies/privacy-policy",
        after: "",
      },
    ],
  },
];
