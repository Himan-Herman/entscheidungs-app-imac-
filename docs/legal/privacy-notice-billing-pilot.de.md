# Datenschutzhinweis — GOÄ/PKV-Abrechnungsplausibilität (Pilot) — ENTWURF

> ⚠️ **ENTWURF — RECHTLICHE PRÜFUNG VOR VERÖFFENTLICHUNG ERFORDERLICH.**
> Dieser Datenschutzhinweis ist ein **Entwurf** und **keine Rechtsberatung**. Er ist
> **nicht** rechtsverbindlich und **nicht** final. Vor einer Veröffentlichung (z. B.
> Aufnahme in die Datenschutzerklärung) ist eine unabhängige Prüfung durch eine:n
> Datenschutzbeauftragte:n und/oder Rechtsanwält:in zwingend erforderlich. Platzhalter
> in `«spitzen Klammern»` sind vor der Veröffentlichung auszufüllen.
>
> *English note: DRAFT privacy notice for the German billing plausibility pilot. NOT
> legal advice, NOT final. Independent legal/DPO review is required before publication.
> German is the master version.*
>
> Begleitdokumente: [AVV/DPA-Entwurf](avv-dpa-medscoutx-pilot.de.md) ·
> [TOM](tom-medscoutx-pilot.de.md) ·
> [Subprozessoren](subprocessors-medscoutx-pilot.de.md) ·
> [Datenschutzdokument](../billing-plausibility-data-protection.md)

---

## 1. Verantwortlicher / Auftragsverarbeiter

- **Praxis (Verantwortliche:r):** `«Praxisname, Anschrift, Kontakt»` — verantwortlich
  für die im Pilot eingegebenen Abrechnungs- und Kontextdaten im jeweiligen
  Praxiskontext.
- **MedScoutX (Auftragsverarbeiter):** `«Betreibergesellschaft, Anschrift, Kontakt»` —
  verarbeitet die Daten **im Auftrag und auf Weisung** der Praxis auf Grundlage eines
  Auftragsverarbeitungsvertrags (AVV, siehe [Entwurf](avv-dpa-medscoutx-pilot.de.md)).
- **Datenschutzkontakt:** `«E-Mail / DSB, falls benannt»`
- Die endgültige rollenrechtliche Einordnung (Verantwortlicher/Auftragsverarbeiter je
  Verarbeitungsschritt) ist im Rahmen der rechtlichen Prüfung zu bestätigen.

---

## 2. Zwecke der Verarbeitung

- Unterstützung bei der **Abrechnungsplausibilität** (GOÄ/PKV)
- Erzeugung **deterministischer Hinweise/Warnungen** zu Ziffern und Faktoren
- Erstellung eines **PDF-Berichts**
- Unterstützung von **Export, Löschung und Aufbewahrung** (Betroffenenrechte)
- **interne Protokollierung, Audit und Sicherheit**

---

## 3. Kategorien personenbezogener Daten

- Konto-/Personalkennungen (z. B. `createdByUserId`, `actorUserId`)
- Praxisprofil-Kennungen (`practiceProfileId`)
- GOÄ-Ziffer, Faktor, Anzahl
- optionaler, von Nutzer:innen eingegebener **Freitext-Kontext** (`contextText`)
- Warn-/Ergebnis-Metadaten
- Katalog-Treffer-Metadaten
- PDF-Bericht-Metadaten
- Audit-Log-Metadaten
- technische Logs
- **KI-Review-Metadaten** — nur, falls KI intern aktiviert ist (extern standardmäßig
  deaktiviert, siehe §5)

---

## 4. Daten, die NICHT eingegeben werden dürfen

In das Modul — insbesondere in das Freitextfeld `contextText` — dürfen **keine**
Patientenidentifikatoren eingegeben werden, insbesondere nicht:

- Patientenname
- Geburtsdatum
- Versichertennummer
- vollständiger Diagnosetext
- klinischer Freitext
- sonstige direkte Patientenidentifikatoren

Benannte Patientenfelder werden vom System abgewiesen (HTTP 400). Das Freitextfeld kann
technisch nicht erzwingen, dass keine Patientendaten eingegeben werden — die Praxis
stellt dies durch **Schulung** sicher.

---

## 5. KI-Status

- Das KI-gestützte Review ist für externe Praxen **standardmäßig deaktiviert**
  (`ENABLE_BILLING_AI_REVIEW=false`).
