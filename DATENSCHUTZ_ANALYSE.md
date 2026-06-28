# Datenschutz- & DSGVO-Analyse — MedScoutX

> **Status:** Technischer Befund, Stand 2026-06-28. Kein Code wurde verändert.
> **Scope:** Statische Analyse von `server/prisma/schema.prisma` (2307 Zeilen), Express-Backend (`server/`), Client-Formulare (`client/src/features/`), Deployment-Hinweise.
> **Kein Rechtsrat** — ausschließlich technische Beobachtungen mit Datei-/Zeilenangabe.
> **Methodik:** Schema-Audit, Route-/Service-Audit, Secret-/Logging-Grep, Datenfluss-Analyse zu externen Verarbeitern.

---

## 0. Gesamtbild (Executive Summary)

MedScoutX verarbeitet in großem Umfang **besondere Kategorien nach Art. 9 DSGVO** (Symptome, Diagnosen, Allergien, Medikation, Impfungen, Vitalwerte, Laborwerte, Notfalldaten, Anamnese-Antworten). Die Architektur zeigt an mehreren Stellen **überdurchschnittliche Datenschutz-Disziplin**:

- IP-Adressen werden nur **gehasht** gespeichert (`ipHash`), nie im Klartext.
- Audit-Logs entfernen sensible Schlüssel per Regex vor Persistierung.
- Tokens/Secrets werden überwiegend als **SHA-256-Hash** bzw. **AES-256-GCM** gespeichert.
- Einwilligungen (`ConsentRecord`) sind versioniert, mit Zeitstempel, widerrufbar und serverseitig erzwungen.
- Analytics ist konsequent pseudonymisiert (`userHash`/`sessionHash`).

Demgegenüber stehen **gravierende Lücken**, die vor einem Demo Day mit Echtdaten kritisch sind:

1. **Keine vollständige Löschung (Art. 17):** `DELETE /api/account/delete` löscht die `User`-Zeile **nicht** und lässt nahezu alle Gesundheitsdaten bestehen.
2. **Klartext-API-Key im Log:** `server/index.js:3` gibt den vollständigen `OPENAI_API_KEY` auf stdout aus.
3. **Offener Mailer:** `POST /test-email` ist ohne Auth und ohne Rate-Limit erreichbar.
4. **Gesundheitsdaten über öffentlichen QR-Token:** `SosCard` exponiert Art.-9-Daten über einen Klartext-`publicToken`.
5. **Keine Retention/Auto-Löschung:** Health-Daten, Uploads und generierte Export-Dateien wachsen unbegrenzt; kein Cron löscht sie je.
6. **Unvollständiger Datenexport (Art. 15):** Weder Account-Export noch Kategorie-Export enthalten Symptome/Anamnese/Vitalwerte/SOS/Dokumentinhalte.

---

## 1. DATENERHEBUNG — Personenbezogene Daten

Alle Zeilenangaben in diesem Abschnitt beziehen sich auf `server/prisma/schema.prisma`.

### Identität & Kontakt

| Model | Feld | Typ | Zeile |
|---|---|---|---|
| `User` | `email` | String @unique | 3 |
| `User` | `firstName` | String | 5 |
| `User` | `lastName` | String | 6 |
| `User` | `dateOfBirth` | DateTime | 7 |
| `UserProfile` | `phone` | String? | 208 |
| `UserProfile` | `addressLine` | String? | 209 |
| `UserProfile` | `postalCode` | String? | 210 |
| `UserProfile` | `city` | String? | 211 |
| `UserProfile` | `country` | String? | 212 |
| `UserProfile` | `insuranceType` | String? | 213 |
| `UserProfile` | `gender` | String? | 214 |
| `UserProfile` | `genderOrSalutation` | String? | 216 |
| `UserProfile` | `displayName` | String? | 217 |
| `UserProfile` | `avatarStorageKey` / `avatarMimeType` | String? | 219–220 |
| `UserProfile` | `emergencyNote` | String? | 226 |
| `PatientProfile` (Angehörige) | `displayName` | String | 245 |
| `PatientProfile` | `relationLabel` | String | 246 |
| `PatientProfile` | `dateOfBirth` | DateTime? | 247 |
| `PatientProfile` | `genderOrSalutation` | String? | 248 |

### Dritte (Ärzte, Praxen, Personal)

| Model | Feld | Zeile |
|---|---|---|
| `DoctorContact` | `doctorName`, `practiceName`, `email`, `phone`, `address` | 285–290 |
| `PracticeProfile` | `address`, `phone`, `email`, `website`, `city/postalCode/country`, `legalName`, `street` | 310–345 |
| `PracticeMember` | `displayName`, `positionTitle`, `doctorTitle`, `specialty`, `internalContact` | 805–814 |
| `PracticeQrTarget` | `doctorName`, `recipientEmail` | 780–782 |
| `InterpreterCloudSession` | `doctorName`, `practiceName`, `specialty`, `appointmentDateTime` | 1620–1623 |

