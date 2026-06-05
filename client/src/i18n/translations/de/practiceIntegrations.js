export default {
  pageTitle: "MedScoutX — Integrationen",
  sandboxPageTitle: "MedScoutX — Integrations-Sandbox",
  heading: "Integrationen (PVS / FHIR / HL7)",
  sandboxHeading: "Integrations-Sandbox",
  intro:
    "Modulare Anbindungsschicht für spätere PVS-/FHIR-/HL7-Schnittstellen. Im MVP nur Test- und Sandbox-Modus — keine produktive automatische Synchronisation.",
  sandboxIntro:
    "Sandbox-Modus: Es werden keine echten Daten an externe Systeme übertragen.",
  backHub: "Zur Praxis-Übersicht",
  backIntegrations: "Zurück zu Integrationen",
  selectPractice: "Praxisprofil",
  loading: "Integrationen werden geladen …",
  loadError: "Integrationen konnten nicht geladen werden.",
  featureDisabled: "Integrationsfunktionen sind derzeit deaktiviert.",
  forbidden: "Nur Inhaber:innen und Administrator:innen haben Zugriff.",

  sectionStatus: "Integrationsstatus",
  sectionConnectors: "Verfügbare Connectoren",
  sectionConnections: "Verbindungen",
  sectionJobs: "Import-/Export-Jobs",
  sectionMappings: "Mapping-Übersicht",
  sectionSecurity: "Sicherheit & Consent",
  sectionSandbox: "Sandbox-Test",

  flagIntegrations: "Integrationen (Master)",
  flagFhir: "FHIR",
  flagHl7: "HL7 v2",
  flagSandbox: "PVS-Sandbox",
  flagProduction: "Produktion (aus)",
  statusOn: "aktiv",
  statusOff: "aus",

  connectionStatus: "Status",
  connectionType: "Typ",
  connectorKey: "Connector",
  vendorName: "Anbieter",
  noConnections: "Noch keine Verbindung konfiguriert.",
  noJobs: "Noch keine Jobs ausgeführt.",

  btnTestIntegration: "Integration testen",
  btnOpenSandbox: "Sandbox öffnen",
  btnViewMapping: "Mapping anzeigen",
  btnDisableConnection: "Verbindung deaktivieren",
  btnCreateSandbox: "Sandbox-Verbindung anlegen",
  btnRunTestJob: "Test-Job starten",
  btnFhirPreview: "FHIR-Vorschau (Sandbox)",
  btnHl7Parse: "HL7 testen",
  testing: "Test läuft …",
  testOk: "Verbindungstest erfolgreich (Sandbox).",
  testFailed: "Verbindungstest fehlgeschlagen.",
  disabled: "Verbindung deaktiviert.",
  jobStarted: "Job abgeschlossen.",

  securityNote:
    "Exporte erfordern eine aktive Patient:innenbeziehung und Zustimmung zum Datenexport. Keine Tokens oder API-Keys im Browser. Produktive PVS-Anbindung nur nach Vendor-Vertrag, Testsystem, AV-Vertrag und Sicherheitsprüfung.",
  consentNote:
    "Ohne passende Zustimmung werden Exporte blockiert und protokolliert.",
  productionWarning:
    "Produktive Synchronisation ist standardmäßig deaktiviert (ENABLE_PVS_PRODUCTION=false).",

  aiMarkedDe: "KI-Hinweis – bitte prüfen",
  aiMarkedEn: "AI note – please review",
  aiDisclaimer:
    "Die KI unterstützt nur bei technischer und organisatorischer Erklärung der Integration. Sie interpretiert keine medizinischen Inhalte.",
  btnAiMapping: "Mapping erklären (KI)",
  btnAiError: "Fehler erklären (KI)",
  aiLoading: "KI-Antwort wird erstellt …",

  mappingPreview: "Mapping-Vorschau",
  sandboxSamples: "Beispieldaten",
  hl7Result: "HL7-Parse-Ergebnis",
  fhirResult: "FHIR-Vorschau",

  jobType: "Job-Typ",
  jobStatus: "Status",
  jobDirection: "Richtung",
  jobCreated: "Erstellt",

  sectionVendors: "Verfügbare PVS-Systeme",
  vendorCatalogueNote:
    "Die Aktivierung erfordert einen Vendor-Vertrag, ein Testsystem und eine Sicherheitsprüfung. Keine dieser Anbindungen ist derzeit produktiv verfügbar.",
  vendorStatusComingSoon: "Geplant",
  vendorStatusSandboxReady: "Sandbox bereit",
  vendorStatusActive: "Aktiv",
  vendorTypePvs: "PVS",
  btnExpressInterest: "Interesse bekunden",

  errors: {
    integrations_disabled: "Integrationen sind deaktiviert.",
    integration_consent_missing:
      "Für diese Integration fehlt die erforderliche Zustimmung.",
    sandbox_disabled: "Sandbox ist deaktiviert.",
    forbidden: "Keine Berechtigung.",
    feature_disabled: "Funktion deaktiviert.",
    production_sync_disabled: "Produktive Synchronisation ist nicht freigeschaltet.",
    auto_sync_disabled: "Automatische Synchronisation ist im MVP deaktiviert.",
    ai_not_configured: "KI ist nicht konfiguriert.",
  },
};
