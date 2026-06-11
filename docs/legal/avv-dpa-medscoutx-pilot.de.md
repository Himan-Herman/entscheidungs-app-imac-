# Auftragsverarbeitungsvertrag (AVV) — ENTWURF

## GOÄ/PKV-Abrechnungsplausibilität — geschlossener Pilotbetrieb

> ⚠️ **ENTWURF — RECHTLICHE PRÜFUNG VOR UNTERZEICHNUNG ERFORDERLICH.**
> Dieses Dokument ist ein **technischer Vertragsentwurf** und stellt **keine
> Rechtsberatung** dar. Es ist **nicht** rechtsverbindlich und **nicht** final.
> Vor jeder Unterzeichnung ist eine unabhängige Prüfung durch eine:n
> Datenschutzbeauftragte:n und/oder Rechtsanwält:in zwingend erforderlich.
> Platzhalter in `«spitzen Klammern»` sind vor der Prüfung auszufüllen.
>
> *English note: This is a DRAFT data processing agreement (Art. 28 GDPR) for a
> closed German pilot. It is NOT legal advice and NOT final. Independent legal/DPO
> review is required before signature. Drafted German-first because the first pilot
> is expected in Germany.*

---

## 1. Vertragsparteien

**Verantwortlicher (Controller)** — im Sinne von Art. 4 Nr. 7 DSGVO:

| Feld | Angabe |
|------|--------|
| Name der Praxis / Klinik / MVZ | `«Praxisname»` |
| Anschrift | `«Straße, PLZ, Ort»` |
| Vertretungsberechtigte Person | `«Name, Funktion»` |
| Datenschutzbeauftragte:r (falls vorhanden) | `«Name / Kontakt oder „nicht benannt"»` |
| Kontakt-E-Mail | `«E-Mail»` |

**Auftragsverarbeiter (Processor)** — im Sinne von Art. 4 Nr. 8 DSGVO:

| Feld | Angabe |
|------|--------|
| Anbieter / Betreiber | `«MedScoutX Betreibergesellschaft»` |
| Anschrift | `«Straße, PLZ, Ort»` |
| Vertretungsberechtigte Person | `«Name, Funktion»` |
| Datenschutzkontakt | `«E-Mail»` |

---

## 2. Pilot-Eckdaten (Platzhalter)

| Feld | Angabe |
|------|--------|
| Pilot-Beginn | `«TT.MM.JJJJ»` |
| Pilot-Ende | `«TT.MM.JJJJ»` |
| Aktivierte Module | GOÄ/PKV-Abrechnungsplausibilität (deterministisch) |
| KI-Review aktiviert? | **Nein (Standard)** — `ENABLE_BILLING_AI_REVIEW=false` |
| Anzahl Nutzer:innen | `«n»` |
| Aufbewahrungsfrist | `«z. B. 180 Tage»` (siehe §11) |

> Eine Aktivierung des KI-Reviews ist nur nach **gesonderter schriftlicher
> Vereinbarung** und nach Erfüllung der KI-Vorbedingungen (siehe §15) zulässig.

---

## 3. Gegenstand und Dauer der Verarbeitung

**Gegenstand:** Bereitstellung einer automatisierten, **nicht rechtsverbindlichen**
Plausibilitätsprüfung für GOÄ-Leistungsziffern (Abrechnungsunterstützung) im Rahmen
eines geschlossenen Pilotbetriebs.

**Dauer:** Für die Laufzeit des Pilotbetriebs (§2) bzw. bis zur Kündigung. Nach
Pilot-Ende richtet sich die Löschung/Rückgabe nach §11.

---

## 4. Art und Zweck der Verarbeitung

Der Auftragsverarbeiter verarbeitet personenbezogene Daten ausschließlich zur
Erbringung der vereinbarten Leistung:

- Speicherung der vom Verantwortlichen eingegebenen GOÄ-Ziffern, Faktoren und Anzahl
- deterministische Plausibilitätsprüfung gegen einen lokalen GOÄ-Teilkatalog
- Erzeugung eines PDF-Berichts mit Plausibilitätshinweisen
- Speicherung optionaler Freitext-Kontextnotizen (`contextText`)
- Führung eines Audit-Protokolls über Sitzungs-Lebenszyklus-Ereignisse

**Keine** eigenständige medizinische, diagnostische oder abrechnungsrechtliche
Entscheidung durch den Auftragsverarbeiter (siehe §13).

---

## 5. Kategorien personenbezogener Daten

| Kategorie | Beispiel | Hinweis |
|-----------|----------|---------|
| Abrechnungsstammdaten | GOÄ-Ziffer, Faktor, Anzahl | keine Patientenidentifikatoren |
| Praxis-/Nutzerkennungen | `practiceProfileId`, `createdByUserId`, `actorUserId` | identifiziert Praxis und Personal |
| Freitext-Kontext (`contextText`) | „komplexe Nachsorge" | ⚠ kann bei Fehleingabe Patientendaten enthalten — siehe §6 |
| Protokoll-Metadaten | Aktion, Zeitstempel | keine Patientenidentifikatoren |

