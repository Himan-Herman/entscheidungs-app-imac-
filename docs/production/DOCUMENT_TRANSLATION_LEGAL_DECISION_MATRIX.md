# Dokumenttransformation — Entscheidungsmatrix

> **Arbeitsdokument. Keine Rechtsberatung, keine Freigabe, keine Aktivierung.**
> Es trifft keine einzige rechtliche Entscheidung. Es stellt jede offene Frage so
> zusammen, dass sie entschieden werden *kann*, und hält fest, was nach jeder
> möglichen Antwort technisch zu tun wäre.
>
> **Enthält keine Patientendaten, keine Zugangsdaten, keine Schlüssel.**

**Letzte Aktualisierung:** 2026-09-18 — A3–A13 neu klassifiziert (§7).

**Technischer Stand:** `TECHNICAL IMPLEMENTATION = COMPLETE` ·
`INTERNAL ENGINEERING GAPS = NONE` · beide Feature-Flags aus ·
`APPROVED_PROVIDER_HOSTS` leer · **`NO-GO FOR PRODUCTION ACTIVATION`**

**Begleitdokumente:**
[Evidence Register](DOCUMENT_TRANSLATION_EVIDENCE_REGISTER.md) (Status je Anforderung) ·
[Legal Review Packet](DOCUMENT_TRANSLATION_LEGAL_REVIEW_PACKET.md) (ausführliche Sachverhaltsdarstellung) ·
[Activation Checklist](DOCUMENT_TRANSLATION_ACTIVATION_CHECKLIST.md) (technisches Freigabetor) ·
[DSFA-Entwurf](DOCUMENT_TRANSLATION_DPIA_DRAFT.md) ·
[Betroffenenrechte-Runbook](DOCUMENT_TRANSLATION_DATA_SUBJECT_RIGHTS_RUNBOOK.md)

Das Legal Review Packet beschreibt den Sachverhalt **ausführlich**. Dieses
Dokument ist die **kompakte** Gegenstückseite: eine Zeile je Entscheidung, mit
den Folgen. Wo beide dasselbe behandeln, ist das Packet die Quelle.

---

## 1. Wie dieses Dokument zu lesen ist

Drei Markierungen, und sie bedeuten verschiedene Dinge:

| Markierung | Bedeutung |
|---|---|
| `LEGAL DECISION REQUIRED` | Eine juristische Festlegung fehlt. Keine Technik kann sie ersetzen. |
| `PROVIDER EVIDENCE REQUIRED` | Ein Dritter muss etwas belegen. Ausbleibende Antwort ist **kein** Beleg. |
| `PREPARED` | Intern fertig vorbereitet; nach der Entscheidung ist nur noch die passende Variante einzusetzen. |

**Schweigen ist keine Zustimmung.** Die Provider-Anfrage vom 2026-08-17 zu
Datenresidenz und Zero Retention wurde nie beantwortet. Diese Punkte sind
deshalb *deferred*, nicht *erledigt* — siehe §7.

---

## 2. Entscheidungsmatrix

Zehn Blöcke. Je Block: die genaue Frage, die technische Realität (belegt, nicht
vermutet), die verfügbaren Optionen, die benötigte Entscheidung, und was davon
abhängt.

### 2.1 Rollen

| | |
|---|---|
| **Frage** | Wer ist Verantwortlicher für die patienteninitiierte Transformation eines Praxisdokuments — die Praxis, MedScoutX, oder beide gemeinsam? |
| **Technische Realität** | Den Inhalt hat die **Praxis** erstellt und dem Patienten freigegeben. Ausgelöst wird die Transformation vom **Patienten** in der B2C-App. MedScoutX entscheidet über Mittel und Zwecke der Transformation (Modellwahl, Maskierung, Prompt, Anbieter); die Praxis ist daran nicht beteiligt und erfährt heute nichts davon. |
| **Der Konflikt** | Die **Live-Datenschutzerklärung** nennt MedScoutX als *Verantwortlichen* für die App. Der **AVV-Entwurf** nennt MedScoutX als *Auftragsverarbeiter* der Praxis. Beide Aussagen stehen heute nebeneinander, und diese Funktion liegt genau auf der Naht. |
| **Optionen** | (a) MedScoutX = eigener Verantwortlicher für diesen optionalen Patientendienst · (b) MedScoutX = Auftragsverarbeiter der Praxis · (c) gemeinsame Verantwortlichkeit Art. 26 |
| **Benötigt** | `LEGAL DECISION REQUIRED` |
| **Davon abhängig** | B1 §1/§6, B2 (AVV + Subprozessorliste), B4, B7, Praxisinformation, DSFA §Verantwortlicher |

### 2.2 Rechtsgrundlage Art. 6

| | |
|---|---|
| **Frage** | Auf welche Rechtsgrundlage stützt sich die Verarbeitung personenbezogener Daten? |
| **Technische Realität** | Der Patient löst bewusst aus (expliziter Button, kein Auto-Start, kein Vorbelegen). Ohne Nutzung passiert nichts. Das Original bleibt unverändert und ohne die Funktion vollständig nutzbar. |
| **Optionen** | Art. 6 (1)(a) Einwilligung · (b) Vertrag · (f) berechtigtes Interesse — jeweils mit eigenen Folgepflichten |
| **Benötigt** | `LEGAL DECISION REQUIRED` |
| **Davon abhängig** | alles Weitere; ohne diese Festlegung ist keine Aktivierung möglich |

### 2.3 Gesundheitsdaten Art. 9

| | |
|---|---|
| **Frage** | Auf welche Ausnahme nach Art. 9 (2) wird die Verarbeitung besonderer Kategorien gestützt? |
| **Technische Realität** | Übertragen wird der **Textinhalt eines medizinischen Dokuments**. Maskierung reduziert Identifikatoren erheblich, ist aber **ausdrücklich keine Anonymisierung**: Re-Identifikation über seltene Diagnosen, Kontext oder genannte Einrichtungen bleibt möglich. Es ist daher Verarbeitung personenbezogener Gesundheitsdaten. |
| **Optionen** | Art. 9 (2)(a) ausdrückliche Einwilligung · (h) Gesundheitsversorgung · andere |
| **Benötigt** | `LEGAL DECISION REQUIRED` |
| **Davon abhängig** | B3 (Consent ja/nein), B1 §5, B7, A1a |

