/** Sections 1–7 — merged in datenschutz.js */
export default [
  {
    id: "ds-1-verantwortlich",
    heading: "1. Verantwortlicher",
    blocks: [
      {
        type: "p",
        text:
          "Diese Datenschutzerklärung informiert dich darüber, wie die App MedScoutX personenbezogene Daten verarbeitet.",
      },
      {
        type: "address",
        lineStrong: "Verantwortlich im Sinne der DSGVO",
        lines: [
          "Himan Khorshidi",
          "Eisenstraße 64",
          "40227 Düsseldorf, Deutschland",
        ],
      },
      {
        type: "dl",
        items: [
          { dt: "E-Mail", dd: "himankhorshidy@gmail.com", href: "mailto:privacy@medscout.app" },
          { dt: "Telefon", dd: "+49 211 15895272", href: "tel:+4921115895272" },
        ],
      },
    ],
  },
  {
    id: "ds-2-worum",
    heading: "2. Worum geht es?",
    blocks: [
      {
        type: "p",
        text:
          "Diese Erklärung beschreibt, wie MedScoutX deine personenbezogenen Daten verarbeitet, wenn du:",
      },
      {
        type: "ul",
        items: [
          "die App installierst und ein Konto anlegst,",
          "Informationen für ein Arztgespräch strukturiert erfasst und optional als PDF vorbereitest,",
          "Symptome über den Text-Chat eingibst,",
          "Körperregionen über die Body-Map auswählst,",
          "Bilder (z. B. Hautfotos oder medizinische Aufnahmen) hochlädst.",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX ist kein Diagnose- oder Behandlungswerkzeug und ersetzt keine ärztliche Untersuchung oder Beratung. Die Anwendung unterstützt bei der strukturierten Vorbereitung und Dokumentation deiner eigenen Angaben vor medizinischen Terminen. Wenn du eine PDF rein lokal erzeugst und dabei keine Übertragung erfolgt, gelten die dort beschriebenen besonderen Hinweise.",
      },
    ],
  },
  {
    id: "ds-3-kategorien",
    heading: "3. Kategorien personenbezogener Daten",
    blocks: [
      {
        type: "p",
        text:
          "Je nach Nutzung der App können die folgenden Kategorien von personenbezogenen Daten verarbeitet werden:",
      },
      {
        type: "ul",
        items: [
          "Kontodaten: E-Mail-Adresse, ggf. Name oder Benutzername, Passwort-Hash (kein Klartext-Passwort), Spracheinstellung.",
          "Gesundheitsbezogene Daten: Texteingaben zu Symptomen, Antworten im Symptomchat, Auswahl von Körperregionen auf der Body-Map, Gesundheitsangaben in Freitextfeldern.",
          "Bilddaten: von dir hochgeladene Bilder (z. B. Hautveränderungen, Fotos von Körperregionen oder anderen gesundheitlich relevanten Bereichen). MedScoutX nutzt diese Bilder, um Auffälligkeiten zu beschreiben, jedoch nicht zur eigenständigen medizinischen Diagnostik.",
          "Nutzungs- und Protokolldaten: Zeitstempel von Anfragen, technische Fehler-Logs, ggf. gekürzte IP-Adresse, Browser-/Geräteinformationen, Betriebssystem, verwendete App-Version.",
          "Abo- und Vertragsdaten (falls du ein kostenpflichtiges Abo nutzt): gebuchter Tarif, Laufzeit, Status des Abos, technische Informationen zum Kauf (über App Store/Play Store). Vollständige Zahlungsdaten (z. B. Kreditkartennummern) werden nicht von MedScoutX gespeichert, sondern vom jeweiligen Zahlungsdienst der Plattform verarbeitet.",
          "Lokale Daten auf deinem Gerät: z. B. lokal gespeicherter Chatverlauf oder Einstellungen (z. B. Sprache, Barrierefreiheitsoptionen) im LocalStorage oder vergleichbaren Speichermechanismen.",
        ],
      },
    ],
  },
  {
    id: "ds-4-zwecke",
    heading: "4. Zwecke der Verarbeitung",
    blocks: [
      {
        type: "ul",
        items: [
          "Bereitstellung der App-Funktionen: Login, Registrierung, Kontoverwaltung und Grundfunktionen von MedScoutX.",
          "Symptomchat & KI-gestützte Rückfragen: Verarbeitung deiner Texteingaben, um dir Fragen und Hinweise zur weiteren Abklärung zu geben.",
          "Body-Map: Zuordnung deiner ausgewählten Körperregionen zu geeigneten KI-Rückfragen und Hinweisen.",
          "Bildanalyse: Verarbeitung deiner hochgeladenen Bilder, um Auffälligkeiten zu beschreiben und mögliche Handlungsoptionen vorzuschlagen (z. B. ärztlich abklären lassen). Es erfolgt keine automatische Diagnose im medizinisch-rechtlichen Sinne.",
          "Stabilität & Sicherheit: Fehleranalyse, Missbrauchserkennung, Schutz der Systeme und Daten.",
          "Rechtliche Anforderungen: Erfüllung gesetzlicher Pflichten (z. B. Nachweis von IT-Sicherheitsmaßnahmen, Speicherfristen).",
        ],
      },
    ],
  },
  {
    id: "ds-5-rechtsgrundlagen",
    heading: "5. Rechtsgrundlagen (DSGVO)",
    blocks: [
      {
        type: "p",
        text:
          "Je nach Nutzung stützen wir die Verarbeitung deiner Daten auf folgende Rechtsgrundlagen:",
      },
      {
        type: "ul",
        items: [
          "Art. 6 Abs. 1 lit. b DSGVO – Vertragserfüllung: Für die Bereitstellung der technischen App-Funktionen, wie Registrierung, Login und Verwaltung deines Nutzerkontos.",
          "Art. 6 Abs. 1 lit. f DSGVO – berechtigtes Interesse: Zur Gewährleistung der Sicherheit der IT-Systeme, Fehleranalyse und Missbrauchserkennung.",
          "Art. 6 Abs. 1 lit. c DSGVO – rechtliche Verpflichtung: Soweit gesetzliche Pflichten zur Aufbewahrung bestimmter Daten bestehen (z. B. steuerrechtliche Pflichten im Zusammenhang mit Abonnements).",
          "Art. 9 Abs. 2 lit. a DSGVO – ausdrückliche Einwilligung: Dies ist die maßgebliche Rechtsgrundlage für die Verarbeitung deiner Gesundheitsdaten. Dazu zählen alle von dir freiwillig eingegebenen Symptome im Text-Chat, die Auswahl von Körperregionen in der Body-Map sowie das Hochladen und die Analyse von Bildern. Vor der ersten Nutzung dieser Funktionen wirst du explizit um deine Einwilligung gebeten (z. B. durch eine Checkbox und Bestätigungsschaltfläche). Du kannst diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen.",
        ],
      },
    ],
  },
  {
    id: "ds-6-auftragsverarbeiter",
    heading: "6. Auftragsverarbeiter & Weitergabe an Dritte",
    blocks: [
      {
        type: "p",
        text:
          "Für bestimmte Funktionen setzt MedScoutX Dienstleister als Auftragsverarbeiter nach Art. 28 DSGVO ein. Die wichtigsten Kategorien sind:",
      },
      {
        type: "ul",
        items: [
          "Hosting-Anbieter (EU): Ein europäischer Cloud-Anbieter stellt die Infrastruktur für Server und Datenbank bereit (z. B. Render.com mit EU-Standort).",
          "KI-Dienstleister – OpenAI (USA): Für die KI-basierte Verarbeitung deiner Texteingaben, Bilddaten und Body-Map-Angaben nutzt MedScoutX Dienste der OpenAI LLC (San Francisco, USA). Dabei werden die Inhalte verschlüsselt an OpenAI übermittelt, dort maschinell verarbeitet und nach der Verarbeitung gelöscht.",
          "E-Mail-Dienstleister: Für die Zustellung von System-E-Mails (z. B. Verifizierungs-E-Mails) wird ein technischer Dienstleister eingesetzt.",
        ],
      },
      {
        type: "p",
        text:
          "Alle Dienstleister wurden nach Art. 28 DSGVO vertraglich verpflichtet und verarbeiten Daten ausschließlich nach unserer Weisung. Es erfolgt keine Weitergabe deiner Daten zu Werbe- oder Marketingzwecken.",
      },
    ],
  },
  {
    id: "ds-7-drittland",
    heading: "7. Drittlandtransfer",
    blocks: [
      {
        type: "p",
        text:
          "Bei der Nutzung der KI-Funktionen von MedScoutX werden Inhalte (z. B. Texte, Symptome, Bilddaten) an den KI-Dienstleister OpenAI LLC in den USA übertragen. Ein solcher Transfer stellt ein Drittlandtransfer im Sinne der DSGVO dar.",
      },
      {
        type: "p",
        text:
          "Um ein angemessenes Datenschutzniveau sicherzustellen, erfolgt die Übermittlung auf Grundlage der EU-Standardvertragsklauseln (Art. 46 DSGVO) sowie zusätzlicher technischer und organisatorischer Maßnahmen (Verschlüsselung während der Übermittlung, kurze Verarbeitungsdauer, Löschung der Daten nach der Beantwortung durch den KI-Dienst).",
      },
      {
        type: "p_link",
        before: "Weitere Informationen findest du in der Datenschutzdokumentation von OpenAI: ",
        href: "https://openai.com/policies/privacy-policy",
        linkText: "https://openai.com/policies/privacy-policy",
        after: "",
      },
    ],
  },
];