- KI wird **nur intern/im Staging** und nur nach gesonderter Vereinbarung genutzt.
- Eine spätere Aktivierung erfordert OpenAI als offengelegten Subprozessor, eine
  dokumentierte Rechtsgrundlage und eine Datenübermittlungs-Folgenabschätzung
  (siehe AVV §15).
- KI-Ausgaben sind **nicht rechtsverbindlich** und stellen **keine** medizinische,
  rechtliche oder erstattungsbezogene Entscheidung dar.

---

## 6. Rechtsgrundlagen (Platzhalter)

- **Für die Praxis (Verantwortliche:r):** Rechtsgrundlage `«von Praxis/Recht zu
  bestätigen»` — voraussichtlich Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) oder
  berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO).
- **Für MedScoutX (Auftragsverarbeiter):** Verarbeitung auf Grundlage des AVV und der
  Weisungen der Praxis.
- Eine endgültige Festlegung der Rechtsgrundlage erfolgt erst nach rechtlicher Prüfung;
  dieser Entwurf trifft **keine** verbindliche Aussage.

---

## 7. Empfänger / Subprozessoren

- Hosting-/Compute-Provider: `«zu bestätigen»`
- Datenbank-/Hosting-Provider: `«zu bestätigen»`
- E-Mail-Provider: `«zu bestätigen, falls genutzt»`
- **OpenAI:** nur falls KI aktiviert ist (extern standardmäßig deaktiviert)
- Details: [Subprozessoren-Anhang](subprocessors-medscoutx-pilot.de.md). Nicht
  bestätigte Anbieter sind als „zu bestätigen" markiert und werden nicht erfunden.

---

## 8. Aufbewahrung und Löschung

- **Aufbewahrungsfrist:** Empfehlung **180 Tage** (`BILLING_SESSION_RETENTION_DAYS=180`,
  Richtwert) — final durch Praxis/DSB festzulegen. Es läuft **kein automatischer**
  Löschjob; die Aufbewahrung wird über ein manuelles Purge-Skript durchgesetzt (D5).
- **Konto-Löschung:** Bei vollständiger Kontolöschung werden zugehörige Billing-Daten in
  derselben Transaktion gelöscht (D2).
- **Operator-Löschung:** gezielte Löschung pro Praxis/Nutzer/Sitzung über ein
  Operator-Skript mit Dry-Run und Produktionsschutz (D4).
- **Export:** datenschutzfreundlicher JSON-Export der eigenen Sitzungsdaten (D3; roher
  `contextText` ausgeschlossen).

---

## 9. Rechte der betroffenen Personen

Sie haben — vorbehaltlich der gesetzlichen Voraussetzungen — folgende Rechte:

- Auskunft (Art. 15 DSGVO)
- Berichtigung (Art. 16)
- Löschung (Art. 17)
- Einschränkung der Verarbeitung (Art. 18)
- Datenübertragbarkeit (Art. 20)
- Widerspruch, soweit anwendbar (Art. 21)
- Beschwerde bei einer Aufsichtsbehörde (Art. 77)

Kontakt zur Ausübung: `«Kontakt Verantwortlicher / Datenschutzkontakt»`.

---

## 10. Sicherheit

- Zugriffskontrolle und rollenbasierter Praxiszugriff (nur Inhaber:in/Admin)
- Verschlüsselung in der Übertragung (TLS, providerseitig zu bestätigen)
- Audit-Logs für Sitzungs-Lebenszyklus-Ereignisse
- Operator-Skripte mit Dry-Run-Default und Produktions-Guard
- **keine** produktive PVS-/FHIR-/KIS-Anbindung ohne gesonderte Freigabe
- weitere Details: [TOM-Anhang](tom-medscoutx-pilot.de.md)

---

## 11. Umfang und Grenzen des Moduls

- **nicht rechtsverbindliche** Plausibilitätsunterstützung
- Nutzung eines **lokalen GOÄ-Teilkatalogs** (keine vollständige amtliche Quelle)
- **keine** Diagnose
- **keine** Therapieempfehlung
- **keine** Triage
- **keine** Erstattungsgarantie / -vorhersage
- **keine** rechtsverbindliche Abrechnungsentscheidung

---

*Status: **ENTWURF — rechtliche Prüfung vor Veröffentlichung erforderlich.** Deutsche
Master-Version. Nicht-deutsche Fassungen sind Übersetzungsentwürfe.*