### 2.4 Einwilligung ja/nein

| | |
|---|---|
| **Frage** | Ist eine ausdrückliche, nachweisbare Einwilligung erforderlich — und je Dokument oder einmalig für den Dienst? |
| **Technische Realität** | Die Consent-Infrastruktur existiert vollständig (`CONSENT_TYPES`, `assertConsentForLink`, `ConsentRecord` mit granted/revoked/expired, Patienten-UI zum Erteilen und Widerrufen). Sie wird von dieser Funktion **heute nicht** benutzt. Kein bestehender Consent-Typ deckt den Fall ab. |
| **Optionen** | Variante A (Einwilligung erforderlich) oder Variante B (andere Grundlage) — beide vollständig ausgearbeitet in §4 |
| **Benötigt** | `LEGAL DECISION REQUIRED`, folgt aus 2.2/2.3 |
| **Davon abhängig** | B3, B7, UI, Server-Enforcement, Widerrufsverhalten |

### 2.5 Vertraglicher Umfang für Gesundheitsdaten

| | |
|---|---|
| **Frage** | Deckt der ausgeführte Provider-DPA eine **absichtliche und systematische** Übermittlung von Gesundheitsdaten ab? |
| **Technische Realität** | DPA `v.010126`, beidseitig unterzeichnet 2026-08-16, Text byte-identisch zur öffentlichen Vorlage. Schedule 1 §5 bezeichnet sensible Daten als *nicht beabsichtigt, außer der Nutzer fügt sie unerwartet in unstrukturierte Daten ein*. Kein Vorkommen von „besondere Kategorien", „Gesundheit", „Artikel 9" im gesamten Vertrag. Unser Anwendungsfall überträgt sie **planmäßig**. |
| **Optionen** | (a) bestehender Rahmen genügt · (b) Ergänzung/Addendum erforderlich · (c) Anbieter für diesen Zweck ungeeignet |
| **Benötigt** | `LEGAL DECISION REQUIRED` — Einseiter für die externe Prüfung in §6 |
| **Davon abhängig** | Aktivierungsentscheidung insgesamt, B2, DSFA-Restrisiko |

### 2.6 Datenschutz-Folgenabschätzung

| | |
|---|---|
| **Frage** | Ist für diese Verarbeitung eine DSFA nach Art. 35 erforderlich? |
| **Technische Realität** | Gesundheitsdaten (Art. 9) + neue Technologie + Übermittlung an einen externen Verarbeiter + potenzielle Drittlandverarbeitung. Ein **vollständiger DSFA-Entwurf** liegt vor; Risikobewertung und Restrisiko sind darin bewusst **offen** gelassen. |
| **Optionen** | (a) erforderlich → Entwurf finalisieren und freigeben · (b) nicht erforderlich → mit Begründung dokumentieren |
| **Benötigt** | `LEGAL DECISION REQUIRED` · Vorarbeit `PREPARED` |
| **Davon abhängig** | B5, Aktivierungsentscheidung |

### 2.7 Praxisinformation

| | |
|---|---|
| **Frage** | Muss die Praxis über die Weiterverarbeitung ihres freigegebenen Dokuments informiert werden oder ihr zustimmen? |
| **Technische Realität** | Die Praxis erfährt heute **nichts** davon. Es gibt keine Anzeige, keine Benachrichtigung und keinen Zustimmungspfad auf Praxisseite. Der Audit-Datensatz trägt `practiceProfileId`, ist aber keine Mitteilung. |
| **Optionen** | (a) keine Information nötig · (b) Information · (c) Zustimmung/Opt-in der Praxis |
| **Benötigt** | `LEGAL DECISION REQUIRED`, folgt aus 2.1 |
| **Davon abhängig** | B2, Praxis-UI (heute nicht vorhanden), AVV-Anhang |

### 2.8 Patienteninformation

| | |
|---|---|
| **Frage** | Welche Informationen muss der Patient **vor** dem ersten Start erhalten? |
| **Technische Realität** | Die UI zeigt vor dem Start: Überschrift, Kurzbeschreibung, Hinweis auf deutschsprachige Quelldokumente, Sprach- und Modusauswahl. **Es gibt keinen Absatz, der sagt, was mit dem Dokument geschieht.** Nach dem Lauf: „KI-generierte Übersetzung", „Maßgeblich bleibt das Originaldokument", „ersetzt keine medizinische Beratung". |
| **Optionen** | Umfang und Rechtsgrundlagen-Nennung hängen an 2.2/2.3/2.4 |
| **Benötigt** | `LEGAL DECISION REQUIRED` für den Inhalt · Textentwurf `PREPARED` (Anhang A) |
| **Davon abhängig** | B7, B1, UI-Folgeänderung (ein Element + ein i18n-Schlüssel × 6 Sprachen) |

### 2.9 Audit und Aufbewahrung

| | |
|---|---|
| **Frage** | Ist der Audit-Datensatz auf Verlangen zu löschen, oder aufgrund einer Rechtspflicht aufzubewahren? |
| **Technische Realität** | Ein Datensatz je Transformation, die das Dokument erreicht hat — Erfolg **und** Ablehnung. Reine Formfehler erzeugen keinen. Felder: `userId`, `patientUserId`, `entityId` (Dokument), `practiceProfileId`, gehashte IP, User-Agent, technische Metadaten. **Kein** Dokumenttext, kein Ergebnis. Löschung erfolgt heute per Kaskade über `userId` bei Kontolöschung; eine eigene Frist ist **nicht** definiert. |
| **Optionen** | (a) auf Verlangen löschbar · (b) Aufbewahrung aus Rechenschaftspflicht (Art. 5 (2)) · (c) definierte Frist |
| **Benötigt** | `LEGAL DECISION REQUIRED` |
| **Davon abhängig** | B6, Runbook §Löschung, B1 §8 |

