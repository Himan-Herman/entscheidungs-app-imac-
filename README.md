# MedScoutX

**Die intelligente Gesundheitsplattform für Patienten und Arztpraxen.**

MedScoutX verbindet Patienten und Praxen auf eine neue Art: Vom ersten Symptom bis zur strukturierten Arzt-Zusammenfassung, mit Live-Übersetzung, Telemedizin und langfristiger Gesundheitsverfolgung — alles in einer Plattform.

---

## Das Problem

Millionen von Patienten wissen nicht, welchen Facharzt sie aufsuchen sollen. Sie erscheinen schlecht vorbereitet zum Termin. Sprachbarrieren verhindern echte Kommunikation. Gesundheitsdaten gehen zwischen Terminen verloren — und Praxen verlieren wertvolle Konsultationszeit durch unstrukturierte Informationen.

## Die Lösung

MedScoutX begleitet den Patienten von der ersten Symptom-Orientierung über eine KI-gestützte Terminvorbereitung mit Live-Übersetzung bis zur langfristigen Gesundheitsverfolgung — und legt damit das Fundament für personalisierte Medizin 4.0.

---

## Für Patienten

### Symptom-Orientierung & Facharzt-Empfehlung
Keine Ahnung welcher Arzt der richtige ist? Die interaktive Körperkarte (SVG, Vorder- und Rückseite) hilft dabei, Beschwerden zu lokalisieren. Ein KI-geführtes Gespräch stellt die richtigen Rückfragen und empfiehlt den passenden Facharzt.

### Strukturierte Terminvorbereitung (Pre-Visit)
Vor dem Termin füllt der Patient ein adaptives KI-Formular aus — auf seiner eigenen Sprache:
- Beschwerden in eigenen Worten
- Medikamente, Vorerkrankungen, Allergien
- Eigene Fragen an den Arzt
- Relevante Dokumente & Befunde

Die KI wandelt diese Angaben automatisch in eine **klinisch strukturierte Zusammenfassung für den Arzt** um — inklusive automatischer Übersetzung in die Arztsprache. Der Arzt bekommt die Zusammenfassung noch vor dem Termin.

### Live-Übersetzung & Dolmetscher (Meda)
Sprachbarrieren sind kein Problem mehr. MedScoutX unterstützt **22+ Sprachen** — darunter Arabisch, Türkisch, Farsi, Ukrainisch, Kurdisch und viele weitere — mit Echtzeit-Transkription und medizinisch sicherem KI-Dolmetscher. RTL-Sprachen (Arabisch, Hebräisch, Farsi, Urdu) werden vollständig unterstützt.

### Bildanalyse
Hautveränderungen, Wunden oder sichtbare Symptome können per Foto hochgeladen werden. Die KI beschreibt, was sie sieht — sicher, ohne Diagnose.

### Langfristige Gesundheitsverfolgung
MedScoutX speichert kontinuierlich:
- Vitalwerte (Blutdruck, Herzrate, Blutzucker, Gewicht, Sauerstoff, Temperatur)
- Impfungen, Allergien, Diagnosen mit ICD-Code
- Medikamentenpläne & E-Rezepte
- Arztbriefe, Laborbefunde, OCR-digitalisierte Dokumente
- SOS-Karte für Notfälle

Das ist die Basis für **personalisierte Medizin** — weil ein System die Gesundheitsgeschichte kennt.

### Telemedizin
Videosprechstunden direkt in der App — ohne externe Tools, ohne Login-Chaos.

---

## Für Arztpraxen

### Dashboard & Posteingang
Die Praxis sieht alle eingegangenen Patientenvorbereitugen auf einen Blick — filterbar nach Status, Sprache, Arzt und Freitext. Bis zu 250 Einträge, vollständig durchsuchbar.

### Patientenverwaltung
Vollständige Patientenprofile mit Gesundheitshistorie, Dokumenten, Terminen und Kommunikationshistorie — strukturiert und sofort abrufbar.

### KI-Assistenz für den Arzt
- Strukturierte Patientenzusammenfassung vor dem Termin
- KI-generierte Telemedizin-Notizen nach dem Gespräch
- KI-Sicherheitshinweis bei auffälligen Symptomen

### Dolmetscher-Management
Praxen können Dolmetscher einladen, Sprachsessions starten und Patientenkontext sicher teilen — alles mit Einwilligungstracking.

### Team & Rollen
Differenziertes Rechtemanagement: Eigentümer, Admin, Arzt, Assistent, Sekretariat, Praxismanager, Betrachter — jede Rolle sieht nur was sie sehen darf.

### Dokumente & OCR
Dokumente hochladen, automatisch digitalisieren (OCR) und sicher mit Patienten teilen — mit zeitlich begrenzten, verschlüsselten Download-Links.

### Externe Integrationen
- Webhooks für Praxisverwaltungssysteme (PVS)
- API-Clients für Drittanbieter
- Kalender-Integration (Google, Microsoft, ICS)
- FHIR / HL7v2 Infrastruktur für PVS-Anbindung

---

## Sicherheit & Datenschutz

- **DSGVO-konform**: Soft-Deletes, Einwilligungstracking, Datenexport, Löschrecht
- **Verschlüsselung**: Passwörter (bcrypt), JWT-Auth, verschlüsselte Interpreter-Payloads
- **Rollenbasierte Zugriffskontrolle** (RBAC) auf allen Ebenen
- **KI-Sicherheitsmodul**: 12 Sicherheitsmodule blockieren Diagnose, Triage, Behandlungsempfehlungen — in Deutsch, Englisch, Arabisch, Türkisch, Farsi, Russisch und weiteren Sprachen
- **Audit-Logs** für alle sicherheitsrelevanten Ereignisse
- **Rate Limiting** gegen Missbrauch
- **Helmet.js** & CORS für HTTP-Sicherheitsheader
- Zeitlich begrenzte, signierte Dokument-Tokens

---

## Technologie

| Bereich | Technologie |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, Material-UI |
| Backend | Node.js 22+, Express 5, Prisma ORM |
| Datenbank | PostgreSQL |
| KI / Sprache | OpenAI GPT (Chat), Whisper (STT), TTS |
| Deployment | Vercel (Frontend), Render (Backend + Cron-Worker) |
| PWA | Installierbar auf iOS, Android & Desktop |
| Sprachen | 22+ Sprachen, RTL-Support |

---

## Installation & Start

```bash
# Frontend
cd client
npm install
npm run dev

# Backend
cd server
npm install
node app.js
```

Umgebungsvariablen:
```
OPENAI_CHAT_MODEL=...
OPENAI_TTS_MODEL=...
DATABASE_URL=...
JWT_SECRET=...
```

---

## Vision: Medizin 4.0

MedScoutX ist mehr als eine App — es ist eine Infrastruktur für die Medizin der Zukunft.

Wenn Patienten ihre Gesundheitsdaten über Monate und Jahre kontinuierlich erfassen, entsteht ein vollständiges, personalisiertes Gesundheitsprofil. Ärzte bekommen nicht mehr Momentaufnahmen — sie bekommen Verläufe. KI kann Muster erkennen. Behandlungen werden individuell statt generisch.

Das ist Medizin 4.0: **Datengetrieben. Mehrsprachig. Menschlich.**

---

> MedScoutX stellt keine Diagnosen und ersetzt keine ärztliche Beratung.  
> Die Plattform dient ausschließlich der Vorbereitung, Kommunikation und Dokumentation.
