/** Sections 8–15 — merged in datenschutz.js */
export default [
  {
    id: "ds-8-speicherfristen",
    heading: "8. Speicherfristen",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX speichert grundsätzlich keine Chatverläufe, keine Symptome und keine Bilder dauerhaft auf dem Server. Alle gesundheitsbezogenen Inhalte werden ausschließlich lokal auf deinem Gerät gespeichert (z. B. im LocalStorage) und können jederzeit gelöscht werden.",
      },
      {
        type: "ul",
        items: [
          "Kontodaten: E-Mail-Adresse, Passwort-Hash und Spracheinstellung werden für die Dauer deines Nutzerkontos gespeichert. Nach Löschung des Kontos werden diese Daten gelöscht oder anonymisiert, sofern keine gesetzlichen Pflichten bestehen.",
          "Chat- und Symptomdaten: werden nicht auf dem Server gespeichert. Sie verbleiben ausschließlich auf deinem Gerät und werden vollständig gelöscht, sobald du „Neue Unterhaltung“ oder „Verlauf löschen“ verwendest.",
          "Bild-Uploads: werden nur kurzzeitig verarbeitet, um sie zur Verarbeitung weiterzuleiten. Danach werden sie verworfen. Eine dauerhafte Speicherung erfolgt nicht.",
          "Technische Protokolle / Server-Logs: Für Betrieb, Sicherheit und Fehleranalyse speichern Hosting-Dienste automatisch technische Protokolle (z. B. Zeitpunkt, IP-Adresse in gekürzter Form, Fehlerdetails) für gewöhnlich 14–30 Tage. Diese Daten werden nicht mit deinem Profil oder deinen Inhalten verknüpft und nicht zu Werbezwecken genutzt.",
          "Lokale Daten (LocalStorage, App-Speicher): Chatverläufe, Einstellungen (z. B. Sprache, Barrierefreiheit) und Verlaufseinträge werden ausschließlich auf deinem Gerät gespeichert und können jederzeit über „Verlauf löschen“ oder Geräteeinstellungen entfernt werden.",
        ],
      },
    ],
  },
  {
    id: "ds-9-sicherheit",
    heading: "9. Sicherheit",
    blocks: [
      {
        type: "p",
        text:
          "Wir setzen angemessene technische und organisatorische Maßnahmen ein, um deine Daten vor Verlust, Veränderung, unbefugtem Zugriff oder sonstigem Missbrauch zu schützen. Dazu zählen insbesondere:",
      },
      {
        type: "p",
        text:
          "Die Verarbeitung deiner Gesundheitsdaten erfolgt ausschließlich, nachdem du bei der ersten Nutzung der Funktionen (Symptom-Chat, Body-Map, Bildanalyse) eine ausdrückliche Einwilligung erteilt hast (Checkbox + Bestätigung). Diese Einwilligung kannst du jederzeit in den Einstellungen der App widerrufen.",
      },
      {
        type: "ul",
        items: [
          "Transportverschlüsselung (TLS/HTTPS) bei der Übertragung,",
          "Zugriffsbeschränkungen und Rollen-/Rechtesysteme,",
          "Datenminimierung und pseudonymisierte Verarbeitung, wo möglich,",
          "regelmäßige Aktualisierung der Systeme.",
        ],
      },
    ],
  },
  {
    id: "ds-10-kinder",
    heading: "10. Kinder und Jugendliche",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX richtet sich nicht an Kinder unter 16 Jahren. Minderjährige sollten die App nur mit Einwilligung ihrer Erziehungsberechtigten nutzen. Wenn wir Kenntnis erhalten, dass Daten eines Kindes unter 16 Jahren ohne Zustimmung der Sorgeberechtigten verarbeitet wurden, werden wir diese Daten löschen.",
      },
    ],
  },
  {
    id: "ds-11-rechte",
    heading: "11. Deine Rechte (Betroffenenrechte)",
    blocks: [
      {
        type: "p",
        text:
          "Als betroffene Person stehen dir im Rahmen der DSGVO insbesondere die folgenden Rechte zu:",
      },
      {
        type: "ul",
        items: [
          "Auskunft (Art. 15 DSGVO): Du kannst Auskunft darüber verlangen, welche personenbezogenen Daten wir über dich verarbeiten.",
          "Berichtigung (Art. 16 DSGVO): Du kannst die Berichtigung unrichtiger oder Vervollständigung unvollständiger Daten verlangen.",
          "Löschung (Art. 17 DSGVO): Du kannst die Löschung deiner personenbezogenen Daten verlangen, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.",
          "Einschränkung (Art. 18 DSGVO): Du kannst die Einschränkung der Verarbeitung verlangen.",
          "Datenübertragbarkeit (Art. 20 DSGVO): Du kannst verlangen, Daten in einem strukturierten, gängigen und maschinenlesbaren Format zu erhalten.",
          "Widerspruch (Art. 21 DSGVO): Du kannst der Verarbeitung aus Gründen, die sich aus deiner besonderen Situation ergeben, widersprechen, sofern wir uns auf ein berechtigtes Interesse stützen.",
          "Widerruf von Einwilligungen (Art. 7 Abs. 3 DSGVO): Eine einmal erteilte Einwilligung, insbesondere in die Verarbeitung von Gesundheitsdaten, kannst du jederzeit mit Wirkung für die Zukunft widerrufen.",
          "Beschwerderecht (Art. 77 DSGVO): Du hast das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren, z. B. an deinem Wohnort oder am Sitz des Verantwortlichen.",
        ],
      },
      {
        type: "p",
        text:
          "Für die Ausübung deiner Rechte kannst du dich jederzeit über die oben angegebenen Kontaktdaten an uns wenden.",
      },
    ],
  },
  {
    id: "ds-12-cookies",
    heading: "12. Cookies & LocalStorage",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX verwendet keine Tracking-Cookies zu Werbezwecken. Für Komfortfunktionen kann lokaler Speicher auf deinem Gerät genutzt werden, zum Beispiel:",
      },
      {
        type: "ul",
        items: [
          "Speicherung deiner Spracheinstellungen,",
          "optionale Speicherung des Chatverlaufs,",
          "Barrierefreiheitsoptionen (z. B. Schriftgröße).",
        ],
      },
      {
        type: "p",
        text:
          "Du kannst diese Daten jederzeit über entsprechende Funktionen in der App oder über die Einstellungen deines Geräts bzw. Browsers löschen.",
      },
    ],
  },
  {
    id: "ds-13-berechtigungen",
    heading: "13. App-Berechtigungen",
    blocks: [
      {
        type: "p",
        text:
          "Je nach Nutzung kann MedScoutX auf folgende Berechtigungen deines Geräts zugreifen:",
      },
      {
        type: "ul",
        items: [
          "Kamera/Dateizugriff: für das Aufnehmen bzw. Auswählen von Bildern zur Bildanalyse. Diese Berechtigung ist optional und kann in den System-Einstellungen deines Geräts widerrufen werden.",
          "Speicherzugriff: um Bilddateien oder temporäre Daten verarbeiten zu können.",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX greift nicht ohne dein Zutun auf Inhalte zu und sendet keine Daten im Hintergrund an Dritte, die nicht für die Funktionsweise der App erforderlich sind.",
      },
    ],
  },
  {
    id: "ds-14-ki",
    heading: "14. Hinweise zur automatisierten Verarbeitung",
    blocks: [
      {
        type: "ul",
        items: [
          "Deine Texte und gegebenenfalls Bilder werden automatisiert verarbeitet, um Vorschläge und Hinweise zu generieren.",
          "Das System kann Fehler machen oder Situationen falsch einschätzen. Bitte überprüfe die Inhalte kritisch und nutze sie nur zur Orientierung.",
          "Übermittle keine Namen oder identifizierende Angaben Dritter und vermeide unnötig umfangreiche personenbezogene Daten.",
          "Die Nutzung der App ersetzt keine persönliche medizinische Beratung, Diagnose oder Behandlung durch Ärztinnen und Ärzte oder anderes medizinisches Fachpersonal.",
        ],
      },
    ],
  },
  {
    id: "ds-15-entscheid",
    heading: "15. Keine automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX trifft keine Diagnosen und keine automatisierten Entscheidungen mit rechtlicher oder ähnlich erheblicher Wirkung. Die automatisierten Inhalte dienen ausschließlich der strukturierten Vorbereitung und Dokumentation deiner Angaben und ersetzen keine ärztliche Beratung. Du wirst in medizinisch relevanten Fällen aufgefordert, eine Ärztin oder einen Arzt zu kontaktieren.",
      },
    ],
  },
];