### 2.10 Internationale Verarbeitung und Empfänger

| | |
|---|---|
| **Frage** | In welcher Region wird verarbeitet, welche Übermittlungsgarantie greift, und wer ist als Empfänger zu nennen? |
| **Technische Realität** | **Heute wird nichts übermittelt** — kein Provider konfiguriert, `APPROVED_PROVIDER_HOSTS` leer, Feature aus. `DATA_REGION` und `ZERO_RETENTION` sind reine **Betreiberbehauptungen**, die der Code aufzeichnet und **nicht** verifizieren kann. Die Live-Datenschutzerklärung nennt für *eigene Eingaben* des Patienten einen US-Verarbeiter und einen Drittlandtransfer. |
| **Optionen** | abhängig von A3/A13 (§7) |
| **Benötigt** | `PROVIDER EVIDENCE REQUIRED` + `LEGAL DECISION REQUIRED` zur Bewertung |
| **Davon abhängig** | B1 §6/§7 (möglicher direkter Widerspruch), B2, DSFA, A1a |

---

## 3. B2 — Rollen, AVV und Subprozessoren: Änderungsmatrix

### 3.1 Was heute wo behauptet wird

| Dokument | Behauptete Rolle | Geltungsbereich | Deckt Dokumenttransformation? |
|---|---|---|---|
| Live-Datenschutzerklärung §1 | MedScoutX **Verantwortlicher** | die App insgesamt (B2C) | **nein** — §3/§4 listen nur eigene Eingaben des Patienten |
| `avv-dpa-medscoutx-pilot.de.md` | Praxis Verantwortliche, MedScoutX **Auftragsverarbeiter** | ausdrücklich **nur** GOÄ/PKV-Abrechnungsplausibilität | **nein** — §1 des AVV benennt allein diesen Zweck |
| `subprocessors-medscoutx-pilot.de.md` | — | AVV-Anhang, Abrechnungspilot | **nein** — §2a sagt das ausdrücklich |
| `tom-medscoutx-pilot.de.md` | — | AVV-Anhang, Abrechnungspilot | **nein** |
| `docs/legal/README.md` | — | — | schließt es ausdrücklich aus |

**Für Praxisdokumente ist bisher gar keine Rolle beschrieben.** Der bestehende
AVV umfasst nur Teilfunktionen (Abrechnung), und dort ist der externe KI-Einsatz
zudem standardmäßig deaktiviert und auf Abrechnungsfelder plus maximal 500 Zeichen
Kontext begrenzt — eine andere Datenkategorie als der Volltext eines Arztbriefs.

### 3.2 Was aufzunehmen wäre

| # | Gegenstand | Ort | Status |
|---|---|---|---|
| 1 | Zweckbeschreibung „Sprachliche Transformation freigegebener Praxisdokumente" | AVV §1 (Gegenstand) | `LEGAL DECISION REQUIRED` (2.1) |
| 2 | Datenkategorie „Textinhalt medizinischer Dokumente, potenziell Art. 9" | AVV §3 (Datenarten) | Textbaustein `PREPARED` §3.3 |
| 3 | Betroffenenkreis „Patienten der Praxis mit aktiver Verknüpfung" | AVV §3 | Textbaustein `PREPARED` |
| 4 | Aufnahme des KI-Anbieters als Subprozessor **für diesen Zweck** | Subprozessorliste §1 | `PROVIDER EVIDENCE REQUIRED` (Region, A13) |
| 5 | Datenregion und Übermittlungsgarantie | Subprozessorliste §1 | `PROVIDER EVIDENCE REQUIRED` (A3) |
| 6 | Aufbewahrung beim Subprozessor | Subprozessorliste §1 | `PROVIDER EVIDENCE REQUIRED` (A4) |
| 7 | TOM-Ergänzung: Maskierung, Segmentierung, Integritätsprüfung, Fail-closed | TOM-Anhang | Textbaustein `PREPARED` §3.3 |
| 8 | Ausdrückliche Klarstellung „Maskierung ≠ Anonymisierung" | TOM-Anhang | Textbaustein `PREPARED` §3.3 |
| 9 | Information oder Zustimmung der Praxis | AVV §15 / eigener Abschnitt | `LEGAL DECISION REQUIRED` (2.7) |
| 10 | Löschregel für Audit-Metadaten | AVV §11 | `LEGAL DECISION REQUIRED` (2.9) |

### 3.3 Vorbereitete Textbausteine

Einsetzbar **nach** der Rollenentscheidung. Sie enthalten keine unbelegte
Aussage; jede Stelle, an der ein Beleg fehlt, trägt einen Platzhalter.

> **Zweck (AVV §1, Ergänzung)**
> „Sprachliche Transformation medizinischer Dokumente, die der Verantwortliche
> dem Patienten freigegeben hat, in eine andere Sprache oder in eine
> allgemeinverständliche Fassung, auf ausdrückliche Auslösung durch den
> Patienten. Das Originaldokument bleibt unverändert und maßgeblich."

> **Datenarten (AVV §3, Ergänzung)**
> „Textinhalt freigegebener medizinischer Dokumente (Befund, Entlassungsbericht,
> Überweisung), einschließlich darin enthaltener Gesundheitsdaten im Sinne von
> Art. 9 Abs. 1 DSGVO. Kritische Werte — Medikation, Dosierung, Messwerte,
> Datumsangaben — sowie die dem Verantwortlichen bekannten Identifikatoren des
> Patienten werden vor jeder Übermittlung durch Platzhalter ersetzt."

> **TOM-Ergänzung**
> „Vor jeder Übermittlung: lokale Textextraktion in einem isolierten,
> speicherbegrenzten Prozess; deterministische Maskierung bekannter
> Patientenidentifikatoren; atomare Maskierung von Medikation und Dosierung mit
> Abbruch bei nicht absicherbarem Kontext; Segmentierung; keine Übermittlung der
> Originaldatei. Nach jeder Antwort: Integritätsprüfung auf erfundene Werte und
> verlorene Platzhalter, mit Ablehnung des Gesamtergebnisses im Fehlerfall.
> Ergebnis und Zwischenstände werden nicht gespeichert."

