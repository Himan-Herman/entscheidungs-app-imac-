/** Sezioni 8–15 */
export default [
  {
    id: "ds-8-speicherfristen",
    heading: "8. Periodi di conservazione",
    blocks: [
      {
        type: "p",
        text:
          "In linea di massima MedScoutX non memorizza in modo permanente cronologie chat, sintomi o immagini sul server. I contenuti sanitari restano solo localmente sul dispositivo (es. LocalStorage) e possono essere cancellati in qualsiasi momento.",
      },
      {
        type: "ul",
        items: [
          "Dati account: e-mail, hash password e lingua per la durata dell’account; dopo la cancellazione vengono cancellati o anonimizzati salvo obblighi legali.",
          "Chat e sintomi: non sono memorizzati sul server; restano sul dispositivo e si cancellano completamente con «Nuova conversazione» o «Elimina cronologia».",
          "Caricamenti immagine: elaborati brevemente per l’inoltro al servizio IA, poi eliminati; nessuna memorizzazione permanente.",
          "Log tecnici / server: per operazioni, sicurezza ed errori il hosting conserva log tecnici (ora, IP troncato, dettagli errore), di solito 14–30 giorni; non sono collegati al profilo né usati per pubblicità.",
          "Dati locali (LocalStorage, archiviazione app): cronologia, impostazioni e voci storiche solo sul dispositivo; rimovibili con «Elimina cronologia» o impostazioni del dispositivo.",
        ],
      },
    ],
  },
  {
    id: "ds-9-sicherheit",
    heading: "9. Sicurezza",
    blocks: [
      {
        type: "p",
        text:
          "Adottiamo misure tecniche e organizzative appropriate per proteggere i dati da perdita, alterazione, accesso non autorizzato o altro uso improprio, in particolare:",
      },
      {
        type: "p",
        text:
          "Il trattamento dei dati sanitari avviene solo dopo il tuo consenso esplicito al primo utilizzo delle funzioni pertinenti (chat sintomi, mappa del corpo, analisi immagini) (checkbox + conferma). Puoi revocare il consenso nelle impostazioni dell’app.",
      },
      {
        type: "ul",
        items: [
          "Crittografia del trasporto (TLS/HTTPS),",
          "restrizioni di accesso e sistemi di ruoli/autorizzazioni,",
          "minimizzazione dei dati e pseudonimizzazione ove possibile,",
          "aggiornamenti regolari dei sistemi.",
        ],
      },
    ],
  },
  {
    id: "ds-10-kinder",
    heading: "10. Minori",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX non è rivolta a minori di 16 anni. I minori dovrebbero usare l’app solo con il consenso dei tutori. Se veniamo a sapere che sono stati trattati dati di un minore sotto i 16 anni senza consenso, li cancelleremo.",
      },
    ],
  },
  {
    id: "ds-11-rechte",
    heading: "11. I tuoi diritti (diritti dell’interessato)",
    blocks: [
      {
        type: "p",
        text: "Ai sensi del GDPR hai in particolare i seguenti diritti:",
      },
      {
        type: "ul",
        items: [
          "Accesso (art. 15 GDPR): informazioni su quali dati personali trattiamo.",
          "Rettifica (art. 16 GDPR): correzione di dati inesatti o integrazione.",
          "Cancellazione (art. 17 GDPR): cancellazione salvo obblighi legali di conservazione.",
          "Limitazione (art. 18 GDPR): limitazione del trattamento.",
          "Portabilità (art. 20 GDPR): ricezione dei dati in formato strutturato e di uso comune.",
          "Opposizione (art. 21 GDPR): opposizione al trattamento basato su interesse legittimo per motivi legati alla tua situazione.",
          "Revoca del consenso (art. 7 comma 3 GDPR): revoca in qualsiasi momento con effetto per il futuro.",
          "Reclamo (art. 77 GDPR): diritto di reclamo a un’autorità di controllo (es. luogo di residenza o sede del titolare).",
        ],
      },
      {
        type: "p",
        text:
          "Per esercitare i diritti puoi contattarci in qualsiasi momento ai recapiti sopra indicati.",
      },
    ],
  },
  {
    id: "ds-12-cookies",
    heading: "12. Cookie e LocalStorage",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX non utilizza cookie di tracciamento per pubblicità. Per comodità può essere usata la memorizzazione locale sul dispositivo, ad es.:",
      },
      {
        type: "ul",
        items: [
          "preferenza lingua,",
          "memorizzazione facoltativa della cronologia chat,",
          "opzioni di accessibilità (es. dimensione caratteri).",
        ],
      },
      {
        type: "p",
        text:
          "Puoi eliminare queste informazioni tramite funzioni nell’app o impostazioni del dispositivo o del browser.",
      },
    ],
  },
  {
    id: "ds-13-berechtigungen",
    heading: "13. Permessi dell’app",
    blocks: [
      {
        type: "p",
        text:
          "A seconda dell’uso MedScoutX può richiedere i seguenti permessi:",
      },
      {
        type: "ul",
        items: [
          "Fotocamera / accesso ai file: per scattare o selezionare immagini per l’analisi. Facoltativo; revocabile nelle impostazioni del dispositivo.",
          "Accesso alla memoria: per elaborare file immagine o dati temporanei.",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX non accede a contenuti senza tua azione e non invia dati in background a terzi non necessari al funzionamento dell’app.",
      },
    ],
  },
  {
    id: "ds-14-ki",
    heading: "14. Note sull’elaborazione tramite IA",
    blocks: [
      {
        type: "ul",
        items: [
          "Testi e, se applicabile, immagini sono elaborati automaticamente per generare suggerimenti.",
          "L’IA può sbagliare o valutare male le situazioni; verifica criticamente gli output e usali solo per orientamento.",
          "Non inserire nomi o dati identificativi di terzi ed evita dati personali non necessari.",
          "L’uso dell’app non sostituisce parere, diagnosi o trattamento medico personale.",
        ],
      },
    ],
  },
  {
    id: "ds-15-entscheid",
    heading: "15. Nessuna decisione automatizzata ai sensi dell’art. 22 GDPR",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX non formula diagnosi né decisioni automatizzate con effetti giuridici o analogamente rilevanti. I contenuti generati dall’IA servono solo all’orientamento e non sostituiscono il parere medico. In situazioni clinicamente rilevanti ti verrà chiesto di contattare un professionista sanitario.",
      },
    ],
  },
];
