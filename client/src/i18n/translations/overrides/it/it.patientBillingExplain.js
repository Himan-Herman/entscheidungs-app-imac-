// Patient-facing "Capire la fattura" (GOÄ/PKV) — Italian override.
// Non-binding guidance only. No legal advice, no final invoice review, no medical assessment.
export const itPatientBillingExplain = {
  title: "Capire la fattura",
  subtitle: "Fattura privata (GOÄ/PKV) spiegata in modo semplice – a titolo orientativo",
  shortDescription:
    "Questa funzione la aiuta a comprendere meglio una fattura medica privata (GOÄ/PKV). Lei inserisce i dati della sua fattura e noi spieghiamo le voci indicate in un linguaggio chiaro, segnalando eventuali domande. Si tratta di un orientamento a titolo indicativo, non di una verifica della sua fattura.",

  disclaimerBanner:
    "Orientamento a titolo indicativo. Questa funzione spiega i suoi dati in modo chiaro e segnala eventuali domande. Non costituisce consulenza legale, né una verifica definitiva della fattura, né informazione medica. In caso di dubbio, contatti il suo studio medico, la sua assicurazione sanitaria privata o una consulenza qualificata.",
  privacyNote:
    "I suoi dati non vengono conservati in modo permanente e sono trattati solo per la spiegazione attuale. La preghiamo di non inserire nomi, date di nascita o diagnosi – sono sufficienti i dati di fatturazione (codice, fattore, quantità, importo) o il semplice testo della fattura.",
  resultNote:
    "La spiegazione seguente riguarda esclusivamente i dati da lei inseriti. È un orientamento a titolo indicativo e non una valutazione sull’esattezza o completezza della sua fattura. Può sottoporre cortesemente i punti aperti al suo studio medico o alla sua assicurazione sanitaria privata utilizzando i modelli qui sotto.",
  footerNote:
    "Orientamento a titolo indicativo – non è consulenza legale né una verifica definitiva della fattura. In caso di dubbio, contatti il suo studio medico, la sua assicurazione sanitaria privata o una consulenza qualificata.",

  inputModeFields: "Compilare i campi",
  inputModeText: "Incollare il testo della fattura",

  fieldZiffer: "Codice GOÄ",
  fieldZifferPlaceholder: "es. 1, 3, 250",
  fieldFactor: "Fattore di maggiorazione",
  fieldFactorPlaceholder: "es. 2,3",
  fieldCount: "Quantità",
  fieldCountPlaceholder: "es. 1",
  fieldAmount: "Importo (facoltativo)",
  fieldAmountPlaceholder: "es. 21,45 €",
  fieldNote: "Sua nota (facoltativo)",
  fieldNotePlaceholder: "es. un’indicazione riportata sulla fattura",
  pasteInvoiceLabel: "Incollare il testo della fattura",
  pasteInvoicePlaceholder:
    "Incolli qui le voci della fattura – senza nomi, date di nascita o diagnosi",

  btnExplain: "Spiega i dati",
  btnAddRow: "Aggiungi un’altra voce",
  btnReset: "Reimposta i dati",
  btnDraftPractice: "Crea una domanda per lo studio",
  btnDraftInsurer: "Crea una domanda per l’assicurazione",
  btnCopy: "Copia il testo",
  btnCopied: "Copiato",

  resultHeading: "Spiegazione dei suoi dati",
  catalogUnknownLabel: "Non presente nel prospetto",
  result_noFindings:
    "In base ai dati inseriti non sono emersi punti evidenti da chiarire. È un orientamento a titolo indicativo e non una conferma che la fattura sia corretta o completa. Per qualsiasi domanda, il suo studio medico o la sua assicurazione sanitaria privata sono a disposizione.",

  warn_unknown_goae_ziffer:
    "Questo codice non è presente nel nostro prospetto di riferimento. Ciò non significa che sia errato – semplicemente non può essere spiegato qui automaticamente. Può chiederlo al suo studio medico o verificarlo con il testo ufficiale della GOÄ.",
  warn_invalid_factor:
    "Non è stato possibile leggere il fattore di questa voce. La preghiamo di verificare l’inserimento (un numero, es. 2,3).",
  warn_invalid_count:
    "Non è stato possibile leggere la quantità di questa voce. La preghiamo di verificare l’inserimento (un numero intero a partire da 1).",
  warn_factor_requires_justification:
    "Il fattore indicato supera il valore massimo abituale (2,3). Un fattore più alto è possibile ed è spesso accompagnato da una breve motivazione. È un possibile punto su cui chiedere chiarimenti – senza pronunciarsi sull’esattezza.",
  warn_justification_missing:
    "Nei suoi dati non è riportata alcuna motivazione per questo fattore più alto. Può chiedere cortesemente la motivazione al suo studio medico.",

  error_empty: "Inserisca almeno una voce o un testo della fattura.",
  error_tooLong: "Il testo inserito è troppo lungo. Lo riduca alle voci di fatturazione.",
  error_tooManyRows: "Ha inserito troppe voci. Riduca il numero.",
  error_rateLimited: "Troppe richieste in poco tempo. Riprovi tra qualche minuto.",
  error_personalData:
    "Rimuova i dati personali come nomi, date di nascita o diagnosi. Sono sufficienti i dati di fatturazione.",
  error_generic: "Al momento non ha funzionato. Riprovi.",

  draftPractice_subject: "Domanda sulla mia fattura [numero fattura], [data fattura]",
  draftPractice_body:
    "Gentile team dello studio,\n\ngrazie per la vostra fattura. Vorrei comprenderla un po’ meglio e ho una breve domanda:\n\n- Gradirei una breve spiegazione della/e voce/i [codice/i].\n- Per [codice] è indicato un fattore di [fattore]: potreste indicarmi brevemente la relativa motivazione?\n\nIl mio unico scopo è capire meglio. Grazie per il vostro aiuto.\n\nCordiali saluti,\n[Nome]",
  draftInsurer_subject: "Domanda sul rimborso – fattura [numero fattura], [data fattura]",
  draftInsurer_body:
    "Spettabile assicurazione,\n\nin merito alla fattura medica allegata, ho una domanda sul rimborso:\n\n- Potete confermarmi se la/e voce/i [codice/i] sono rimborsabili nell’ambito della mia polizza?\n- Se mancano informazioni per l’elaborazione, vi prego di comunicarmelo.\n\nGrazie per la vostra cortese risposta.\n\nCordiali saluti,\n[Nome], numero assicurato: [numero]",

  entryCardTitle: "Capire la fattura",
  entryCardSubtitle: "Fattura privata (GOÄ/PKV) spiegata in modo semplice – a titolo orientativo",
  backToDocuments: "Torna ai documenti dello studio",
};