> **Klarstellung (TOM-Anhang, verbindlich mitzuführen)**
> „Die vorstehenden Maßnahmen reduzieren die übermittelten Identifikatoren
> erheblich. Sie bewirken **keine Anonymisierung**. Der übermittelte Text bleibt
> medizinischer Inhalt; eine Re-Identifikation über Kontext, Formulierung oder
> seltene Sachverhalte ist nicht ausgeschlossen."

> **Subprozessor-Zeile** *(erst nach A3/A13 ausfüllbar)*
> `| «Anbieter» | Sprachliche Transformation freigegebener Praxisdokumente | «Region — zu belegen, A3» | «Status» | Eigener Zweck, nicht identisch mit dem KI-Review nach §2. Aufbewahrung: «zu belegen, A4». |`

**Nicht vorbereitet und bewusst nicht erfunden:** die Rollenzuordnung selbst, die
Rechtsgrundlage, die Bewertung des Vertragsumfangs.

---

## 4. B3 — Consent: zwei vollständige Varianten

Beide sind vollständig spezifiziert. **Keine ist implementiert.** Nach der
Entscheidung ist nur noch die zutreffende einzusetzen.

### Variante A — ausdrückliche Einwilligung ist Rechtsgrundlage

| Aspekt | Umsetzung |
|---|---|
| **UI** | Einwilligungstext vor der ersten Nutzung, aktive Zustimmung (kein vorbelegtes Häkchen), Verweis auf die Datenschutzerklärung, jederzeit sichtbarer Widerrufsweg. Ohne erteilte Einwilligung ist der Start-Button gesperrt statt versteckt — der Patient soll sehen, dass es die Funktion gibt. |
| **Server-Enforcement** | Ein neuer Eintrag in `CONSENT_TYPES` und ein `assertConsentForLink(link, <typ>, ctx)` im Transformationsdienst, **unmittelbar nach dem Provenance-Gate**. Das ist die letzte Stelle, an der noch nichts gesendet ist: davor liegen nur Prüfungen, danach folgen Provider-Gate, Dateizugriff und Übermittlung. Der Aufwand ist zwei Zeilen, weil das Gate das benötigte `link`-Objekt bereits zurückgibt und der Dienst es heute nur verwirft. |
| **Widerruf** | Über die bestehende Patienten-Consent-UI. `revokeConsentRecord` setzt den Datensatz auf `revoked`; die nächste Prüfung schlägt fehl. Da **kein** Transformationsergebnis gespeichert wird, gibt es nichts zu entfernen — der Widerruf wirkt ausschließlich in die Zukunft. Offen bleibt, was mit den Audit-Metadaten geschieht (2.9). |
| **Audit** | `ConsentRecord` dokumentiert Erteilung und Widerruf mit Zeitpunkt und Akteur (bestehende Mechanik). Die Transformations-Audits bleiben unverändert. |
| **Versionierung** | `CARE_CONSENT_VERSION` und `isAllowedConsentVersion` existieren bereits. Eine neue Fassung des Einwilligungstextes erhält eine neue Version; alte Einwilligungen gelten nicht automatisch weiter. `LEGAL DECISION REQUIRED`: ob eine Textänderung eine Neueinholung erzwingt. |
| **Bestehende Consents** | **Keiner wird berührt.** Ein neuer Typ ist additiv; bestehende Einwilligungen (`document_sharing`, `ai_organizational_assistance` …) ändern ihre Bedeutung nicht und werden nicht umgedeutet. Wer nichts erteilt, hat die Funktion schlicht nicht. |
| **Wirkung auf B1** | Die Datenschutzerklärung muss die Einwilligung als Rechtsgrundlage für diese Verarbeitung benennen (§5) und den Widerrufsweg beschreiben (§Rechte). |
| **Wirkung auf B7** | Die Patienteninformation wird Teil des Einwilligungstextes und muss alle Pflichtangaben vor der Zustimmung enthalten. |

### Variante B — keine Einwilligung als Rechtsgrundlage

| Aspekt | Umsetzung |
|---|---|
| **UI** | Kein Einwilligungsdialog. Stattdessen eine **Vorabinformation an der Funktion selbst**, sichtbar vor dem ersten Start, nicht weggeklickt und nicht hinter einem Link versteckt. Genau dieses Element fehlt heute. |
| **Server-Enforcement** | Keine Consent-Prüfung. Die bestehenden Prüfungen bleiben unverändert maßgeblich: aktive Praxis-Patient-Verknüpfung, aktive Dokumentfreigabe, Typ-Allowlist, Feature-Gate. |
| **Widerruf** | Kein Widerruf im Sinne von Art. 7 (3), da keine Einwilligung. Stattdessen: Widerspruchsrecht nach Art. 21, falls die Grundlage Art. 6 (1)(f) ist — dann ist ein Weg dafür erforderlich. `LEGAL DECISION REQUIRED`. Faktisch gilt in jedem Fall: die Funktion nicht benutzen, dann findet keine Verarbeitung statt. |
| **Audit** | Unverändert. Zusätzlich zu dokumentieren wäre die Interessenabwägung nach Art. 6 (1)(f) — ein Dokument, keine Code-Änderung. |
| **Versionierung** | Versionierung des Informationstextes mit Datum, damit belegbar ist, was ein Patient zu welchem Zeitpunkt gesehen hat. |
| **Bestehende Consents** | Unberührt. **Wichtig:** Es darf nicht der Eindruck entstehen, ein bestehender Consent decke diese Verarbeitung ab. `meda_live_translation_processing` ist deklariert, aber **nirgends durchgesetzt**, und darf nicht als Grundlage herangezogen werden. |
| **Wirkung auf B1** | Die Datenschutzerklärung muss die tatsächliche Grundlage benennen und — bei Art. 6 (1)(f) — die Abwägung und das Widerspruchsrecht beschreiben. |
| **Wirkung auf B7** | Die Vorabinformation trägt die gesamte Transparenzlast. Sie muss vollständig sein, bevor irgendetwas übermittelt wird. |

