// Public Messe / DemoDay showcase ("/demo"). Sample-data only — no real data, no API.
const publicDemo = {
  pageTitle: "MedScoutX — Messe-Demo",
  badge: "Messe-Demo · Beispieldaten",
  entryButton: "Messe-Demo ansehen",

  heading: "MedScoutX in der Übersicht",
  sub: "Klicken Sie sich durch eine sichere Demo mit Beispieldaten — ganz ohne Anmeldung. Alle Inhalte sind erfunden und dienen nur der Veranschaulichung.",

  bannerTitle: "Dies ist eine Demo mit Beispieldaten.",
  bannerBody:
    "Es werden keine echten Patienten- oder Praxisdaten angezeigt. Für die echte Anwendung mit Ihren Daten melden Sie sich bitte regulär an.",

  backToSite: "Zur Startseite",
  loginCta: "Zur Anmeldung",

  sectionPatient: "Für Patient:innen",
  sectionPatientSub: "Was Versicherte in MedScoutX sehen und verwalten können.",
  sectionPractice: "Für Praxen",
  sectionPracticeSub: "Wie Praxisteams mit MedScoutX arbeiten.",

  openLabel: "Beispiel ansehen",
  modalClose: "Schließen",
  sampleNote: "Beispieldaten — nur zur Veranschaulichung.",

  badges: {
    ok: "Aktuell",
    pending: "Offen",
    info: "Info",
    done: "Erledigt",
    scheduled: "Geplant",
    review: "Prüfen",
  },

  tiles: {
    // Patient
    appointments: {
      label: "Termine",
      sub: "Anstehende Termine im Blick",
      detail: "Anstehende und angefragte Termine — übersichtlich an einem Ort.",
    },
    messages: {
      label: "Nachrichten",
      sub: "Sicherer Austausch mit der Praxis",
      detail: "Nachrichten zwischen Patient:in und Praxis, wenn eine Verbindung besteht.",
    },
    medication: {
      label: "Medikationsplan",
      sub: "Aktuelle Medikamente",
      detail: "Der aktuelle Medikationsplan mit Dosierung und Einnahmehinweisen.",
    },
    documents: {
      label: "Befunde & Dokumente",
      sub: "Unterlagen sicher abgelegt",
      detail: "Von der Praxis geteilte Befunde und persönliche Dokumente.",
    },
    vitals: {
      label: "Vitalwerte",
      sub: "Blutdruck, Puls & mehr",
      detail: "Selbst erfasste Vitalwerte im zeitlichen Verlauf.",
    },
    vaccinations: {
      label: "Impfpass",
      sub: "Impfungen & Auffrischungen",
      detail: "Digitaler Überblick über Impfungen und anstehende Auffrischungen.",
    },

    // Practice
    patients: {
      label: "Patient:innen",
      sub: "Verknüpfte Personen",
      detail: "Mit der Praxis verknüpfte Personen — nur mit aktiver Einwilligung.",
    },
    booking: {
      label: "Termine & Anfragen",
      sub: "Anfragen bearbeiten",
      detail: "Eingehende Terminanfragen annehmen, planen und bestätigen.",
    },
    anamnesis: {
      label: "Anamnese",
      sub: "Vorlagen & Einreichungen",
      detail: "Anamnese-Vorlagen erstellen und eingegangene Antworten sichten.",
    },
    billing: {
      label: "GOÄ / PKV-Prüfung",
      sub: "Plausibilität prüfen",
      detail: "Deterministische Katalog-Prüfung von Abrechnungspositionen — unverbindlich.",
    },
    telemedicine: {
      label: "Videosprechstunde",
      sub: "Termine per Video",
      detail: "Videosprechstunden planen und durchführen.",
    },
    activity: {
      label: "Aktivität",
      sub: "Letzte Vorgänge",
      detail: "Nachvollziehbare Übersicht der letzten Vorgänge im Team.",
    },
  },
};

export default publicDemo;