### Identitätsbündel im JSON (besonders sensibel kombiniert)

| Model | Feld | Zeile | Inhalt |
|---|---|---|---|
| `PracticeAnamnesisSubmission` | `patientInfoJson` | 2156 | firstName, lastName, dateOfBirth, email, phone, **insuranceNumber** (Klartext-JSON) |

### Notfallkontakte

| Model | Feld | Zeile |
|---|---|---|
| `SosCard` | `emergencyContact1Name/Phone`, `emergencyContact2Name/Phone` | 1943–1946 |

### IP / Device

| Model | Feld | Zeile | Hinweis |
|---|---|---|---|
| `AuditLog` | `ipHash` | 105 | gehasht ✅ |
| `AuditLog` | `userAgent` | 106 | **Klartext** ⚠️ |
| `PracticeApiAuditEvent` | `ipHash` | 1380 | gehasht ✅ |
| `PracticeInterpreterInviteUsage` | `ipHash` | 1700 | gehasht ✅ |

### Erhebung in Formularen/Routes (Auswahl)

- Registrierung/Profil: `server/routes/auth.js`, `server/routes/account.js` (Name, E-Mail, DOB, Profilfelder).
- Anamnese (B2B): `server/routes/publicAnamnesis.js`, `practiceAnamnesis.js` — `patientInfoJson` + `answersJson`.
- Pre-Visit (B2C): `server/routes/previsit*.js` → `PreVisitSession.answers` (Zeile 177).
- SOS-Karte: `server/routes/patientSosCard.js`.

---

## 2. BESONDERE KATEGORIEN — Art. 9 DSGVO (Gesundheitsdaten)

> ⚠️ **Alle folgenden Felder unterliegen erhöhtem Schutz (Art. 9 DSGVO).** Verarbeitung nur auf Basis ausdrücklicher Einwilligung (Art. 9 Abs. 2 lit. a) oder Behandlungszweck (lit. h).

### Selbstauskunft im Profil

| Model | Feld | Zeile |
|---|---|---|
| `UserProfile` | `heightCm`, `weightKg` | 228–229 |
| `UserProfile` | `allergies` (@db.Text) | 230 |
| `UserProfile` | `chronicConditions` (@db.Text) | 231 |
| `UserProfile` | `regularMedications` (@db.Text) | 232 |
| `UserProfile` | `smokingStatus` | 234 |
| `UserProfile` | `alcoholUse` | 236 |

### Anamnese / Pre-Visit (Kernzweck)

| Model | Feld | Zeile |
|---|---|---|
| `PreVisitSession` | `answers` (Json — Symptome/Beschwerden) | 177 |
| `PreVisitSession` | `aiDoctorVersion` (Json — KI-aufbereitete klinische Version) | 178 |
| `PreVisitCase` | `title`, `description`, `category` (Krankheitsfälle) | 144–146 |
| `PracticeAnamnesisSubmission` | `answersJson` | 2158 |
| `PracticeAnamnesisSubmission` | `translatedAnswersJson` | 2171 |

### Patienten-Gesundheitsakte (B2C)

| Model | Felder | Zeile |
|---|---|---|
| `VaccinationEntry` | vaccineName, disease, vaccinationDate, doseLabel, lotNumber, … | 1758–1780 |
| `VitalEntry` | type, valuePrimary/Secondary, unit, measuredAt | 1783–1806 |
| `SymptomEntry` | symptom, severity, bodyRegion, trigger, betterWith/worseWith, notes | 1810–1836 |
| `AllergyEntry` | allergen, allergyType, severity, reaction, status | 1839–1862 |
| `DiagnosisEntry` | conditionName, icdCode, diagnosedDate, treatingDoctor | 1865–1886 |

### Praxis-ausgestellte klinische Daten

| Model | Felder | Zeile |
|---|---|---|
| `MedicationPlan` / `MedicationPlanItem` | medicationName, dosage, frequency, route, schedule | 1116–1147 |
| `VisitMedicationEntry` | drugName, dosage, frequency, intakeInstructions | 1504–1507 |
| `ErezeptEntry` | medicationName, icdCode, dosage, instructions, tokenCode | 1900–1905 |
| `PracticeDocument` | type (report/lab/imaging/referral/discharge), title, description | 1168–1173 |
| `DocumentOcrResult` | extractedTextStorageKey, structuredJson (extrahierter klinischer Text) | 1261–1262 |
| `LabStructuredEntry` | label, valueText, unit, referenceRangeText | 1278–1282 |

### Dolmetscher / Meda (medizinische Gesprächsinhalte)