### Was für beide Varianten gilt

- Der bewusste Start ist bereits umgesetzt: expliziter Button, kein Auto-Start,
  kein Vorbelegen, keine Wiederholung ohne neue Aktion.
- Das Original bleibt unverändert und ohne die Funktion vollständig nutzbar —
  die Freiwilligkeit hängt also nicht am Text, sondern an der Architektur.
- **Keine Variante wird implementiert, bevor 2.2/2.3/2.4 entschieden sind.**

---

## 5. B1 — Datenschutzerklärung: Änderungsmatrix

Quelle: `client/src/i18n/translations/legal/de/datenschutz.part1.js` und
`.part2.js` (deutsche Fassung, 21 Locales abgeleitet). **Nichts geändert.**
Status B1 = `CONFLICT`.

### ALWAYS REQUIRED — unabhängig von jeder Entscheidung

| Abschnitt | Was fehlt oder falsch ist |
|---|---|
| §3 Datenkategorien | „Textinhalt eines von der Praxis freigegebenen medizinischen Dokuments" ist keine der gelisteten Kategorien. Alle gelisteten sind **eigene Eingaben** des Patienten. |
| §4 Zwecke | Kein Zweck deckt Übersetzung oder Vereinfachung eines Praxisdokuments ab. |
| §8 Speicherfristen | Der Abschnitt sagt, MedScoutX speichere keine Gesundheitsinhalte serverseitig. Für das Ergebnis stimmt das. Der **Audit-Datensatz** ist dort gar nicht erwähnt — er ist personenbezogen und entsteht pro Transformation. |
| §14 Automatisierte Verarbeitung | Rät „Übermittle keine Namen Dritter". In diesem Ablauf **verfasst der Patient die Eingabe nicht**; ein Arztbrief enthält routinemäßig Namen Dritter (überweisende Ärztinnen, Unterzeichner). Der Rat passt nicht und wäre irreführend. |
| Transparenz zur Transformation | Dass das Ergebnis sprachlich verändert ist und das Original maßgeblich bleibt, steht in der UI, nicht in der Erklärung. |

### DEPENDS ON LEGAL DECISION

| Abschnitt | Abhängig von |
|---|---|
| §1 Verantwortlicher | 2.1 — bei Auftragsverarbeitung oder gemeinsamer Verantwortlichkeit ist §1 für diesen Ablauf unzutreffend |
| §5 Rechtsgrundlagen | 2.2 — heute wird Art. 9 (2)(a) für *„alle von dir freiwillig eingegebenen"* Daten beschrieben; Dokumentinhalt gibt der Patient nicht ein |
| Art.-9-Grundlage | 2.3 |
| Einwilligung und Widerruf | 2.4 — nur bei Variante A |
| §Rechte | 2.9 — ob Audit-Daten löschbar oder aufbewahrungspflichtig sind |
| Praxisbezug | 2.7 |

### DEPENDS ON PROVIDER EVIDENCE

| Abschnitt | Abhängig von |
|---|---|
| §6 Auftragsverarbeiter | A13/B2 — heute ist ein US-Verarbeiter für *eigene Eingaben* genannt; Dokumentinhalt ist eine andere Kategorie und möglicherweise eine andere Region |
| §7 Drittlandtransfer | A3 — die Erklärung nennt heute einen Transfer in die USA unter SCC. Stützt sich eine Aktivierung auf EU-Verarbeitung, **widersprechen sich Erklärung und Konfiguration direkt**. |
| Aufbewahrung beim Empfänger | A4/A7/A8 — providerseitige Speicherung ist **UNKNOWN** |

**Keine Formulierung wird hier vorgeschlagen.** Unreviewten Datenschutztext an
Patienten auszuspielen ist ein Rechtsakt, keine Dokumentationsänderung.

---

## 6. A1a — Einseiter für die externe Prüfung

> Zur Weitergabe an die datenschutzrechtliche Beratung. Nennt den Vertragspartner,
> weil das für die Prüfung erforderlich ist. **Nicht** für Produkttexte.

**Vertragssituation.** Zwischen MedScoutX (Einzelunternehmer Himan Khorshidi) und
OpenAI besteht ein beidseitig unterzeichnetes Data Processing Addendum, Fassung
`v.010126`, Datum 2026-08-16, als DocuSign-Umschlag mit PKCS#7-Siegel. Der Text ist
byte-identisch zur öffentlichen Vorlage; es wurde nichts verhandelt. Ein dediziertes
Projekt innerhalb derselben Organisation, die der Vertrag benennt, existiert und
wurde gegen den Vertrag abgeglichen.

**Geplanter Datenfluss.** Ein Patient löst in der MedScoutX-App die Übersetzung
oder allgemeinverständliche Fassung eines Dokuments aus, das seine Praxis ihm
zuvor freigegeben hat. Serverseitig wird der Text lokal extrahiert, maskiert und
segmentiert; die vorbereiteten Segmente werden an die Chat-Completions-Schnittstelle
des Anbieters gesendet. Übermittelt werden ausschließlich diese Textsegmente — nicht
die Datei, keine Kennungen, keine Kontodaten, keine Metadaten mit Personenbezug.
Das Ergebnis wird angezeigt und nirgends gespeichert.

**Gesundheitsdaten.** Die Segmente enthalten den Inhalt eines Arztbriefs,
Entlassungsberichts oder einer Überweisung — Diagnosen, Befunde,
Behandlungsverläufe. Das sind besondere Kategorien nach Art. 9 Abs. 1 DSGVO, und
sie werden **absichtlich und systematisch** übermittelt; das ist der Zweck der
Funktion, kein Nebeneffekt.

