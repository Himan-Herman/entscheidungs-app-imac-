# Technische und organisatorische Maßnahmen (TOM) — ENTWURF

## Anhang zum AVV — GOÄ/PKV-Abrechnungsplausibilität (Pilot)

> ⚠️ **ENTWURF — RECHTLICHE PRÜFUNG VOR UNTERZEICHNUNG ERFORDERLICH.**
> Beschreibung der TOM gemäß Art. 32 DSGVO. **Keine Rechtsberatung.** Einige Angaben
> sind als `«Platzhalter — zu bestätigen»` markiert, weil sie von der konkreten
> Hosting-/Betriebsumgebung abhängen und vom Betreiber verbindlich auszufüllen sind.
>
> *English note: Draft technical & organisational measures (Art. 32 GDPR), appendix to
> the DPA. Items marked "zu bestätigen / to be confirmed" depend on the concrete hosting
> setup and must be filled in by the operator. NOT legal advice.*

Legende: ✅ implementiert/belegt · ⚠️ teilweise/manuell · ☐ zu bestätigen

---

## 1. Zugriffskontrolle (Access Control)

| Maßnahme | Status | Hinweis |
|----------|--------|---------|
| Authentifizierung über JWT | ✅ | `JWT_SECRET` serverseitig |
| Rollenbasierter Zugriff auf das Billing-Modul | ✅ | nur Inhaber:in/Admin (`INTEGRATIONS_MANAGE`) |
| Least-Privilege (Praxis-Scoping) | ✅ | Sitzungen sind an `practiceProfileId` gebunden |
| Passwort-Hashing | ☐ zu bestätigen | bcrypt-Verfahren im Auth-Modul prüfen/dokumentieren |
| Mehr-Faktor-Authentifizierung | ☐ zu bestätigen | falls vorhanden, dokumentieren |

---

## 2. Authentifizierung & Sitzungssicherheit

| Maßnahme | Status | Hinweis |
|----------|--------|---------|
| Token-basierte Sitzungen | ✅ | kein API-Key im Browser |
| Rate-Limiting (Auth, Export, Delete) | ✅ | `ipRateLimit`-Middleware |
| `trust proxy` korrekt gesetzt | ✅ | für korrekte IP-Erkennung hinter Proxy |

---

## 3. Transportverschlüsselung

| Maßnahme | Status | Hinweis |
|----------|--------|---------|
| TLS für API und Frontend | ☐ zu bestätigen | TLS-Terminierung an Hosting-Edge (z. B. Render/Vercel) |
| Keine PHI in URL-Query-Strings | ✅ | dokumentierte Architektur-Vorgabe |

---

## 4. Datenbankschutz

| Maßnahme | Status | Hinweis |
|----------|--------|---------|
| Zugriff nur über serverseitige Verbindung | ✅ | `DATABASE_URL` nur serverseitig |
| Keine Patientenidentifikatoren im Billing-Schema | ✅ | per Route abgewiesen + im Schema dokumentiert |
| Verschlüsselung at-rest | ☐ zu bestätigen | abhängig vom DB-Provider |
| Netzwerk-/Zugriffsbeschränkung der DB | ☐ zu bestätigen | Provider-Konfiguration dokumentieren |

---

## 5. Backups

| Maßnahme | Status | Hinweis |
|----------|--------|---------|
| Regelmäßige DB-Backups | ☐ zu bestätigen | Frequenz/Retention vom Provider dokumentieren |
| Wiederherstellungstest | ☐ zu bestätigen | Verfahren festlegen |

---

## 6. Protokollierung / Audit-Logging

| Maßnahme | Status | Hinweis |
|----------|--------|---------|
| Audit-Log für Sitzungs-Lebenszyklus | ✅ | `BillingPlausibilityAuditLog` (created/dismissed/reviewed) |
| Keine sensiblen Freitexte in Logs | ✅ | `contextText` wird nicht protokolliert |
| Keine Patientenfeldnamen in Logs | ✅ | Grep-Prüfung im Runbook §3 |
| Strukturierte Fehler-Events (KI-Pfad) | ✅ | Event-Namen, keine Rohdaten |
| Audit-Schreibfehler werden sichtbar gemeldet | ⚠️ | bekannte Lücke: `writeAiAuditLog` schluckt Fehler still (Runbook §3.3) |

---

## 7. Incident Response

