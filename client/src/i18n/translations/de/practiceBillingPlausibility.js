export default {
  pageTitle: "MedScoutX — GOÄ/PKV Plausibilität",
  heading: "Abrechnungsplausibilität (GOÄ / PKV)",
  intro:
    "Automatisierte Plausibilitätsprüfung für GOÄ-Leistungsziffern. Identifiziert mögliche Dokumentationslücken und ungewöhnliche Kombinationen. Ersetzt keine rechtsverbindliche Abrechnungsprüfung.",
  backHub: "Zur Praxis-Übersicht",
  selectPractice: "Praxisprofil",
  loading: "Wird geladen …",
  submitting: "Wird geprüft …",
  disclaimer:
    "Hinweis: Dieses Werkzeug liefert ausschließlich automatisierte Plausibilitätshinweise. Es handelt sich weder um ein rechtsverbindliches Abrechnungsgutachten noch um einen medizinischen Rat noch um eine Entscheidungsgrundlage für die Abrechnung. Die Prüfung ersetzt keine menschliche Kontrolle durch geschultes Abrechnungspersonal.",

  btnNewReview: "Neue Prüfung starten",
  labelZiffer: "GOÄ-Ziffer",
  labelFactor: "Faktor",
  labelCount: "Anzahl",
  labelContext: "Kontext (optional)",
  contextPlaceholder:
    "Kurzer Hinweis zur Leistung — keine Patientendaten, keine Diagnose, keine klinischen Informationen.",

  btnSubmit: "Plausibilität prüfen",
  btnAddRow: "Zeile hinzufügen",
  btnRemoveRow: "Zeile entfernen",

  statusPending: "Ausstehend",
  statusReviewed: "Geprüft",
  statusDismissed: "Abgelegt",

  sectionResult: "Ergebnis",
  sectionHistory: "Verlauf",

  noReviews: "Noch keine Prüfungen vorhanden. Erste Prüfung starten.",
  aiUnavailable:
    "Automatische Prüfung derzeit nicht verfügbar. Bitte manuell prüfen.",

  colDate: "Datum",
  colZiffernCount: "Ziffern",
  colStatus: "Status",

  flagLabel: "Hinweis",

  loadError: "Prüfungen konnten nicht geladen werden.",
  submitError: "Anfrage konnte nicht gesendet werden.",
  aiMarked: "KI-Plausibilitätshinweis (nicht rechtsverbindlich)",

  resultStub:
    "Prüfungsanfrage gespeichert. Die Plausibilitätshinweise sind unten aufgeführt.",

  sectionItems: "Geprüfte Ziffern",
  catalogueFound: "In lokalem Teilkatalog gefunden",
  catalogueNotFound: "Nicht im lokalen Teilkatalog — manuelle Prüfung empfohlen",
  noWarnings: "Keine Hinweise für diese Ziffer.",
  itemWarningsLabel: "Hinweise",

  warnings: {
    unknown_goae_ziffer:
      "GOÄ-Ziffer im lokalen Testkatalog nicht gefunden — manuelle Verifikation erforderlich.",
    factor_requires_justification:
      "Faktor über 2,3 — schriftliche Begründung gemäß § 5 GOÄ kann erforderlich sein.",
    justification_missing:
      "Hoher Faktor ohne Begründungstext — Begründung in der Dokumentation empfohlen.",
    invalid_factor: "Ungültiger Faktorwert.",
    invalid_count: "Ungültige Anzahl.",
  },

  btnAiReview: "KI-Plausibilitätshinweis anfordern",
  aiReviewPending: "KI-Hinweis wird angefordert …",
  aiReviewLabel: "KI-Plausibilitätshinweis / nicht rechtsverbindlich",
  aiReviewNonBinding: "Dieser Hinweis ist nicht rechtsverbindlich, keine Diagnose und keine Erstattungsentscheidung.",
  aiReviewFallback: "KI-Hinweis derzeit nicht verfügbar. Die deterministischen Prüfergebnisse oben sind weiterhin gültig.",
  aiReviewUnavailable: "KI-Plausibilitätsprüfung ist nicht aktiviert.",
  aiReviewError: "KI-Hinweis konnte nicht angefordert werden.",
  aiReviewSuccess: "KI-Plausibilitätshinweis erhalten.",
  aiReviewGeneralNote: "Allgemeiner Hinweis",
  aiReviewUncertaintyNote: "Unsicherheitshinweis",
  aiReviewRowHints: "Zifferhinweise",

  manualReviewRecommended: "Manuelle Prüfung durch qualifiziertes Abrechnungspersonal wird empfohlen.",

  featureDisabled: "Dieses Modul ist derzeit nicht aktiviert.",
  forbidden: "Nur Inhaber:innen und Administrator:innen haben Zugriff.",

  errors: {
    rows_required: "Mindestens eine GOÄ-Ziffer ist erforderlich.",
    ziffer_required: "Ziffer fehlt in Zeile {{rowIndex}}.",
    factor_required: "Faktor fehlt in Zeile {{rowIndex}}.",
    count_required: "Anzahl fehlt in Zeile {{rowIndex}}.",
    patient_data_not_accepted:
      "Dieses Formular akzeptiert keine Patientendaten. Bitte nur GOÄ-Ziffern und Faktoren übermitteln.",
    feature_disabled: "Funktion deaktiviert.",
    forbidden: "Keine Berechtigung.",
    practice_not_found: "Praxis nicht gefunden.",
  },
};