**Schutzmaßnahmen.** Die dem System bekannten Identifikatoren des Patienten (Name,
Geburtsdatum, Kontaktdaten, Kennnummern) werden deterministisch maskiert.
Medikation und Dosierung werden als unteilbare Einheit maskiert; ist der Kontext
nicht absicherbar, wird das gesamte Dokument abgelehnt statt übersetzt. Die
Antwort wird auf erfundene Werte und verlorene Platzhalter geprüft. Keine
Werkzeuge, kein Retrieval, keine Konversationshistorie, kein Speicherparameter.
**Diese Maßnahmen bewirken keine Anonymisierung**; eine Re-Identifikation über
Kontext oder seltene Sachverhalte bleibt möglich.

**Die Vertragsstelle, um die es geht.** Schedule 1 Nr. 5 des DPA beschreibt die
Übermittlung sensibler Daten als *nicht beabsichtigt, es sei denn, der Nutzer fügt
sie unerwartet in unstrukturierte Daten ein*. Im gesamten Vertrag kommen
„besondere Kategorien", „Gesundheitsdaten", „Artikel 9", „HIPAA", „prohibited
data" und „restricted data" nicht vor.

> **Frage:** Ist der bestehende Vertragsrahmen für die beschriebene, absichtliche
> und systematische Verarbeitung von Gesundheitsdaten ausreichend — und falls
> nein, welche Ergänzung (Addendum, gesonderte Vereinbarung, anderer
> Verarbeitungsrahmen) ist erforderlich?

Status: `LEGAL REVIEW REQUIRED`. Aus der Tatsache, dass A1 als *verifiziert*
geführt wird, folgt hierzu **nichts**: der Vertrag existiert nachweislich — seine
Reichweite ist eine andere Frage.

---

## 7. A3–A13 — neu klassifiziert

**Korrektur vom 2026-09-18.** Die frühere Fassung dieses Abschnitts behandelte
alle elf Zeilen gleich und bezeichnete sie sämtlich als zwingend extern. Das war
zu grob. Nach Prüfung der **offiziellen Providerdokumentation** schließen drei
Zeilen sofort, vier sind unsere eigenen Account-Schritte, zwei brauchen
tatsächlich eine Anbieterentscheidung, und zwei tragen einen Rechtsanteil.

Die vollständige Zeile-für-Zeile-Bewertung mit Evidenzart, Bewertung, Status,
verbleibender Lücke und Quellenangaben steht im
[Evidence Register §12](DOCUMENT_TRANSLATION_EVIDENCE_REGISTER.md) und wird
hier **nicht wiederholt**. Kurzfassung:

| | Zeilen |
|---|---|
| **Jetzt geschlossen** (öffentliche Providerdokumentation) | A5 Endpunkt · A6 `json_schema` · A7 ZDR-Eignung des Endpunkts · A8 Caching-Verhalten und -Steuerung für unseren Endpunkt, bedingt auf die Modellklasse |
| **Eigene Account-Schritte** | A11 Schlüssel anlegen · A12 projektgebunden, Ablauf und Rotation · A9/A10 Modelle wählen und Verfügbarkeit belegen · A13 Host festhalten, sobald die Projektregion feststeht |
| **Echte Anbieterentscheidung** | A3 Freigabe für Abuse-Monitoring-Kontrollen · A4 Zero-Data-Retention-Freigabe |
| **Rechtsanteil** | A3 *Modified Retention Amendment* (Vertragsakt, gehört neben A1a) · A8 Zulässigkeit standardmäßig aktiven Cachings für Gesundheitsdaten · A1a unverändert |

### 7.1 Drei Befunde, die die Lage verändern

1. **Datenresidenz ist eine Projekteinstellung, kein Support-Ticket.** Die Region
   wird laut Dokumentation *beim Anlegen* eines Projekts gewählt. Ob das
   bestehende dedizierte Projekt (A2) umgestellt werden kann oder neu angelegt
   werden muss, sagt die Dokumentation **nicht** — das ist Account-Evidenz und
   als `UNKNOWN` geführt.
2. **EU-Residenz verlangt einen Vertragszusatz.** *„To use data residency with
   any region other than the United States, you must be approved for abuse
   monitoring controls, and execute a Modified Retention amendment."* Damit ist
   ein Teil von A3 ein **Vertragsakt** — dieselbe Kategorie wie A1a, und
   zweckmäßigerweise im selben Vorgang zu behandeln.
3. **Prompt Caching ist steuerbar — Korrektur.** Die erste Fassung dieses
   Abschnitts sagte, Caching sei nicht abschaltbar. Das stammte aus dem
   Caching-*Guide*, der um die Responses API herum geschrieben ist. Die
   **API-Referenz unseres eigenen Endpunkts** dokumentiert `prompt_cache_key`,
   `prompt_cache_options` (`mode: implicit|explicit`, `ttl: "30m"`, ab
   `gpt-5.6`) und das veraltete `prompt_cache_retention` (`in_memory|24h`). Mit
   `mode: "explicit"` und ohne gesetzte Breakpoints *„does not use prompt
   caching"*. Caches sind organisationsisoliert und überschreiten keine
   Regionsgrenze; unter ZDR ist die Voreinstellung `in_memory`. Damit ist A8 für
   unseren Pfad beantwortet — **unter der Bedingung, dass A9/A10 ein Modell der
   `gpt-5.6`-Klasse oder neuer wählen.** **Die Schlussfolgerung „ZDR, also kein
   Caching" bleibt dennoch abgelehnt:** ZDR verkürzt die Aufbewahrung, es
   schaltet den Mechanismus nicht ab.

### 7.2 Was die Dokumentation ausdrücklich **nicht** belegt

- dass **unsere** Organisation oder **unser** Projekt für EU-Residenz freigegeben
  ist (A3)
- dass **für uns** Zero Data Retention aktiv ist (A4)
- dass die benötigten Modelle **in unserem Projekt und unserer Region** verfügbar
  sind (A9/A10)

Ein dokumentierter regionaler Host ist nicht dasselbe wie ein freigeschaltetes
Projekt. Diese Trennung wird bewusst durchgehalten.

