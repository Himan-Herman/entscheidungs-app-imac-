// Patient-facing "Rechnung verstehen" (GOÄ/PKV invoice explainer) — German.
// Non-binding guidance only. No legal advice, no final invoice review, no medical assessment.
const patientBillingExplain = {
  title: "Rechnung verstehen",
  subtitle: "Privatrechnung (GOÄ/PKV) verständlich erklärt – unverbindlich",
  shortDescription:
    "Diese Funktion hilft Ihnen, eine private Arztrechnung (GOÄ/PKV) besser zu verstehen. Sie geben die Angaben Ihrer Rechnung selbst ein, und wir erklären die enthaltenen Positionen in verständlicher Sprache und weisen auf mögliche Rückfragen hin. Es handelt sich um eine unverbindliche Orientierung, nicht um eine Prüfung Ihrer Rechnung.",

  disclaimerBanner:
    "Unverbindliche Orientierung. Diese Funktion erklärt Ihre Angaben in verständlicher Form und nennt mögliche Rückfragen. Sie ist keine Rechtsberatung, keine abschließende Rechnungsprüfung und keine medizinische Auskunft. Bei Unsicherheit wenden Sie sich bitte an Ihre Praxis, Ihre private Krankenversicherung oder eine fachkundige Beratung.",
  privacyNote:
    "Ihre Eingaben werden nicht dauerhaft gespeichert und nur zur aktuellen Erklärung verarbeitet. Bitte geben Sie keine Namen, Geburtsdaten oder Diagnosen ein – die Abrechnungsangaben (Ziffer, Faktor, Anzahl, Betrag) oder der reine Rechnungstext genügen.",
  resultNote:
    "Die folgende Erklärung bezieht sich ausschließlich auf Ihre Eingaben. Sie ist eine unverbindliche Orientierung und keine Bewertung, ob Ihre Rechnung richtig oder vollständig ist. Offene Punkte können Sie mit den Entwürfen unten höflich bei Ihrer Praxis oder Ihrer privaten Krankenversicherung erfragen.",
  footerNote:
    "Unverbindliche Orientierung – keine Rechtsberatung und keine abschließende Rechnungsprüfung. Bei Unsicherheit kontaktieren Sie bitte Ihre Praxis, Ihre private Krankenversicherung oder eine fachkundige Beratung.",

  inputModeFields: "Felder ausfüllen",
  inputModeText: "Rechnungstext einfügen",

  fieldZiffer: "GOÄ-Ziffer",
  fieldZifferPlaceholder: "z. B. 1, 3, 250",
  fieldFactor: "Steigerungsfaktor",
  fieldFactorPlaceholder: "z. B. 2,3",
  fieldCount: "Anzahl",
  fieldCountPlaceholder: "z. B. 1",
  fieldAmount: "Betrag (optional)",
  fieldAmountPlaceholder: "z. B. 21,45 €",
  fieldNote: "Eigene Notiz (optional)",
  fieldNotePlaceholder: "z. B. Hinweis aus der Rechnung",
  pasteInvoiceLabel: "Rechnungstext einfügen",
  pasteInvoicePlaceholder:
    "Positionen aus der Rechnung hier einfügen – bitte ohne Namen, Geburtsdaten oder Diagnosen",

  btnExplain: "Angaben erklären",
  btnAddRow: "Weitere Position hinzufügen",
  btnReset: "Eingaben zurücksetzen",
  btnDraftPractice: "Rückfrage an die Praxis erstellen",
  btnDraftInsurer: "Rückfrage an die PKV erstellen",
  btnCopy: "Text kopieren",
  btnCopied: "Kopiert",

  resultHeading: "Erklärung Ihrer Angaben",
  catalogUnknownLabel: "Nicht in der Übersicht",
  result_noFindings:
    "Auf Basis Ihrer Eingaben sind keine offensichtlichen Rückfrage-Punkte aufgefallen. Dies ist eine unverbindliche Orientierung und keine Bestätigung, dass die Rechnung richtig oder vollständig ist. Bei Fragen hilft Ihnen Ihre Praxis oder Ihre private Krankenversicherung gern weiter.",

  warn_unknown_goae_ziffer:
    "Diese Ziffer ist in unserer hinterlegten Übersicht nicht enthalten. Das bedeutet nicht, dass sie unzutreffend ist – sie lässt sich hier nur nicht automatisch erklären. Sie können sie bei Ihrer Praxis erfragen oder anhand des offiziellen GOÄ-Texts nachvollziehen.",
  warn_invalid_factor:
    "Der Faktor zu dieser Position konnte nicht gelesen werden. Bitte prüfen Sie die Eingabe (Zahl, z. B. 2,3).",
  warn_invalid_count:
    "Die Anzahl zu dieser Position konnte nicht gelesen werden. Bitte prüfen Sie die Eingabe (ganze Zahl ab 1).",
  warn_factor_requires_justification:
    "Der angegebene Faktor liegt über dem üblichen Regelhöchstwert (2,3). Ein höherer Faktor ist möglich und häufig mit einer kurzen Begründung verbunden. Dies ist ein möglicher Punkt für eine Rückfrage – keine Aussage über die Richtigkeit.",
  warn_justification_missing:
    "Zu diesem höheren Faktor ist in Ihren Angaben keine Begründung hinterlegt. Sie können bei Ihrer Praxis höflich nach der Begründung fragen.",

  error_empty: "Bitte geben Sie mindestens eine Position oder einen Rechnungstext ein.",
  error_tooLong: "Der eingegebene Text ist zu lang. Bitte kürzen Sie ihn auf die Abrechnungspositionen.",
  error_tooManyRows: "Es wurden zu viele Positionen eingegeben. Bitte reduzieren Sie die Anzahl.",
  error_rateLimited: "Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es in einigen Minuten erneut.",
  error_personalData:
    "Bitte entfernen Sie persönliche Angaben wie Namen, Geburtsdaten oder Diagnosen. Die Abrechnungsangaben genügen.",
  error_generic: "Das hat gerade nicht funktioniert. Bitte versuchen Sie es erneut.",

  draftPractice_subject: "Rückfrage zu meiner Rechnung [Rechnungsnummer], [Rechnungsdatum]",
  draftPractice_body:
    "Sehr geehrtes Praxisteam,\n\nvielen Dank für Ihre Rechnung. Ich möchte sie gern besser nachvollziehen und habe dazu eine kurze Rückfrage:\n\n- Zu Position(en) [Ziffer(n)] würde ich mich über eine kurze Erläuterung freuen.\n- Bei [Ziffer] ist ein Faktor von [Faktor] angegeben – könnten Sie mir die zugehörige Begründung kurz mitteilen?\n\nEs geht mir nur um ein besseres Verständnis. Vielen Dank für Ihre Unterstützung.\n\nMit freundlichen Grüßen\n[Name]",
  draftInsurer_subject: "Frage zur Erstattung – Rechnung [Rechnungsnummer], [Rechnungsdatum]",
  draftInsurer_body:
    "Sehr geehrte Damen und Herren,\n\nzur beigefügten Arztrechnung habe ich eine Verständnisfrage zur Erstattung:\n\n- Können Sie mir bestätigen, ob die Position(en) [Ziffer(n)] im Rahmen meines Tarifs erstattungsfähig sind?\n- Falls für die Bearbeitung Angaben fehlen, lassen Sie es mich bitte wissen.\n\nVielen Dank für Ihre Auskunft.\n\nMit freundlichen Grüßen\n[Name], Versichertennummer: [Nummer]",

  // Entry point label shown on the practice-documents page.
  entryCardTitle: "Rechnung verstehen",
  entryCardSubtitle: "Privatrechnung (GOÄ/PKV) verständlich erklärt – unverbindlich",
  backToDocuments: "Zurück zu den Praxisdokumenten",
};

export default patientBillingExplain;