**Vom System abgewiesen** (HTTP 400): `patientName`, `dateOfBirth`, `diagnosisText`,
`clinicalNotes`, `icd10`, Versichertennummer und vergleichbare Felder.

---

## 6. Kategorien betroffener Personen

- Praxispersonal / abrechnende Mitarbeitende (als Nutzer:innen des Moduls)
- mittelbar: Patient:innen **nur** dann, wenn Personal — entgegen den Hinweisen —
  Patientendaten in das Freitextfeld `contextText` einträgt. Der Verantwortliche
  stellt durch Schulung sicher, dass dies unterbleibt.

---

## 7. Weisungen des Verantwortlichen

- Die Verarbeitung erfolgt ausschließlich auf dokumentierte Weisung des
  Verantwortlichen (Art. 28 Abs. 3 lit. a DSGVO).
- Dieser Vertrag und die Konfiguration der Feature-Flags gelten als
  Erstweisung. Weitere Weisungen erfolgen in Textform an `«Datenschutzkontakt»`.
- Der Auftragsverarbeiter informiert den Verantwortlichen unverzüglich, wenn er
  eine Weisung für datenschutzrechtswidrig hält (Art. 28 Abs. 3 Satz 3 DSGVO).

---

## 8. Vertraulichkeit

- Der Auftragsverarbeiter verpflichtet die zur Verarbeitung befugten Personen zur
  Vertraulichkeit (Art. 28 Abs. 3 lit. b, Art. 29, Art. 32 Abs. 4 DSGVO), sofern sie
  nicht bereits einer gesetzlichen Verschwiegenheitspflicht unterliegen.
- Der Zugriff ist auf das für die Leistungserbringung notwendige Personal beschränkt
  (Least-Privilege; siehe TOM-Anhang).

---

## 9. Technische und organisatorische Maßnahmen (TOM)

Die TOM gemäß Art. 32 DSGVO sind im Anhang
**[`tom-medscoutx-pilot.de.md`](tom-medscoutx-pilot.de.md)** beschrieben und sind
Bestandteil dieses Vertrags. Der Auftragsverarbeiter hält sie während der gesamten
Laufzeit ein und passt sie dem Stand der Technik an.

---

## 10. Unterauftragsverarbeiter (Subprozessoren)

- Der Einsatz von Subprozessoren bedarf der vorherigen Information des
  Verantwortlichen; dieser kann begründet widersprechen (Art. 28 Abs. 2 DSGVO).
- Die aktuell vorgesehenen / möglichen Subprozessoren sind im Anhang
  **[`subprocessors-medscoutx-pilot.de.md`](subprocessors-medscoutx-pilot.de.md)**
  gelistet.
- **OpenAI** ist nur dann Subprozessor, wenn das KI-Review aktiviert wird. Im
  Pilot-Standard ist es **deaktiviert** und damit **kein** Subprozessor. Eine
  Aktivierung erfordert eine gesonderte Vereinbarung (siehe §15).

---

## 11. Löschung / Rückgabe nach Pilot-Ende

Nach Beendigung des Pilotbetriebs werden die verarbeiteten Daten nach Wahl des
Verantwortlichen gelöscht oder zurückgegeben (Art. 28 Abs. 3 lit. g DSGVO):

- **Export / Rückgabe:** datenschutzfreundlicher JSON-Export der Sitzungsdaten ist
  über die Kontofunktion verfügbar (Phase D3; `getBillingPlausibilityExportForUser`).
- **Löschung Konto:** vollständige Konto-Löschung entfernt zugehörige Billing-Daten
  in derselben Transaktion (Phase D2).
- **Operator-Löschung:** gezielte Löschung pro Praxis/Nutzer/Sitzung über das
  Operator-Skript `eraseBillingPlausibilityData.js` (Phase D4).
- **Aufbewahrung/Purge:** Löschung nach Ablauf der vereinbarten Aufbewahrungsfrist
  (§2) über das manuelle Purge-Skript `purgeBillingPlausibilitySessions.js` (Phase D5).
  Empfohlene Frist: 180 Tage, **vorbehaltlich Festlegung durch den Verantwortlichen /
  DSB**. Es läuft **kein automatischer** Löschjob.

Die Löschung wird dem Verantwortlichen auf Anforderung bestätigt.

---

## 12. Unterstützung des Verantwortlichen

- **Betroffenenrechte (Art. 28 Abs. 3 lit. e):** Der Auftragsverarbeiter unterstützt
  bei Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17) und
  Datenübertragbarkeit (Art. 20) durch die vorhandenen Export-/Löschfunktionen
  (D2–D5).