### 7.3 Ausführbare Account-Schritte

Vorzubereiten, **nicht auszuführen**, solange `NO-GO` gilt. Keiner davon benötigt
eine Anbieterantwort, und keiner erzeugt hier ein Geheimnis.

| # | Schritt | Ergebnis als Evidenz |
|---|---|---|
| 1 | Projekt für die Dokumenttransformation in der Zielregion sicherstellen — vorhandenes umstellen, falls möglich, sonst neu anlegen | Projektname und Region, Screenshot ohne Kennungen |
| 2 | Dedizierten Schlüssel **für dieses Projekt** anlegen; Service-Account bevorzugt, weil er nicht an eine Person gebunden ist | der Satz „Key exists for approved translation project: yes" genügt |
| 3 | Ablaufdatum setzen und eine Rotationsregel festhalten | Konfigurationsbestätigung |
| 4 | Modelle für beide Slots festlegen und ihre Verfügbarkeit im Projekt prüfen | Modellliste des Projekts, Kennungen geschwärzt |
| 5 | Wenn 1 steht: den Host in `APPROVED_PROVIDER_HOSTS` eintragen | geprüfter Commit — das ist das Vier-Augen-Prinzip, kein Schalter |

**Kein Schlüssel wird hier erzeugt, angezeigt, gekürzt oder beschrieben.**

Schritte 2 und 3 sind **`READY FOR ACCOUNT ACTION`**: sie lassen sich heute
ausführen, ohne irgendetwas zu aktivieren. Ein Schlüssel, der existiert, aber in
keiner laufenden Umgebung hinterlegt ist, bewirkt nichts. Die Freigabe für die
Aktivierung bleibt davon unberührt.

Konkret für die spätere Produktion:

```
Dediziertes Translation-Projekt (Zielregion)
  └─ eigener Service Account          ← nicht an eine Person gebunden
       └─ eigener Project API Key     ← ausschließlich dieses Projekt
            ├─ Scopes: nur was der Adapter ruft — Chat Completions.
            │          Keine Datei-, Batch-, Fine-Tuning- oder
            │          Admin-Rechte; Default ist read+write auf alle
            │          Projektressourcen und wird eingeschränkt
            ├─ Ablaufdatum gesetzt
            ├─ Rotation: Nachfolger anlegen → Umgebung umstellen →
            │            alten Schlüssel erst nach Verifikation widerrufen
            ├─ getrennt von OPENAI_API_KEY — der Code lehnt Gleichheit ab
            └─ ausschließlich serverseitige Secret-Verwaltung,
               nie im Repository, nie im Client, nie in einem Log
```

### 7.4 Modellmatrix (A9/A10)

Interne technische Auswahl. **Diese Namen erscheinen in keinem Produkt- oder
Marketingtext** — sie stehen hier, weil ohne sie keine Evidenz möglich ist.
Ausgangslage: **im gesamten Repository existiert kein Modellname.** Beide Slots
sind reine Umgebungsvariablen ohne Default.

| Kriterium | `gpt-5.6-terra` *(Primär)* | `gpt-5.6-sol` *(Ersatzkandidat)* |
|---|---|---|
| Chat Completions | dokumentiert unterstützt | dokumentiert unterstützt |
| Structured Outputs / `json_schema` | dokumentiert unterstützt | dokumentiert unterstützt |
| Kontextfenster | 1.050.000 Token | 1.050.000 Token |
| Max. Ausgabe | 128.000 Token | 128.000 Token |
| `prompt_cache_options` (A8-Steuerung) | ja — `gpt-5.6`-Klasse | ja |
| Preis Eingabe / gecacht / Ausgabe | $2 / $0,20 / $12 je 1 Mio. | $4 / — / $20 je 1 Mio. |
| Eignung | „high-volume, routine tasks" | „complex professional work" |
| Regionale Eignung | **unbelegt** — projekt-/regionsabhängig | **unbelegt** |
| Verfügbarkeit in unserem Projekt | **unbelegt** | **unbelegt** |

**Warum Terra als Primäroption.** Der Kontextbedarf ist unkritisch: ein Arztbrief
liegt um Größenordnungen unter 1 Mio. Token, das Fenster entscheidet also nichts.
Entscheidend ist etwas anderes — **das Modell ist in dieser Architektur keine
Sicherheitsgrenze.** Kritische Werte sind maskiert, bevor es sie sieht, und
erfundene Zahlen scheitern an der Integritätsprüfung. Die Modellwahl betrifft
damit Sprachqualität und Kosten, nicht Patientensicherheit. Bei einem ganzen
Dokument je Aufruf ist Terra die verhältnismäßige Wahl, und der gecachte
Eingabepreis wirkt genau auf den unveränderlichen System-Prompt.

**Warum Sol als Ersatzkandidat.** Falls die Sprachqualität — insbesondere bei
„Einfache Sprache" — sich an echten Dokumenten als unzureichend erweist. Das ist
eine Messung an einem echten Korpus, die es noch nicht gibt.

**Warum nicht `gpt-5.6-luna`.** Billiger, aber als „cost-sensitive, high-volume"
positioniert. Für die faktengetreue Umformung medizinischer Texte liegt dazu
keine Evidenz vor, und wir behaupten sie nicht.

**Warum nicht `gpt-6-astra`.** Fünffacher Preis für eine Aufgabe, die kein
tiefes Schlussfolgern ist. Bliebe eine Option, wenn die Messung das umkehrt.

> **Ausdrücklich: kein automatischer Fallback.** Im Produkt gibt es keinen
> Modell- oder Anbieterwechsel zur Laufzeit und es wird keiner gebaut. Ein
> automatischer Wechsel wäre eine selbstgewählte Änderung des Sicherheitsprofils
> — genau das, was diese Architektur nicht tun darf. Der „Ersatzkandidat" ist
> ein Eintrag in diesem Dokument, den ein Mensch bewusst setzt.

