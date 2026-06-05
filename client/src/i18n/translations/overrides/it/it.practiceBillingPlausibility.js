/**
 * Italian translations — billing plausibility module + vendor catalogue keys.
 * Disclaimer meaning must remain consistent: automated hint only, not legally binding,
 * not medical advice, not a final reimbursement decision.
 */
export const itPracticeBillingPlausibility = {
  pageTitle: "MedScoutX — Plausibilità fatturazione GOÄ/PKV",
  heading: "Plausibilità di fatturazione (GOÄ / PKV)",
  backHub: "Panoramica dello studio",
  selectPractice: "Profilo dello studio",
  loading: "Caricamento …",
  submitting: "Verifica in corso …",
  intro:
    "Verifica automatizzata della plausibilità dei codici GOÄ. Identifica potenziali lacune documentali e combinazioni inusuali. Non sostituisce una decisione di fatturazione vincolante.",
  disclaimer:
    "Avviso: Questo strumento fornisce esclusivamente indicazioni automatizzate di plausibilità. Non costituisce un parere di fatturazione giuridicamente vincolante, né un consiglio medico, né una decisione definitiva di rimborso. Non sostituisce il controllo umano da parte di personale di fatturazione qualificato.",

  btnNewReview: "Avvia una nuova verifica",
  labelZiffer: "Codice GOÄ",
  labelFactor: "Fattore",
  labelCount: "Quantità",
  labelContext: "Contesto (opzionale)",
  contextPlaceholder:
    "Breve nota sulla prestazione — nessun dato del paziente, nessuna diagnosi, nessuna informazione clinica.",

  btnSubmit: "Verifica plausibilità",
  btnAddRow: "Aggiungi riga",
  btnRemoveRow: "Rimuovi riga",

  statusPending: "In attesa",
  statusReviewed: "Verificato",
  statusDismissed: "Archiviato",

  sectionResult: "Risultato",
  sectionHistory: "Cronologia",

  noReviews: "Nessuna verifica ancora. Avvia la prima verifica.",
  aiUnavailable:
    "Verifica automatica temporaneamente non disponibile. Verificare manualmente.",

  colDate: "Data",
  colZiffernCount: "Codici",
  colStatus: "Stato",

  flagLabel: "Nota",

  loadError: "Impossibile caricare le verifiche.",
  submitError: "Impossibile inviare la richiesta.",
  aiMarked: "Indicazione di plausibilità (non vincolante)",

  resultStub:
    "Richiesta di verifica salvata. Le indicazioni di plausibilità sono elencate di seguito.",

  sectionItems: "Codici verificati",
  catalogueFound: "Trovato nel sottoinsieme locale del catalogo",
  catalogueNotFound: "Non trovato nel sottoinsieme locale — verifica manuale consigliata",
  noWarnings: "Nessuna indicazione per questo codice.",
  itemWarningsLabel: "Indicazioni",

  warnings: {
    unknown_goae_ziffer:
      "Codice GOÄ non trovato nel catalogo di test locale — verifica manuale necessaria.",
    factor_requires_justification:
      "Fattore superiore a 2,3 — potrebbe essere richiesta una giustificazione scritta (§ 5 GOÄ).",
    justification_missing:
      "Fattore elevato senza testo di giustificazione — si consiglia di documentare il motivo.",
    invalid_factor: "Valore del fattore non valido.",
    invalid_count: "Valore della quantità non valido.",
  },

  featureDisabled: "Questo modulo non è ancora attivo.",
  forbidden: "Solo i titolari e gli amministratori hanno accesso.",

  errors: {
    rows_required: "È richiesto almeno un codice GOÄ.",
    ziffer_required: "Codice mancante nella riga {{rowIndex}}.",
    factor_required: "Fattore mancante nella riga {{rowIndex}}.",
    count_required: "Quantità mancante nella riga {{rowIndex}}.",
    patient_data_not_accepted:
      "Questo modulo non accetta dati del paziente. Si prega di inviare solo codici GOÄ e fattori.",
    feature_disabled: "Funzione disattivata.",
    forbidden: "Accesso negato.",
    practice_not_found: "Studio non trovato.",
  },
};

/** Vendor catalogue keys for practiceIntegrations namespace (Italian). */
export const itPracticeIntegrationsVendors = {
  sectionVendors: "Sistemi PVS disponibili",
  vendorCatalogueNote:
    "L'attivazione richiede un contratto con il fornitore, un sistema di test e una revisione della sicurezza. Nessuno di questi connettori è attualmente disponibile in produzione.",
  vendorStatusComingSoon: "Prossimamente",
  vendorStatusSandboxReady: "Sandbox pronto",
  vendorStatusActive: "Attivo",
  vendorTypePvs: "PVS",
  btnExpressInterest: "Esprimi interesse",
};