- **Pflichten Art. 32–36 (lit. f):** Unterstützung bei Datensicherheit,
  Meldepflichten und Datenschutz-Folgenabschätzung im Rahmen des Zumutbaren.

---

## 13. Keine eigenständige fachliche Entscheidung

Der Auftragsverarbeiter trifft **keine** eigenständige medizinische, diagnostische,
therapeutische, triagebezogene, erstattungs- oder abrechnungsrechtliche Entscheidung.

Das GOÄ/PKV-Modul liefert **ausschließlich nicht rechtsverbindliche
Plausibilitätshinweise**. Es ersetzt **nicht** die Prüfung durch qualifiziertes
Abrechnungspersonal. Der verwendete GOÄ-Katalog ist ein **lokaler Teilkatalog** und
keine vollständige, amtlich validierte Quelle; nicht gefundene Ziffern erfordern eine
Verifikation anhand des aktuellen amtlichen GOÄ-Textes.

---

## 14. Audit und Kontrolle

- Der Verantwortliche ist berechtigt, die Einhaltung dieses Vertrags zu überprüfen
  (Art. 28 Abs. 3 lit. h DSGVO), auch durch beauftragte Prüfer:innen.
- Der Auftragsverarbeiter stellt auf Anforderung die einschlägige Dokumentation bereit
  (u. a. Datenschutzdokument, Compliance-Checkliste, Betriebs-Runbook) und kooperiert
  bei Audits in zumutbarem Umfang.

---

## 15. KI-Review — extern deaktiviert

- Das KI-gestützte Review (`ENABLE_BILLING_AI_REVIEW`) ist im externen Pilotbetrieb
  **standardmäßig deaktiviert** und darf für externe Praxen **nicht** aktiviert werden,
  bevor **alle** folgenden Punkte erfüllt und gesondert schriftlich vereinbart sind:
  1. OpenAI als Subprozessor in den AVV aufgenommen und offengelegt
  2. Praxis darüber informiert, dass `contextText` an OpenAI übermittelt werden kann
  3. DSGVO-Rechtsgrundlage für die KI-Verarbeitung dokumentiert
  4. Datenübermittlungs-Folgenabschätzung (Drittland) abgeschlossen
  5. OpenAI-Datenaufbewahrungs-/Löschrichtlinie für Prompt-Inhalte bestätigt
- Solange diese Bedingungen nicht erfüllt sind, bleibt der deterministische Pfad
  (`ENABLE_BILLING_AI_REVIEW=false`) maßgeblich. Siehe
  [`docs/billing-ai-staging-checklist.md`](../billing-ai-staging-checklist.md).

---

## 16. Meldung von Datenschutzverletzungen

- Der Auftragsverarbeiter meldet dem Verantwortlichen eine ihm bekannt gewordene
  Verletzung des Schutzes personenbezogener Daten **unverzüglich** nach Bekanntwerden
  (Art. 33 Abs. 2 DSGVO), in der Regel innerhalb von `«z. B. 24»` Stunden, an
  `«Kontakt Verantwortlicher»`.
- Die Meldung enthält im zumutbaren Umfang Art, betroffene Datenkategorien,
  wahrscheinliche Folgen und ergriffene/vorgeschlagene Maßnahmen.
- Das operative Vorgehen ist im Runbook (Incident-Checklisten) beschrieben.

---

## 17. Schlussbestimmungen (Entwurf)

- Änderungen bedürfen der Textform.
- Bei Widersprüchen zwischen diesem Vertrag und den Anhängen (TOM, Subprozessoren)
  gilt vorrangig der Hauptvertrag, sofern nicht ausdrücklich anders geregelt.
- Es gilt deutsches Recht; Gerichtsstand `«Ort»` (vorbehaltlich rechtlicher Prüfung).

---

## 18. Unterschriften (Platzhalter)

| Verantwortlicher (Praxis) | Auftragsverarbeiter (MedScoutX) |
|---------------------------|----------------------------------|
| Ort, Datum: `«____________»` | Ort, Datum: `«____________»` |
| Name: `«____________»` | Name: `«____________»` |
| Funktion: `«____________»` | Funktion: `«____________»` |
| Unterschrift: `«____________»` | Unterschrift: `«____________»` |

---

*Status: **ENTWURF — rechtliche Prüfung vor Unterzeichnung erforderlich.** Es existiert
zu diesem Zeitpunkt **kein** unterzeichneter AVV. Dieses Dokument ist eine Vorlage zur
Vorbereitung eines kleinen geschlossenen Pilotbetriebs in Deutschland.*

*Begleitdokumente: [TOM-Anhang](tom-medscoutx-pilot.de.md) ·
[Subprozessoren-Anhang](subprocessors-medscoutx-pilot.de.md) ·
[Pilot-Praxis-Datenblatt](pilot-practice-data-sheet.de.md)*