| Maßnahme | Status | Hinweis |
|----------|--------|---------|
| Incident-Checklisten | ✅ | Runbook §5 (Migration, PDF, KI-Unsafe, Patientendaten, Quota) |
| Eskalationspfade | ✅ | Runbook §7 (Legal/DPO, Product, Engineering) |
| Meldefristen | ⚠️ | im AVV §16 zu konkretisieren (Art. 33) |

---

## 8. Löschung / Export / Aufbewahrung

| Maßnahme | Status | Hinweis |
|----------|--------|---------|
| Konto-Löschung entfernt Billing-Daten | ✅ | Phase D2 (in Transaktion, vor Praxislöschung) |
| Datenschutzfreundlicher Export | ✅ | Phase D3 (roher `contextText` ausgeschlossen) |
| Operator-Löschung (Praxis/Nutzer/Sitzung) | ✅ | Phase D4, Dry-Run-Default + Produktionsschutz |
| Aufbewahrungs-Purge (manuell) | ⚠️ | Phase D5, manuell; kein automatischer Cron; Frist durch DSB festzulegen |

---

## 9. Trennung Entwicklung / Staging / Produktion

| Maßnahme | Status | Hinweis |
|----------|--------|---------|
| Getrennte Umgebungen | ☐ zu bestätigen | Render/Vercel-Projekte dokumentieren |
| CI nutzt nur lokale Service-Container | ✅ | GitHub Actions: PostgreSQL-Container, keine Prod-Secrets |
| Operator-Skripte verweigern Produktions-DB | ✅ | `PRODUCTION_INDICATORS`-Guard (D4/D5) |

---

## 10. Feature-Flags & sichere Standardwerte

| Maßnahme | Status | Hinweis |
|----------|--------|---------|
| `ENABLE_BILLING_PLAUSIBILITY` | ✅ | Standard `false`; gezielt aktivierbar |
| `ENABLE_BILLING_AI_REVIEW` | ✅ | Standard `false`; extern deaktiviert |
| Doppelte Gate-Logik für KI | ✅ | KI erfordert zusätzlich das Basis-Flag |
| `ENABLE_PVS_PRODUCTION` | ✅ | Standard `false` — keine produktive PVS-Anbindung |

---

## 11. KI — extern deaktiviert (Standard)

- KI-Review ist für externe Praxen **deaktiviert** und bleibt deaktiviert bis zur
  Erfüllung der Vorbedingungen (AVV §15).
- Es werden **keine** Patientenidentifikatoren an OpenAI gesendet; nur Abrechnungs-
  felder und (falls aktiviert) `contextText` (max. 500 Zeichen).
- KI-Ausgaben sind nicht rechtsverbindlich, werden vor Speicherung auf verbotene
  Inhalte geprüft und fallen bei Fehlern sicher auf die deterministischen Ergebnisse
  zurück.

---

## 12. Operator-Skripte — Sicherheitsmerkmale

| Skript | Schutz |
|--------|--------|
| `eraseBillingPlausibilityData.js` (D4) | Dry-Run-Default, Produktions-Guard, Pflicht-Scope, Batch-Limit |
| `purgeBillingPlausibilitySessions.js` (D5) | Dry-Run-Default, Produktions-Guard, Pflicht-`--days`, Batch-Limit, Transaktion |

Beide drucken **niemals** `contextText` oder andere sensible Freitexte.

---

## 13. Keine produktive PVS/FHIR/KIS-Integration

- PVS-/FHIR-/HL7-Konnektoren sind **Sandbox-only** und produktiv deaktiviert
  (`ENABLE_PVS_PRODUCTION=false`). Eine produktive Anbindung erfordert eine gesonderte
  Vereinbarung, Vendor-Vertrag, Testsystem und Sicherheitsprüfung.

---

## 14. Offene / zu bestätigende Punkte

- Hosting-/DB-Provider, Verschlüsselung at-rest, Backups, Umgebungstrennung, TLS-Edge
  und Passwortverfahren sind vom Betreiber verbindlich auszufüllen (`☐ zu bestätigen`).
- Diese TOM-Liste ist ein **Entwurf** und vor Unterzeichnung rechtlich/technisch zu
  verifizieren.

---

*Status: **ENTWURF — rechtliche Prüfung vor Unterzeichnung erforderlich.** Anhang zum
[AVV-Entwurf](avv-dpa-medscoutx-pilot.de.md).*