| Model | Feld | Zeile | Hinweis |
|---|---|---|---|
| `InterpreterCloudSessionPayload` | `payloadEnc` | 1649 | **verschlüsselt** ✅ + `checksumSha256` |
| `PracticeInterpreterSharePayload` | `payloadEnc` | 1742 | **verschlüsselt** ✅ |
| `PracticeMedaSession` | nur Metadaten, Einwilligung erforderlich (`consentRecordId`) | 2010–2043 | ✅ |

### SOS-Karte — Notfall-Cluster (hohes Expositionsrisiko)

| Feld | Zeile |
|---|---|
| `bloodType` | 1940 |
| `firstResponderNote` (@db.Text) | 1949 |
| `aiSummary` (KI-generierte Notfallzusammenfassung) | 1952 |
| `medicationsJson`, `implantsJson` | 1962–1964 |
| `emergencyBiologicalSex` | 1968 |
| `pregnancyStatus` (im Schema-Kommentar als sensibel markiert) | 1971 |

> 🔴 **Kritisch:** `SosCard` ist über einen **öffentlichen QR-Klartext-Token** (`publicToken`, Zeile 1956) erreichbar. Mehrere Sichtbarkeits-Flags (Zeilen 1978–1992) stehen per Default auf `true` (u. a. `showBloodType`, `showAllergies`, `showDiagnoses`, `showMedications`, `showImplants`, `showAiSummary`). → Art.-9-Daten potenziell öffentlich abrufbar, wer den Link kennt.

---

## 3. SPEICHERUNG — PostgreSQL, Verschlüsselung, Pseudonymisierung

**Datenbank:** PostgreSQL via Prisma (`provider = "postgresql"`). Verbindung über `DATABASE_URL` aus `.env`.

### Verschlüsselung at-rest

- **Keine anwendungsseitige Spaltenverschlüsselung** für Gesundheitsdaten in der Breite. Symptome, Diagnosen, Allergien, Anamnese-Antworten, Laborwerte usw. liegen **im Klartext** in PostgreSQL.
- Verschlüsselung at-rest hängt damit allein an der Plattform (Render Managed Postgres bietet Volume-Encryption) — **nicht im Repo nachweisbar/dokumentiert**.
- **Spaltenverschlüsselung (`*Enc`, AES-256-GCM) existiert nur für** Dolmetscher-/Webhook-Payloads:
  - `InterpreterCloudSessionPayload.payloadEnc` (1649), `PracticeInterpreterSharePayload.payloadEnc` (1742)
  - `PracticeWebhookEndpoint.secretEnc` (1326), `PracticeIntegrationSettings.webhookSecretEnc` (621)

### Klarnamen vs. Pseudonymisierung

- **Klarnamen/DOB werden durchgängig im Klartext gespeichert** — keine Tokenisierung: `User.firstName/lastName/dateOfBirth/email` (3,5,6,7), `PatientProfile` (245,247), SOS-Kontakte (1943–1946), `PracticeAnamnesisSubmission.patientInfoJson` inkl. Versichertennummer (2156).
- **Analytics korrekt pseudonymisiert:** `AnalyticsEvent` nutzt nur `userHash`/`practiceHash`/`sessionHash` (126–128). ✅

### Passwörter & Tokens

- `User.passwordHash` (4) — bcryptjs, Cost 10 (`server/routes/auth.js:108,379,461`). ✅
- **Token-Hashes (SHA-256)** ✅: `SecureDocumentDelivery.tokenHash` (636), `PatientPracticeConnectCode.tokenHash` (945), `PracticeApiClient.tokenHash` (1302), `SecureDocumentAccessToken.tokenHash` (1397), `PracticeInterpreterInvite.tokenHash` (1671), `PracticeAnamnesisLink.tokenHash` (2122), `TelemedicineSession.joinUrlHash/hostUrlHash` (424–425).
- **Tokens im KLARTEXT** ⚠️ (Inkonsistenz zur sonstigen Hash-Konvention):
  - `User.verifyToken` (9), `User.passwordResetToken` (13)
  - `PreVisitFollowUpThread.followUpAccessToken` (843)
  - `PracticeQrTarget.qrToken` (784)
  - `SosCard.publicToken` (1956) — gewährt Zugriff auf Gesundheitsdaten
  - `ErezeptEntry.tokenCode` (1905, nur Simulation)

---

## 4. ÜBERTRAGUNG — TLS / HTTPS / CORS

Echter Entrypoint: `server/app.js` (`npm start` → `node app.js`). `server/index.js` ist ein veralteter Mini-Server (siehe §6).

