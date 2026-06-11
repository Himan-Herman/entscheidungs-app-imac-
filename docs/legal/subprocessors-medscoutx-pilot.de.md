# Unterauftragsverarbeiter (Subprozessoren) — ENTWURF

## Anhang zum AVV — GOÄ/PKV-Abrechnungsplausibilität (Pilot)

> ⚠️ **ENTWURF — RECHTLICHE PRÜFUNG VOR UNTERZEICHNUNG ERFORDERLICH.**
> **Keine Rechtsberatung.** Diese Liste nennt **mögliche** Subprozessoren. Tatsächlich
> eingesetzte Anbieter, Standorte und Garantien sind vom Betreiber verbindlich zu
> bestätigen. Nicht bestätigte Angaben sind als **„zu bestätigen"** markiert und
> dürfen **nicht** erfunden werden.
>
> *English note: Draft subprocessor list (Art. 28(2)/(4) GDPR). Entries marked
> "zu bestätigen / to be confirmed" must be verified by the operator and not invented.
> NOT legal advice.*

---

## 1. Subprozessoren-Tabelle

| Anbieter | Zweck | Standort / Datenregion | Status im Pilot | Anmerkung |
|----------|-------|------------------------|-----------------|-----------|
| `«Hosting-/Compute-Provider»` (z. B. Render o. ä.) | Betrieb der Backend-API | ☐ zu bestätigen | eingesetzt (zu bestätigen) | Vertrag/AVV mit Provider erforderlich |
| `«Datenbank-/Hosting-Provider»` (Managed PostgreSQL) | Speicherung der Sitzungsdaten | ☐ zu bestätigen | eingesetzt (zu bestätigen) | EU/EEA-Region bevorzugt; bestätigen |
| `«Frontend-Hosting»` (z. B. Vercel o. ä.) | Auslieferung der Web-App (statisch) | ☐ zu bestätigen | eingesetzt (zu bestätigen) | verarbeitet i. d. R. keine Billing-Inhalte serverseitig |
| **OpenAI** | optionales KI-Review (Plausibilitätshinweise) | außerhalb EU/EEA (zu bestätigen) | **DEAKTIVIERT (Standard)** | nur relevant bei `ENABLE_BILLING_AI_REVIEW=true`; siehe §2 |
| `«E-Mail-Provider»` (z. B. Resend o. ä.) | transaktionale E-Mails | ☐ zu bestätigen | nur falls genutzt | für Billing-Modul i. d. R. nicht erforderlich |
| `«Analytics-Provider»` | Nutzungsanalyse | ☐ zu bestätigen | nur falls genutzt | für Billing-Modul: möglichst nicht einsetzen |

---

## 2. OpenAI — nur bei aktiviertem KI-Review

- Im **Standard-Pilot** ist das KI-Review **deaktiviert**; OpenAI ist dann **kein**
  Subprozessor und es werden **keine** Daten an OpenAI übermittelt.
- Eine Aktivierung erfordert (siehe AVV §15):
  1. Aufnahme von OpenAI als Subprozessor in den AVV
  2. Offenlegung gegenüber der Praxis und deren Zustimmung
  3. dokumentierte DSGVO-Rechtsgrundlage für die KI-Verarbeitung
  4. abgeschlossene Datenübermittlungs-Folgenabschätzung (Drittland)
  5. bestätigte OpenAI-Datenaufbewahrungs-/Löschrichtlinie für Prompt-Inhalte
- Bei Aktivierung würden ausschließlich Abrechnungsfelder und ggf. `contextText`
  (max. 500 Zeichen) übermittelt — **niemals** Patientenidentifikatoren.

---

## 3. Verfahren bei Änderung von Subprozessoren

- Der Auftragsverarbeiter informiert den Verantwortlichen **vor** Hinzunahme oder
  Austausch eines Subprozessors (Art. 28 Abs. 2 DSGVO).
- Der Verantwortliche kann aus berechtigtem Grund widersprechen.
- Mit jedem Subprozessor wird ein AVV mit gleichwertigen Schutzpflichten geschlossen
  (Art. 28 Abs. 4 DSGVO).

---

## 4. Offene Punkte

- Sämtliche konkreten Anbieter, Datenregionen und Standardvertragsklauseln (SCC) für
  etwaige Drittlandübermittlungen sind **vor** dem externen Pilot zu bestätigen.
- Diese Liste ist ein **Entwurf** und ersetzt keine rechtliche Prüfung.

---

*Status: **ENTWURF — rechtliche Prüfung vor Unterzeichnung erforderlich.** Anhang zum
[AVV-Entwurf](avv-dpa-medscoutx-pilot.de.md).*