A9/A10 bleiben **`OPEN`**, bis die Verfügbarkeit im gewählten Projekt und in der
gewählten Region belegt ist. Eine dokumentierte Modelleignung ist keine
Verfügbarkeitszusage für unser Konto.

## 8. Regel für öffentliche Kommunikation

**Im Produkt und im Marketing:** funktionsbezogene Sprache. Keine Modellnamen,
keine Anbieternamen, keine Hosting- oder Länderdetails, keine internen
Architekturbegriffe.

Geprüfter Stand: In der normalen Oberfläche kommen **keine** Anbieter- oder
Modellnamen vor; ein Test sucht aktiv nach `OpenAI`, `gpt-`, `baseURL` und
`apiKey` im Abschnitt und schlägt bei einem Treffer fehl.

**Dokumentierte Ausnahmen — bewusst benannt, nicht verschleiert:**

| Ausnahme | Wo | Begründung |
|---|---|---|
| „KI-generierte Übersetzung" / „KI-generierte sprachliche Vereinfachung" | Ergebnisanzeige | Kennzeichnung maschinell erzeugter Inhalte. Weglassen wäre Verschleierung, nicht Datensparsamkeit. Im Rahmen von B7 zu bestätigen. |
| Namentliche Nennung des Empfängers | Datenschutzerklärung §6/§7 | Art. 13 (1)(e)/(f) verlangt Empfänger und Drittlandangaben. `LEGAL DISCLOSURE REQUIRED` — Umfang folgt aus 2.10. |
| Anbieter, Vertrag, Modellslots | interne Compliance-Unterlagen (dieses Dokument, Register, Packet, DSFA) | für die rechtliche Prüfung erforderlich; diese Dokumente sind nicht patientenseitig |

**Die Regel ist Datensparsamkeit in der Produktsprache, nicht Geheimhaltung
gegenüber Betroffenen.** Wo eine Benennung gesetzlich, vertraglich oder für die
Ausübung von Betroffenenrechten erforderlich ist, wird sie vorgenommen und hier
als Ausnahme dokumentiert.

---

## Anhang A — B7: Entwurf der Patienteninformation

> **Entwurf. Nicht veröffentlichen.** Die Rechtsgrundlagenzeile ist bewusst als
> Variante ausgeführt und darf erst nach 2.2/2.3/2.4 gesetzt werden. Keine
> Anbieter- oder Modellnamen; die eine Stelle, an der eine Benennung
> rechtlich erforderlich sein kann, ist markiert.

**Überschrift:** Was passiert, wenn du dieses Dokument übersetzen oder einfacher
lesen lässt

- **Was die Funktion macht.** Der Text deines Dokuments wird in die Sprache
  übersetzt, die du auswählst, oder in eine allgemeinverständliche Fassung
  gebracht.
- **Sie ist freiwillig.** Sie passiert nur, wenn du sie startest. Wenn du sie nicht
  benutzt, ändert sich nichts — das Dokument bleibt dir genauso zugänglich.
- **Das Original bleibt unverändert.** Es wird weder ersetzt noch überschrieben.
  Maßgeblich ist immer das Original deiner Praxis.
- **Was verarbeitet wird.** Der Textinhalt dieses Dokuments. Dazu gehören auch
  gesundheitsbezogene Angaben. Die Datei selbst wird nicht weitergegeben.
- **Warum.** `«VARIANTE A: weil du dieser Verarbeitung ausdrücklich zustimmst.»`
  `«VARIANTE B: «Rechtsgrundlage — offen, B4».»` — **nicht ausfüllen, bevor B4
  entschieden ist.**
- **Wie wir dich schützen.** Bevor der Text weitergegeben wird, ersetzen wir die
  uns bekannten Angaben zu deiner Person sowie Medikamente, Dosierungen und
  Messwerte durch Platzhalter. Lässt sich eine Medikamentenangabe nicht sicher
  schützen, brechen wir ab und übersetzen das Dokument nicht.
- **Was wir dabei nicht versprechen.** Diese Maßnahmen verringern, was von dir
  erkennbar bleibt — sie machen den Text aber **nicht anonym**. Aus dem
  Zusammenhang eines medizinischen Textes kann weiterhin auf eine Person
  geschlossen werden.
- **Das Ergebnis ist eine sprachliche Umformung.** Es kann sich vom Original
  unterscheiden. Es ist keine medizinische Beratung und ersetzt kein Gespräch mit
  deiner Ärztin oder deinem Arzt.
- **Was gespeichert wird.** Das Ergebnis wird nicht gespeichert — weder bei uns
  noch in deinem Gerät. Gespeichert wird ein technischer Protokolleintrag
  darüber, dass und wann du die Funktion für dieses Dokument genutzt hast.
- **Deine Rechte.** Du kannst Auskunft über die zu dir gespeicherten Daten
  verlangen, ihre Löschung oder Einschränkung beantragen und Beschwerde bei einer
  Aufsichtsbehörde einlegen. `«VARIANTE A: Du kannst deine Zustimmung jederzeit
  widerrufen; ab dann steht die Funktion nicht mehr zur Verfügung. Bereits
  erfolgte Nutzungen bleiben davon unberührt.»` `«VARIANTE B: Du kannst der
  Verarbeitung widersprechen — Weg abhängig von B4.»`
- **Wie du die Funktion nicht nutzt.** Starte sie einfach nicht. Es gibt keinen
  Nachteil und keine Erinnerung.

`LEGAL DISCLOSURE REQUIRED` — *falls die Nennung des konkreten Empfängers und der
Verarbeitungsregion an dieser Stelle rechtlich erforderlich ist, gehört sie
hierher und wird nicht stillschweigend weggelassen. Ob sie hier oder in der
Datenschutzerklärung steht, ist Teil von B7.*

Übersetzungen in die sechs Oberflächensprachen werden **erst nach der Freigabe
des deutschen Textes** erstellt — eine unreviewte Fassung sechsmal auszurollen
vervielfacht nur den Fehler.

---

*Status: Arbeitsdokument. Keine Entscheidung getroffen, keine Freigabe erteilt,
keine Aktivierung vorbereitet.*