| Bereich | Befund | Ort |
|---|---|---|
| HTTPS-Erzwingung | **Nicht im App-Code erzwungen.** Kein HSTS-Hardening, kein http→https-Redirect, keine `req.secure`-Prüfung. TLS wird vollständig an die Plattform (Render Edge) delegiert — funktional, aber undokumentiert. | `server/app.js` (fehlt) |
| `trust proxy` | Korrekt auf `1` gesetzt (für korrekte Client-IP hinter Render-Proxy). | `server/app.js:120` |
| helmet | Aktiv, aber **abgeschwächt**: `contentSecurityPolicy: false` (keine CSP) und `crossOriginResourcePolicy: false`. HSTS nur über helmet-Defaults (~180 Tage, kein `preload`). | `server/app.js:138-143` |
| Cookies | **Keine Cookies** — Auth ausschließlich via Bearer-Token im Header (`credentials: false`). Daher keine `secure`/`sameSite`-Problematik, aber Token liegt clientseitig (localStorage, siehe §6). | `server/middleware/requireAuth.js:30-33` |
| CORS | Allowlist aus `CORS_ORIGIN` (komma-separiert). **Kein Wildcard `*`.** Fallback nur Dev (`http://localhost:5173`). `credentials: false`. Sauber. ✅ | `server/app.js:124-136` |
| Render/Docker-IaC | **Kein `render.yaml`, `Dockerfile` oder `Procfile`** im Repo. Deployment-/TLS-Konfiguration liegt außerhalb (Render-Dashboard) → nicht auditierbar. | repo root (fehlt) |
| Legacy CORS | `server/index.js:14` nutzt `app.use(cors())` = **Wildcard, reflect-any-origin**. Nicht in Prod gemountet, aber `index.js` ist `"main"` in `package.json`. | `server/index.js:14` |

---

## 5. DATENMINIMIERUNG — Art. 5 Abs. 1 lit. c

Der erklärte Hauptzweck ist die **Pre-Visit-Anamnese**. Folgende Erhebungen gehen über den engen Anamnese-Zweck hinaus bzw. sind zu prüfen:

| Feld | Ort | Bewertung |
|---|---|---|
| `addressLine`, `postalCode`, `city`, `country` | `UserProfile` (209–212) | Volle Postanschrift für eine Pre-Visit-Anamnese nicht zwingend nötig; relevant erst bei Praxis-Zuordnung/Versand. Prüfen, ob downstream genutzt. |
| `insuranceNumber` (in `patientInfoJson`) | `PracticeAnamnesisSubmission` (2156) | Versichertennummer im Klartext-JSON gebündelt mit Identität — hohe Sensibilität, nur erheben wenn Praxis sie tatsächlich benötigt. |
| `gender` **und** `genderOrSalutation` | `UserProfile` (214, 216) | Doppelte Geschlechts-/Anredefelder — Redundanz; klären welches genutzt wird. |
| `smokingStatus`, `alcoholUse` | `UserProfile` (234, 236) | Lebensstil-Gesundheitsdaten (Art. 9) im Dauerprofil statt fallbezogen — nur erheben wenn anamnesebezogen ausgewertet. |
| `userAgent` (Klartext) | `AuditLog` (106) | Device-Fingerprint unverhasht, während IP gehasht wird — Inkonsistenz; für Audit-Zweck reicht ggf. ein gekürzter/gehashter Wert. |
| SOS-Default-Sichtbarkeit `true` | `SosCard` (1978–1992) | Datenschutzfreundliche Defaults (opt-in statt opt-out) wären minimierender. |

> **Hinweis:** Das ist kein Vollnachweis der Verwendung — eine belastbare Minimierungs-Bewertung erfordert Abgleich „erhoben vs. tatsächlich downstream genutzt" pro Feld. Die obigen Punkte sind die naheliegenden Kandidaten.

---

## 6. ZUGRIFF & SECRETS — Hardcoded Secrets, Logging

### Secrets

| Befund | Bewertung | Ort |
|---|---|---|
| Hardcodierte `sk-`/`AKIA`-Keys | **Keine gefunden** ✅ | — |
| OpenAI/Azure/JWT/DB-Secrets | Korrekt aus `process.env` gelesen ✅ | `openaiClient.js:8`, `azureSpeech.js:4-5` |
| `.env`-Tracking | `.env` ist gitignored; **kein echtes `.env` getrackt** ✅ | `.gitignore`, `server/.gitignore` |
| Getrackte env-Dateien | Nur Beispiele/öffentliche URLs (`server/.env.example`, `.env.e2e.example`, `client/.env.produktion` — nur `VITE_*`-URLs, keine Secrets) ✅ | — |
| Hardcodierter Fallback-Salt | Audit-IP-Hash fällt auf Literal `"medscoutx-audit-salt"` zurück, falls `AUDIT_IP_SALT` **und** `JWT_SECRET` fehlen. In Prod wirft Startup bei fehlendem `JWT_SECRET`, daher nur bei Fehlkonfiguration erreichbar — aber committeter schwacher Salt. | `server/services/auditLogService.js:13` |
| Worker-Secret-Platzhalter | `WORKER_CRON_SECRET=change_me_long_random` — in Prod-Override prüfen. | `server/.env.example` |

### Logging personenbezogener Daten

| Schwere | Befund | Ort |
|---|---|---|
| 🔴 **HOCH** | `console.log("🔍 OPENAI_API_KEY:", process.env.OPENAI_API_KEY)` — gibt den **vollständigen Live-API-Key im Klartext** auf stdout aus. In `server/index.js` (Legacy, nicht via `npm start` gestartet), aber lauffähig und `"main"` in package.json. | `server/index.js:3` |
| NIEDRIG | e2e-Fixtures loggen User-E-Mails (`[e2e-fixture] ${u.email}`) — nur Dev-Tooling, nicht im Request-Pfad. | `server/scripts/createE2eTestUser.js:162,177` |
| ✅ GUT | **Kein Route/Middleware loggt `req.body`, `req.user`, E-Mails, Symptome, Namen, DOB.** 256 `console.log` in `server/` geprüft — keiner im Request-Pfad mit PII. | server/routes/* |
| ✅ GUT | Audit-Logging gehärtet: `SENSITIVE_METADATA_KEYS`-Regex entfernt password/token/email/symptom/diagnosis/medication vor Persistierung; Strings auf 200 Zeichen gekürzt; IP SHA-256-salt-gehasht. | `server/services/auditLogService.js:9-57` |

### Auth / Rate Limiting

| Bereich | Befund | Ort |
|---|---|---|
| JWT-Secret | `process.env.JWT_SECRET` für sign & verify, kein Fallback im Auth-Pfad. Startup wirft in Prod bei Fehlen. ✅ | `auth.js:401`, `requireAuth.js:44`, `startupEnvValidation.js:19-21` |
| Token-Lebensdauer | `JWT_EXPIRES_IN` oder Default **`7d` (Prod) / `90d` (Dev)**, clientseitig in localStorage (laut In-Code-TODO `TODO(auth-hardening): prefer HttpOnly cookies`). Lange Lebensdauer = Hardening-Schuld. | `auth.js:396-403` |
| Rate-Limiter | In-Memory Fixed-Window, **per-Prozess-Map** (nicht über Render-Replicas/Restarts geteilt). Auth-Limiter (login 40, register 15, reset 10/15) und Public-Endpoints (QR/emergency/anamnesis/secure-docs) gewired. ✅/⚠️ | `server/middleware/ipRateLimit.js:25-46`, `app.js:240-248` |

### Unauthentifizierte Endpunkte (bestätigen, ob beabsichtigt)

- 🔴 `app.post('/test-email', …)` — **ohne Auth, ohne Rate-Limit**, löst echten Mailversand an beliebige `req.body.email` aus. Offener Missbrauchs-/Spam-Vektor. `server/app.js:325-340`
- `/api/meda` (155), `/api/ki` (175), `/api/tts` (174), `/api/mail` (173) ohne `requireAuth` gemountet — kostenverursachende OpenAI/Mail-Routen; prüfen ob Router-intern IP-limitiert.
- `/api/v1/practice` (230) ohne app-level `requireAuth` — prüfen ob Router-intern API-Key-Auth erzwingt.

### Drittland-/Verarbeiter-Datenflüsse (Art. 28 / Art. 44 ff.)

> Health-/Personendaten verlassen das System an mehrere **US-/Cloud-Verarbeiter**. AV-Verträge (DPA) und Drittlandgarantien (SCC) sind organisatorisch erforderlich — technisch belegt:

| Verarbeiter | Was wird übertragen | Ort |
|---|---|---|
| **OpenAI** (api.openai.com) | Symptom-/Anamnese-Freitext, Chat-Verlauf für KI-Rückfragen, SOS-`aiSummary`-Generierung | `server/openaiClient.js:7-9,18-22`, diverse `preVisit*Client.js` |
| **Microsoft Azure Speech** | Audio (Sprache→Text) für Transkription/Dolmetscher | `server/services/azureSpeech.js:4-5,19` |
| **Google Places/Geocoding** | Adress-/Ortssuchtext (Praxis-Finder) | `server/services/places/googlePlacesClient.js:4`, `geocoding.js:3-4` |
| **E-Mail/SMTP-Provider** | E-Mail-Adressen, Einladungs-/Benachrichtigungsinhalte | `server/mailer.js`, `emailService.js` |

- `server/services/aiSafetySanitizer.js` sanitisiert primär den **KI-Output** (verbotene medizinische Aussagen entfernen, „no PHI in logs"), **nicht den Input** — d. h. Roh-Symptomtext geht unmaskiert an OpenAI/Azure. Das ist für den Zweck (Verständnis der Symptome) wohl unvermeidbar, gehört aber in Verzeichnis der Verarbeitungstätigkeiten + Einwilligung.

---

## 7. BETROFFENENRECHTE — Auskunft (Art. 15) & Löschung (Art. 17)

### Auskunft / Portabilität (Art. 15 / 20)

**A) Account-Export:** `GET /api/account/export` — `server/routes/account.js:73-261`
- **Enthält:** Identität (E-Mail, Name, DOB), `profile`, `consent`, `doctorContacts`, `preVisitSessions` (mit answers), `preVisitCases`, Praxis-Mitgliedschaften, Follow-up-Threads/-Messages, Audit-Log (letzte 500), Billing-Plausibilität, Interpreter-Consent-Metadaten. Rate-limitiert. ✅
- 🟠 **Lücke — NICHT enthalten:** `SymptomEntry`, Anamnese-Submissions, `SosCard`, Vitalwerte, Allergien, Diagnosen, Impfungen, Medikationspläne, Praxis-Dokumente, Care-Links/Consent (außer Interpreter). → **Kein vollständiger Art.-15-Export.**

**B) Kategorie-Export-Jobs (async, PDF/CSV):** `server/routes/patientExports.js`
- Erlaubte Typen (`exportConstants.js:3-9`): `medication_plans`, `practice_documents_list`, `profile_sharing`, `activity`, `data_requests`.
- 🟠 **Nur Metadaten/Listen** (z. B. `practice_documents_list` = Titel/Typ/Datum, **keine Inhalte**, `exportCollectors.js:75-102`). Kein Symptom-/Anamnese-/Vitalwert-Inhalt.

**C) „export"-Datenanfrage** (`patientDataRequestService.js:10`) ist nur ein **Anfrage-Flag** an die Praxis — produziert selbst keine Daten.

### Löschung (Art. 17)

**A) Account-Löschung:** `DELETE /api/account/delete` — `server/routes/account.js:268-351`
- Bestätigungsphrase `DELETE_MY_MEDSCOUTX_DATA` erforderlich (27,274).
- Löscht (in Tx): `preVisitSession`, `preVisitCase`, `doctorContact`, `doctor`, `auditLog`, Billing-Plausibilität, `practiceProfile`, `practiceMember`, `interpreterCloudSession`, `interpreterCloudPreference`.
- 🔴 **KRITISCHE LÜCKEN:**
  - **Die `User`-Zeile wird NICHT gelöscht** — explizit dokumentiert: *„Full account removal — not implemented in v1"*, *„the login user row is kept"* (`account.js:10,12`).
  - **Gesundheitsdaten werden NICHT gelöscht:** `SymptomEntry`, Anamnese-Submissions, `SosCard`, Vitalwerte, Allergien, Diagnosen, Impfungen, Medikationspläne, Praxis-Dokumente, `PracticePatientLink`, `ConsentRecord`, Follow-up-Threads überleben die „Account-Löschung".
  - → **Art.-17-Erasure ist unvollständig.**
- Keine Anonymisierung/Pseudonymisierung bei Löschung (`anonymize*` betrifft nur Audit-Log-Suchmaskierung, `practicePatients.js:39`).

**B) „deletion"-Datenanfrage:** `POST /api/patient/data-requests` (type `deletion`) — `patientDataRequestService.js:138-211`
- Erzeugt nur `PatientDataRequest`-Zeile (`status:"submitted"`) + widerruft ggf. Profil-Zugriff. **Löscht keine Daten.** Praxis-seitiger Statuswechsel (`updatePracticeDataRequestStatus:278-334`) ändert nur Status/Notizen — **kein Lösch-Codepfad** an den Abschluss gekoppelt. → manueller Honor-System-Prozess.

**C) Self-Service-Einzellöschung** (Patient löscht einzelne Einträge): `patientSymptoms.js:155`, `patientAllergies.js:132`, `patientVitals.js:163`, `patientDiagnoses.js:126`, `patientVaccinations.js:185`, `patientSosCard.js:319`. **Kein „alles löschen".**

### Einwilligung (Art. 7) — Stärkster Bereich ✅

`server/services/consent/consentRecordService.js`: `ConsentRecord` mit `grantedAt`, `grantedByUserId`, `version`, optional `expiresAt`, audit-logged (256-334); widerrufbar (`revokeConsentRecord:341-383`, kaskadiert Secure-Link-Widerruf); Ablauf-Logik (`expireStaleConsentsForLink:56-89`); serverseitig erzwungen (`assertConsentForLink`, blockiert z. B. Praxis-Export ohne `data_export`-Consent). Endpoints: `patientConsents.js`, `practiceConsents.js`.

---

## 8. AUFBEWAHRUNG — Retention / Löschlogik

> 🔴 **Es existiert KEINE automatische Retention/TTL-Löschung für Gesundheitsdaten.**

- **Kein In-Process-Scheduler/Cron.** Einziger `setInterval` (`interpreterStreamTranscribeService.js:366`) räumt nur ephemere In-Memory-Live-Transkription. Alle „Worker" laufen nur, wenn ein **externer Cron** `POST /api/internal/worker` pingt (`app.js:149`, `routes/internalWorker.js`).
- **Export-Dateien: TTL, aber Datei nie gelöscht.** `EXPORT_TTL_MS = 24h` (`exportConstants.js:19`); `cleanupExpiredExports` (`exportJobService.js:247-277`) setzt nur DB-Status auf `EXPIRED` — **löscht die Datei nicht** (`exportStorage.js` hat keine Delete-Methode). → Export-PDFs/CSVs mit Personendaten bleiben unbegrenzt auf Disk.
- **Uploads nie bereinigt.** `server/uploads/` enthält verwaiste Dateien (Juni 2025); kein Cleanup-Code (`fs.unlink`/`olderThan`) referenziert es. `storage/exports` akkumuliert ebenso.
- **Telemedizin-Cleanup ≠ Löschung.** `telemedicineCleanupService.js` storniert nur abgelaufene *Sessions* (Statuswechsel + `endedAt`), löscht keine Records. Audio „wird nie gespeichert" (Design).
- **Secure-Document-Tokens: zeitlich begrenzter Zugriff, kein Purge.** 15-Min-Default / 60-Min-Max-TTL (`secureDocumentAccessService.js:15-16,58`); Tokens werden nur soft-`revoked`/expired, Zeilen nicht gelöscht.
- **Consent-Records laufen per Zeitstempel ab** (Status→`expired`, lazy beim Lesen) — keine Löschung.

**Models mit Gesundheits-/Personendaten OHNE Retention/Expiry/Soft-Delete (unbegrenzte Speicherung):**

| Model | Zeile | Hinweis |
|---|---|---|
| `UserProfile` | 205 | Allergien/Chronisches/Medikation/Lebensstil — nur User-Cascade, kein eigenes `deletedAt`/Expiry |
| `PreVisitSession` | 155 | Anamnese-`answers` — nur `archivedAt`, kein Retention-Limit |
| `PreVisitCase` | 139 | Fall-Timelines — nur `isArchived`, unbegrenzt |
| `VisitMedicationEntry` | 1499 | nur Cascade |
| `PracticeDocumentFile` | 1199 | Datei-Metadaten + `storageKey`, kein `deletedAt` |
| `DocumentOcrResult` | 1254 | extrahierter klinischer Text, kein Retention-Feld |
| `LabStructuredEntry` | 1274 | Laborwerte, nur Cascade |
| `PreVisitFollowUpMessage` / `PracticePatientMessage` | 860 / 1090 | Nachrichtentexte, kein Retention |
| `AuditLog` | 90 | kein Purge-Feld → unbegrenzte Log-Retention |
| `AnalyticsEvent` | 122 | Retention nur als **TODO-Kommentar** (Zeile 120), nicht implementiert |

**Bottom line:** Kein geplanter Job löscht jemals Patienten-Gesundheitsdaten, Uploads oder generierte Export-Dateien. Speicher wächst unbegrenzt.

---

## 9. PRIORISIERTE MASSNAHMENLISTE

### 🔴 KRITISCH — vor Demo Day (mit Echtdaten) beheben

| # | Befund | Datei:Zeile | Begründung |
|---|---|---|---|
| K1 | OpenAI-API-Key wird im Klartext geloggt | `server/index.js:3` | Vollständiger Live-Key auf stdout → Render-Logs = Key-Leak. Zeile entfernen; veraltete `index.js` löschen + `package.json "main"` korrigieren. |
| K2 | Offener Mailer ohne Auth/Rate-Limit | `server/app.js:325-340` | `POST /test-email` versendet echte Mails an beliebige Adresse → Spam/Abuse, Reputations-/DSGVO-Risiko. Auth-gaten oder entfernen. |
| K3 | Gesundheitsdaten über öffentlichen Klartext-QR-Token | `schema.prisma:1956`, Sichtbarkeits-Defaults 1978–1992 | `SosCard.publicToken` exponiert Art.-9-Daten; Defaults `true`. Defaults auf opt-in, Token-Ablauf/Hashing erwägen. |
| K4 | Keine echte Löschung (Art. 17) | `server/routes/account.js:268-351` (insb. 10-12) | `User`-Zeile + Symptome/Anamnese/SOS/Vitalwerte/Dokumente überleben „Account-Löschung". Bei Echtdaten direkter Art.-17-Verstoß. |
| K5 | „deletion"-Anfrage löscht nichts | `patientDataRequestService.js:278-334` | Honor-System ohne Lösch-Codepfad → unerfüllte Betroffenenrechte. |

### 🟠 WICHTIG — zeitnah

| # | Befund | Datei:Zeile | Begründung |
|---|---|---|---|
| W1 | Keine Retention/Auto-Löschung für Health-Daten, Uploads, Export-Dateien | `exportJobService.js:247-277`, `server/uploads/`, `storage/exports` | Unbegrenzte Speicherung verstößt gegen Speicherbegrenzung (Art. 5 1 e). `cleanupExpiredExports` löscht Datei nicht. |
| W2 | Art.-15-Export unvollständig | `account.js:73-261`, `exportCollectors.js:40-167` | Symptome/Anamnese/Vitalwerte/SOS/Dokumentinhalte fehlen → Auskunftsrecht nicht voll erfüllt. |
| W3 | Keine Spaltenverschlüsselung für breite Gesundheitsdaten | `schema.prisma` (UserProfile 228-236, PreVisitSession 177, Lab/OCR 1254-1282) | At-rest-Schutz hängt allein an Plattform; bei Art.-9-Daten erhöhtes Schutzniveau erwartet. |
| W4 | CSP deaktiviert | `server/app.js:138-143` | `contentSecurityPolicy:false` → kein XSS-/Clickjacking-Transport-Hardening. CSP reaktivieren. |
| W5 | Lange Bearer-Token in localStorage | `server/routes/auth.js:396-403` | `7d`-Token clientseitig → Diebstahlfenster. HttpOnly-Cookie-Migration (bereits TODO). |
| W6 | Versichertennummer im Klartext-JSON gebündelt | `schema.prisma:2156` | `patientInfoJson` bündelt Identität + Versichertennummer; nur erheben wenn nötig, ggf. verschlüsseln. |
| W7 | HTTPS-Erzwingung/HSTS nicht im Code, kein IaC | `server/app.js`, repo root | TLS allein plattformseitig, undokumentiert; explizites HSTS + dokumentierte Render-TLS-Konfiguration. |

### 🟡 NICE-TO-HAVE

| # | Befund | Datei:Zeile | Begründung |
|---|---|---|---|
| N1 | `AuditLog.userAgent` im Klartext, IP gehasht | `schema.prisma:106` | Inkonsistente Pseudonymisierung; UA kürzen/hashen. |
| N2 | Klartext-Tokens vs. Hash-Konvention | `schema.prisma:784,843,1905` (+ `verifyToken` 9, `passwordResetToken` 13) | Konsistenz: auch diese Tokens hashen. |
| N3 | Hardcodierter Fallback-Salt | `auditLogService.js:13` | `"medscoutx-audit-salt"`-Literal ersetzen; `AUDIT_IP_SALT` in Prod-Startup erzwingen. |
| N4 | Doppelte Geschlechtsfelder / Minimierung | `schema.prisma:214,216,234,236` | Redundante/optionale Felder prüfen (Minimierung). |
| N5 | In-Memory Rate-Limiter ohne Replica-Koordination | `ipRateLimit.js:27` | Bei Skalierung auf mehrere Render-Instanzen wirkungslos; geteilter Store (Redis). |
| N6 | `AnalyticsEvent`-Retention nur TODO | `schema.prisma:120` | Retention-Feld + Purge-Job implementieren. |
| N7 | Drittland-Datenflüsse dokumentieren | `openaiClient.js`, `azureSpeech.js`, `places/*` | OpenAI/Azure/Google in Verarbeitungsverzeichnis + AV/SCC abbilden (organisatorisch). |

---

## 10. Positive Befunde (Datenschutz-Stärken)

- IP-Adressen nur gehasht gespeichert (`ipHash`), Audit-Logs strippen sensible Keys vor Persistierung (`auditLogService.js:9-57`).
- Einwilligungs-Framework versioniert, widerrufbar, serverseitig erzwungen (`consentRecordService.js`).
- Analytics konsequent pseudonymisiert (`AnalyticsEvent`, `userHash`/`sessionHash`).
- Tokens/Secrets überwiegend SHA-256-gehasht bzw. AES-256-GCM-verschlüsselt; Passwörter bcrypt.
- CORS-Allowlist ohne Wildcard, `credentials:false`.
- Kein PII-Logging im Request-Pfad; Dolmetscher-/Meda-Inhalte verschlüsselt und einwilligungsgebunden.
- KI-Output-Sanitizer verhindert medizinische Aussagen + PHI in Logs.

---

*Ende des Befunds. Erstellt durch statische Code-Analyse; keine Laufzeit-/Penetrationstests. Eine belastbare Minimierungs- und Erforderlichkeitsbewertung erfordert zusätzlich den Abgleich „erhoben vs. tatsächlich genutzt" je Feld sowie organisatorische Unterlagen (VVT, AV-Verträge, TOMs).*
