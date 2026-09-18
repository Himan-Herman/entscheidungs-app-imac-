# Dokumenttransformation — interne rechtliche Vorprüfung

> **Vorprüfung für die externe Rechtsberatung. Keine Rechtsberatung, keine
> Freigabe.** Dieses Memo ersetzt keinen Anwalt. Es bereitet die Prüfung so vor,
> dass sie bestätigt oder korrigiert werden kann, statt neu aufgebaut werden zu
> müssen.
>
> Jede Aussage trägt eine der vier Kennzeichnungen. Sie werden nicht vermischt:
>
> | Kennzeichen | Bedeutung |
> |---|---|
> | **FACT** | aus dem laufenden System, dem Vertrag oder einer Primärquelle belegt |
> | **INTERPRETATION** | eigene Auslegung aus Norm + Sachverhalt — vertretbar, nicht verbindlich |
> | **OPEN** | offene Rechtsfrage, die hier nicht beantwortbar ist |
> | **EXTERNAL** | externe Freigabe oder Entscheidung erforderlich |
>
> **Keine Aussage in diesem Memo lautet „DSGVO-konform", „rechtssicher",
> „Art. 9 erfüllt", „DSFA abgeschlossen" oder „Vertrag deckt Gesundheitsdaten
> ab".** Wo eine solche Aussage naheläge, steht stattdessen, was sie tragen würde
> und was fehlt.
>
> Keine Patientendaten, keine Zugangsdaten, keine Schlüssel.

| | |
|---|---|
| **Stand** | 2026-09-18 |
| **Gegenstand** | Sprachliche Transformation (Fachübersetzung / Einfache Sprache) von der Praxis freigegebener Dokumente, patientenseitig ausgelöst |
| **Systemzustand** | technisch fertig, **abgeschaltet**, kein Anbieter konfiguriert, keine Übermittlung erfolgt |
| **Zugehöriger Freigabebogen** | [`DOCUMENT_TRANSLATION_LEGAL_SIGNOFF.md`](DOCUMENT_TRANSLATION_LEGAL_SIGNOFF.md) |
| **Quellen** | §17 — ausschließlich Primärquellen und Aufsichtsleitlinien, je mit Standdatum |

---

## 1. Sachverhalt — nur was belegt ist

**FACT.** Eine Praxis stellt ein Dokument (Befund, Entlassungsbericht, Überweisung)
auf der MedScoutX-Plattform bereit und gibt es einem verknüpften Patienten frei.
Der Patient kann ausdrücklich eine Transformation starten. MedScoutX extrahiert
den Text serverseitig, ersetzt die ihm bekannten Identifikatoren des Patienten
sowie Medikation, Dosierung, Messwerte und Daten durch Platzhalter, segmentiert
und sendet die Segmente an OpenAI (`/v1/chat/completions`). Die Antwort wird auf
erfundene Werte, verlorene Platzhalter und hinzugefügte Handlungsanweisungen
geprüft, zurückübersetzt, angezeigt und von MedScoutX **nicht gespeichert**. Auf
eigenen Klick kann der Patient das Ergebnis im Browser als PDF erzeugen und auf
seinem Gerät sichern; das PDF trägt die Kennzeichnung als maschinell erzeugte
Umformung und den Hinweis, dass das Original maßgeblich ist. Gespeichert wird je
Vorgang ein Protokolleintrag mit Personen-, Dokument- und Praxisbezug.

**FACT.** Die Praxis ist an der Transformation nicht beteiligt: keine Anzeige,
keine Benachrichtigung, kein Zustimmungsweg auf Praxisseite.

**FACT.** Die Maskierung ist keine Anonymisierung. Namen **Dritter** im Dokument
(überweisende Ärztinnen, Unterzeichner, Angehörige) werden nicht maskiert.

Ausführlich: [Legal Review Packet](DOCUMENT_TRANSLATION_LEGAL_REVIEW_PACKET.md) §2–§7.

---

## 2. Rollen

### 2.1 Maßstab

**FACT** — EDPB, Leitlinien 07/2020 v2.1:
- Rn. 40: Über die *wesentlichen Mittel* entscheidet der Verantwortliche; das
  sind die Mittel, die eng mit Zweck und Umfang verknüpft sind — *welche* Daten,
  *wie lange*, *wer Zugriff erhält* (Empfänger), *wessen* Daten.
- Rn. 42–43: Die Verantwortlichkeit kann sich auf einzelne Stufen einer
  Verarbeitungskette beschränken; eine Kette kann in kleinere Vorgänge mit je
  eigenem Verantwortlichen zerfallen — oder auf „Makroebene" ein gemeinsamer
  Vorgang mit gemeinsamen Verantwortlichen sein.
- Rn. 45: Verantwortlicher kann sein, wer entscheidenden Einfluss auf Zweck und
  wesentliche Mittel hat, auch ohne Zugriff auf die Daten.
- Rn. 54–55: Gemeinsame Kontrolle entsteht durch gemeinsame oder
  *konvergierende* Entscheidungen über Zweck und wesentliche Mittel; ein
  wichtiges Kriterium ist, ob die Verarbeitung ohne die Beteiligung beider an
  Zweck und Mitteln nicht möglich wäre.

**FACT** — ErwG 18 DSGVO: Die Haushaltsausnahme gilt für die natürliche Person,
*„gilt jedoch für die Verantwortlichen oder Auftragsverarbeiter, die die
Instrumente für die Verarbeitung personenbezogener Daten für solche persönlichen
oder familiären Tätigkeiten bereitstellen"*. MedScoutX kann sich also nicht darauf
berufen, dass der **Patient** hier für sich selbst handelt.

### 2.2 Die Kette, stufenweise

| Stufe | Wer entscheidet Zweck und wesentliche Mittel? (FACT) | Plausible Rolle (INTERPRETATION) |
|---|---|---|
| **S1** Speicherung und Freigabe des Dokuments an den Patienten | Praxis entscheidet über Inhalt und Freigabe | Praxis = Verantwortliche · MedScoutX = Auftragsverarbeiter (dieser Teil ist im AVV heute **nicht** beschrieben, §8) |
| **S2** patienteninitiierte Transformation | MedScoutX entscheidet über Anbieter, Datenumfang (Maskierung, Segmente), Dauer (transient), Empfänger; der Patient entscheidet *ob* und *welches Dokument*; die Praxis entscheidet **nichts** | siehe Varianten |
| **S3** Verarbeitung beim Anbieter | Anbieter handelt nach Vertrag | Auftragsverarbeiter bzw. Unterauftragsverarbeiter — **FACT**: der DPA ordnet OpenAI die Rolle *Data Processor* zu |
| **S4** weitere Unterauftragsverarbeiter des Anbieters | — | **UNKNOWN** — die Liste war am Stichtag nicht abrufbar (HTTP 403) und liegt nicht vor |

### 2.3 Varianten für Stufe S2

| | **V1 — MedScoutX eigener Verantwortlicher** | **V2 — MedScoutX Auftragsverarbeiter der Praxis** | **V3 — gemeinsame Verantwortlichkeit (Art. 26)** |
|---|---|---|---|
| Trägt der Sachverhalt? | **am ehesten** (INTERPRETATION): MedScoutX bestimmt allein Zweck und alle wesentlichen Mittel nach Rn. 40; die Praxis hat keinen Einfluss | schwach: setzt voraus, dass die Praxis Zweck und wesentliche Mittel bestimmt und anweist — heute nicht der Fall | möglich, wenn die Praxis die Funktion für ihre Patienten aktiv anbietet oder freischaltet (Rn. 55) — heute nicht der Fall |
| Folge für MedScoutX | eigene Rechtsgrundlagen (Art. 6 + Art. 9), eigene Informationspflichten, eigene DSFA, Betroffenenrechte direkt | Weisungsgebundenheit, AVV-Pflichten, Unterauftragsverarbeiter-Genehmigung **je Praxis** (Art. 28 Abs. 2, 4) | Vereinbarung nach Art. 26, Aufgabenteilung, Transparenz des Wesentlichen |
| Folge für die Praxis | keine Verantwortung für S2; Information der Praxis empfehlenswert (§8) | Verantwortung für S2 inkl. Art. 9-Grundlage, DSFA, Informationspflichten | Mitverantwortung |
| Folge für den Patienten | Rechte gegenüber MedScoutX | Rechte gegenüber der Praxis | Rechte gegenüber beiden (Art. 26 Abs. 3) |
| § 203 StGB | **OPEN**: Offenbart der Patient ein ihm bereits freigegebenes eigenes Dokument, ist das keine Offenbarung durch den Arzt | Die Praxis offenbart Geheimnisse an „mitwirkende Personen" — zulässig nur soweit erforderlich und bei Verpflichtung zur Verschwiegenheit, § 203 Abs. 3 S. 2, Abs. 4 S. 2 Nr. 1 StGB, **bis in die Kette zum Anbieter** | wie V2, soweit die Praxis offenbart |

**Der Kernpunkt, den die Varianten verdecken — Art. 28 Abs. 10.** Hält MedScoutX
das Dokument in S1 **als Auftragsverarbeiter** der Praxis und verwendet es in S2
**für einen eigenen Zweck**, dann bestimmt MedScoutX insoweit selbst über Zweck
und Mittel und gilt dafür als Verantwortlicher. Das ist nicht unzulässig, wenn es
eine eigene Rechtsgrundlage hat (hier: Wunsch und ggf. Einwilligung der
betroffenen Person selbst) — aber es muss **gegenüber der Praxis offen** und im AVV
abgebildet sein, sonst weicht MedScoutX von den Weisungen ab.
**OPEN / EXTERNAL.**

**INTERPRETATION.** V1 bildet die tatsächlichen Entscheidungen am genauesten ab und
passt zur Live-Datenschutzerklärung, die MedScoutX für die App bereits als
Verantwortlichen nennt. V2 würde eine Praxis-Mitwirkung verlangen, die es heute
nicht gibt. **EXTERNAL** — Feld 1 des Freigabebogens.

---

## 3. Art. 6 DSGVO

**FACT** — ErwG 51 Satz 4 (sinngemäß vollständig): Zusätzlich zu den besonderen
Anforderungen an Art.-9-Daten *„sollten die allgemeinen Grundsätze und andere
Bestimmungen dieser Verordnung, insbesondere hinsichtlich der Bedingungen für eine
rechtmäßige Verarbeitung, gelten"*. Art. 6 und Art. 9 sind also **kumulativ** zu
prüfen; aus Art. 6 folgt nichts für Art. 9.

**FACT** — EDPB 05/2020 v1.1, Rn. 121: Die Rechtsgrundlage ist **vor** der
Verarbeitung und je Zweck festzulegen. Rn. 123: ein späterer Wechsel von der
Einwilligung auf eine andere Grundlage ist unzulässig.

| Norm | Warum sie passen könnte | Warum sie möglicherweise nicht passt | Folge MedScoutX | Folge Praxis | Folge Patient | Dokumentation |
|---|---|---|---|---|---|---|
| **lit. a** Einwilligung | optionale, patienteninitiierte Zusatzfunktion; Original ohne sie voll nutzbar (Freiwilligkeit, Art. 7 Abs. 4) | doppelt nötig, falls Art. 9 Abs. 2 lit. a ohnehin gewählt wird — dann aber konsistent | Einwilligungsverwaltung, Nachweis (Art. 7 Abs. 1), Widerruf (Art. 7 Abs. 3) | in V1 keine | kann widerrufen | Einwilligungstext, Version, Zeitpunkt |
| **lit. b** Vertrag | der Patient bestellt die Transformation im Rahmen des Nutzungsverhältnisses; ohne Verarbeitung keine Leistung | trägt **nicht** Art. 9 (EDPB 05/2020 Rn. 99: Vertragserforderlichkeit ist **keine** Art.-9-Ausnahme) — also nur für Art. 6 | Leistungsbeschreibung in den Nutzungsbedingungen | in V1 keine | kein Widerruf, aber Kündigung | AGB/Leistungsbeschreibung, Erforderlichkeitsbegründung |
| **lit. f** berechtigtes Interesse | Interesse an Verständlichkeit medizinischer Dokumente | bei Gesundheitsdaten schwierige Abwägung; ersetzt ebenfalls nicht Art. 9 | Abwägung dokumentieren, Widerspruchsrecht (Art. 21) | — | Widerspruch | Interessenabwägung |
| lit. c / e | — | keine rechtliche Pflicht, keine öffentliche Aufgabe eines privaten Anbieters | — | — | — | — |

**INTERPRETATION.** Für V1 kommen lit. a oder lit. b in Betracht. Welche passt,
hängt an Art. 9 (§4): Wird dort die ausdrückliche Einwilligung gewählt, ist es
konsistent, auch Art. 6 auf lit. a zu stützen oder lit. b ausdrücklich neben die
Art.-9-Einwilligung zu stellen — aber nicht, gegenüber dem Patienten „Einwilligung"
zu sagen und intern etwas anderes zu meinen (Rn. 122). **EXTERNAL** — Feld 2.

---

## 4. Art. 9 DSGVO — Gesundheitsdaten

**FACT.** Die Verarbeitung betrifft Gesundheitsdaten (Art. 9 Abs. 1), absichtlich
und planmäßig. Das Verbot gilt, solange keine Ausnahme nach Abs. 2 greift.

| Ausnahme | Voraussetzungen (FACT, Wortlaut) | Plausibel für diesen Dienst? (INTERPRETATION) |
|---|---|---|
| **lit. a** ausdrückliche Einwilligung | *„für einen oder mehrere festgelegte Zwecke ausdrücklich eingewilligt"*; kein nationaler Ausschluss erkennbar | **am wenigsten künstlich** für V1: optionaler Dienst auf Wunsch des Patienten, nicht von einem Gesundheitsberuf erbracht |
| **lit. h** Gesundheitsversorgung | Zwecke der Gesundheitsvorsorge, Diagnostik, Versorgung oder Behandlung, *„auf der Grundlage des Unionsrechts oder des Rechts eines Mitgliedstaats oder aufgrund eines Vertrags mit einem Angehörigen eines Gesundheitsberufs"* und *„vorbehaltlich der in Absatz 3 genannten Bedingungen"* — Verarbeitung durch oder unter Verantwortung von Fachpersonal mit Berufsgeheimnis; national § 22 Abs. 1 Nr. 1 lit. b BDSG | **künstlich für V1**: MedScoutX ist kein Gesundheitsberuf, und der Zweck ist sprachliches Verständnis, nicht Diagnostik oder Behandlung. **Denkbar nur in V2**, wenn die Praxis die Funktion als Teil ihrer Versorgung einsetzt und die Kette unter ihrer Verantwortung und Geheimhaltung steht |
| lit. e öffentlich gemacht | *„offensichtlich öffentlich gemacht"* | nein |
| lit. b, c, f, g, i, j | Arbeitsrecht, Lebensinteressen, Rechtsansprüche, öffentliches Interesse, Forschung | nein |

**FACT** — EDPB 05/2020 Rn. 99: Greift keine der Ausnahmen b–j, bleibt die
ausdrückliche Einwilligung.

**Welche Variante erzeugt die stärksten Folgepflichten? (INTERPRETATION)**
lit. h in V2: AVV mit jeder Praxis, Genehmigung der Unterauftragsverarbeiter je
Praxis, § 203-Verpflichtungskette bis zum Anbieter, DSFA-Verantwortung jeder
Praxis. lit. a in V1 erzeugt Einwilligungsverwaltung — spürbar, aber an einer
Stelle zentralisiert.

**EXTERNAL** — Feld 3.

---

## 5. Einwilligung

### 5.1 Variante A — ausdrückliche Einwilligung ist Rechtsgrundlage

| Anforderung | Quelle (FACT) | Stand im System (FACT) | Offen |
|---|---|---|---|
| Willensbekundung, eindeutige bestätigende Handlung | Art. 4 Nr. 11 | Erteilen-/Widerrufen-Oberfläche existiert, für diese Funktion **nicht angebunden** | — |
| **ausdrücklich** | Art. 9 Abs. 2 lit. a; EDPB Rn. 93: *„express statement of consent"* | — | Wortlaut der Erklärung |
| freiwillig, Kopplungsverbot | Art. 7 Abs. 4 | Original bleibt ohne die Funktion zugänglich — keine Kopplung | — |
| informiert | Art. 4 Nr. 11, Art. 7 Abs. 3 S. 3 (Hinweis auf Widerruf vorab) | Textentwurf B7 vorhanden | Empfängernennung (§9) |
| spezifisch, festgelegter Zweck | Art. 9 Abs. 2 lit. a | zwei Modi | **OPEN**: sind Fachübersetzung und Einfache Sprache zwei Zwecke, die getrennt einzuwilligen sind (EDPB Rn. 42–44, Granularität)? |
| nachweisbar | Art. 7 Abs. 1 | `ConsentRecord` mit Status, Zeitpunkt, Version und Akteur vorhanden | — |
| widerrufbar, so einfach wie erteilt | Art. 7 Abs. 3 | bestehender Widerrufsweg | — |
| einmalig oder je Verarbeitung | EDPB Rn. 98 (Beispiel zweistufiger Bestätigung bei Gesundheitsdaten) | beides ohne Umbau umsetzbar | **OPEN** — Feld 5 |
| Folgen des Widerrufs | Art. 7 Abs. 3 S. 2: vergangene Verarbeitung bleibt rechtmäßig | kein Ergebnis gespeichert — nichts zu löschen außer ggf. Protokoll | Umgang mit Protokolldaten (§12) |

### 5.2 Variante B — keine Einwilligung als Rechtsgrundlage

- **Aktive Handlung bleibt nötig**, aber aus einem anderen Grund: Sie ist die
  Bestellung der Leistung (Art. 6 Abs. 1 lit. b) und der Zeitpunkt, ab dem
  Transparenz nach Art. 12 f. hergestellt sein muss — nicht eine Einwilligung.
- **Transparenz vor dem Start**: Zweck, Empfänger, Rechtsgrundlage, Speicherung,
  Rechte — an der Funktion selbst, nicht versteckt.
- **Kein künstlicher Einwilligungsdialog.** Wer „Einwilligung" abfragt und sich
  tatsächlich auf eine andere Grundlage stützt, handelt nach EDPB Rn. 122
  *„fundamentally unfair"*. Ein Häkchen „Ich stimme zu" ohne Einwilligungsfunktion
  wäre schlechter als gar keines.
- **Tragfähig nur, wenn es für Art. 9 eine Grundlage außer lit. a gibt.** Für V1
  ist das nach §4 nicht ersichtlich. Variante B setzt daher faktisch V2 mit lit. h
  voraus.

### 5.3 RECOMMENDED LEGAL QUESTION FOR COUNSEL

> *„Trägt für die patienteninitiierte, von MedScoutX als eigene Leistung
> erbrachte sprachliche Transformation eines von der Praxis freigegebenen
> Dokuments eine andere Ausnahme als Art. 9 Abs. 2 lit. a DSGVO? Falls nein: Ist
> eine einmalige ausdrückliche Einwilligung für den Dienst ausreichend, oder
> verlangen die zwei Modi (Fachübersetzung / Einfache Sprache) getrennte
> Einwilligungen, und ist eine Bestätigung je Vorgang erforderlich?"*

**Nicht** gestellt wird die Frage „Ist eine Einwilligung zwingend?" — sie hängt
an Rolle und Art.-9-Grundlage und ist erst danach beantwortbar.

---

## 6. Datenschutz-Folgenabschätzung

**FACT** — WP248 rev.01 (zuletzt 4. Oktober 2017, vom EDPB übernommen): Erfüllt
eine Verarbeitung **zwei** der neun Kriterien, ist *„in most cases"* eine DSFA
erforderlich.

| WP248-Kriterium | Erfüllt? | Begründung |
|---|---|---|
| 1 Bewertung/Scoring | nein | keine Bewertung der Person |
| 2 automatisierte Entscheidung mit Rechtswirkung | nein | keine Entscheidung, Art. 22 nicht berührt |
| 3 systematische Überwachung | nein | — |
| **4 sensible Daten** | **ja** | Gesundheitsdaten nach Art. 9 |
| 5 große Menge | **UNCERTAIN** | Funktion nicht aktiv; Umfang nicht messbar |
| 6 Zusammenführung von Datensätzen | nein | — |
| **7 schutzbedürftige Betroffene** | **ja** | WP248 nennt *„patients"* ausdrücklich |
| **8 innovative Technologie** | **ja** (INTERPRETATION) | generatives Sprachmodell zur Umformung medizinischer Texte |
| 9 hindert an Rechtsausübung oder Nutzung | nein | Original bleibt zugänglich |

**FACT** — DSK-Muss-Liste, Version 1.1 vom 17.10.2018: Nr. 11 (KI zur *Steuerung
der Interaktion* oder *Bewertung persönlicher Aspekte*) und Nr. 17 (Art.-9-Daten
zur *Leistungsbestimmung*) treffen den Fall **nicht unmittelbar**. Die Liste ist
ausdrücklich *„nicht abschließend"*.

**Einschätzung: LIKELY REQUIRED.** Drei Kriterien sind erfüllt (4, 7, 8); ein
viertes (5) ist offen. Hinzu kommen Daten Dritter, Re-Identifikationsrisiko und
ein externer Verarbeiter. Die finale Feststellung und Freigabe ist Sache des
Verantwortlichen — **EXTERNAL**, Feld 8.

**Vollständigkeit des Entwurfs** ([DSFA-Entwurf](DOCUMENT_TRANSLATION_DPIA_DRAFT.md)):
Sachverhalt vollständig. Ergänzt mit diesem Stand: die WP248-Zuordnung, Risiken
zu Gesundheitsdaten Dritter, § 203 StGB, Zweckbestimmung (MDR) und KI-Transparenz.
Offen und nicht intern schließbar: Bewertung, Restrisiko, Konsultation der oder
des DSB, Standpunkt Betroffener (Art. 35 Abs. 9), Freigabe.

---

## 7. Vertragsumfang Gesundheitsdaten (A1a)

**FACT.** DPA mit OpenAI, Fassung `v.010126`, beidseitig 2026-08-16, Text
identisch mit der öffentlichen Vorlage. Schedule 1 Nr. 5: *„No sensitive data is
intended to be transferred unless the user includes it unexpectedly in
unstructured data."* „Special categories", „health", „Article 9" kommen nicht vor.

**FACT.** Art. 28 Abs. 3 verlangt, dass der Vertrag u. a. *die Art der
personenbezogenen Daten* und *die Kategorien betroffener Personen* festlegt.

| Auslegung | Tragweite (INTERPRETATION) |
|---|---|
| reine **Beschreibung** des erwarteten Datenumfangs | Vertretbar, weil Schedule 1 die übliche Transferbeschreibung ist. Aber: Beschreibt der Vertrag die tatsächliche Datenart nicht, stellt sich die Frage, ob er die Anforderung aus Art. 28 Abs. 3 **für diese Verarbeitung** erfüllt |
| vertragliche **Einschränkung** | Vertretbar, weil „not intended" eine Erwartung des Anbieters formuliert, auf die er sich berufen könnte. Dann läge die planmäßige Übermittlung außerhalb des vereinbarten Rahmens |
| **Risiko-/Scope-Beschreibung** ohne Rechtsfolge | Möglich, trägt aber am wenigsten, weil sie den Widerspruch nur benennt, nicht auflöst |

**Kein Ergebnis „verboten" oder „erlaubt".** Jede Auslegung ist vertretbar, keine
ist gesichert, und der Widerspruch zwischen Vertragstext und tatsächlicher Nutzung
ist **dokumentiert**.

**Sinnvolle Absicherung (Vorschlag, keine Bewertung):**
1. schriftliche Bestätigung des Anbieters, dass planmäßig übermittelte
   Gesundheitsdaten im Rahmen des DPA verarbeitet werden, **oder**
2. Anpassung der Transferbeschreibung (Datenart, Kategorien, Schutzmaßnahmen),
   **oder**
3. ein gesonderter Zusatz für Gesundheitsdaten, falls angeboten.

**Hinweis (FACT, Providerdokumentation):** Für EU-Datenresidenz ist ohnehin ein
*Modified Retention amendment* zu unterzeichnen. Beides in einem Vorgang zu klären
ist naheliegend.

```
A1a = EXTERNAL CONTRACTUAL SIGN-OFF REQUIRED
Registerstatus: A1a = LEGAL REVIEW REQUIRED
```

---

## 8. Art. 28 — AVV mit Praxen

**FACT.** Der bestehende AVV-Entwurf deckt ausdrücklich nur die
GOÄ/PKV-Abrechnungsplausibilität ab. Praxisdokumente und ihre Transformation sind
nicht beschrieben. Zusätzlich fehlen: eine **§ 203-StGB-Klausel** (Verpflichtung
mitwirkender Personen) und eine **allgemeine Drittlandregel**; Drittland
erscheint nur als Prüfpunkt im KI-Abschnitt §15.

Änderungsbedarf nach Art. 28 Abs. 3 — **die Rollenformulierung wird erst nach
Feld 1 eingesetzt**:

| Pflichtinhalt | Heute | Zu ergänzen |
|---|---|---|
| Gegenstand und Dauer | nur Abrechnungspilot | Speicherung und Freigabe von Praxisdokumenten (S1); Dauer = Vertragslaufzeit bzw. Freigabedauer |
| Art und Zweck | Plausibilitätsprüfung | S1 — und je nach Feld 1: S2 als Auftragsverarbeitung **oder** ausdrücklicher Hinweis, dass MedScoutX S2 auf Wunsch des Patienten in eigener Verantwortung erbringt (Art. 28 Abs. 10, §2.3) |
| Datenarten | Abrechnungsdaten | Inhalt medizinischer Dokumente inkl. Gesundheitsdaten nach Art. 9 |
| Kategorien Betroffener | — | Patienten der Praxis; **im Dokument genannte Dritte** |
| Gesundheitsdaten | nicht vorgesehen | ausdrücklich |
| Weisungen | allgemein | Weisungsrahmen für S1; Abgrenzung zu S2 |
| **Vertraulichkeit / § 203 StGB** | allgemeine Vertraulichkeit | Verpflichtung auf § 203 StGB, Weitergabe der Verpflichtung an Unterauftragsverarbeiter (§ 203 Abs. 4 S. 2 Nr. 1 und 2 StGB) |
| TOM | Abrechnung | Maskierung, Isolierung, Integritätsprüfung, keine Persistenz, Fail-closed — Textbausteine in der [Entscheidungsmatrix](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md) §3.3 |
| Unterauftragsverarbeiter | KI standardmäßig aus | Anbieter für S2, falls V2; weitere Unterauftragsverarbeiter des Anbieters (**UNKNOWN**) |
| Löschung | Pilotende | Dokumente nach Rückzug der Freigabe; Protokolldaten nach Feld 11 |
| Unterstützung Betroffenenrechte | allgemein | Prozess nach [Runbook](DOCUMENT_TRANSLATION_DATA_SUBJECT_RIGHTS_RUNBOOK.md) |
| DSFA-Unterstützung | „im Rahmen des Zumutbaren" | Übergabe des DSFA-Entwurfs |
| Audit | vorhanden | unverändert |
| Internationale Verarbeitung | nur als KI-Prüfpunkt | allgemeine Klausel Art. 44 ff., Standort und Garantien (§13) |

---

## 9. Datenschutzerklärung (B1)

**FACT.** Status `CONFLICT`: Die Live-Erklärung beschreibt nur eigene Eingaben des
Patienten und nennt OpenAI LLC, USA, mit Übermittlung unter
Standardvertragsklauseln.

| Pflichtangabe | Geklärt? |
|---|---|
| Verantwortlicher / Rollen | **OPEN** — Feld 1 |
| Zweck | geklärt (sprachliche Transformation) |
| Art. 6 | **OPEN** — Feld 2 |
| Art. 9 | **OPEN** — Feld 3 |
| Datenkategorien | geklärt (Dokumentinhalt, Protokoll) |
| Empfänger | geklärt: OpenAI — Gesellschaft und Region hängen an A3 |
| Konkreter Dienstleister | **Nennung erforderlich** (Art. 13 Abs. 1 lit. e bzw. Art. 14 Abs. 1 lit. e) — `LEGAL DISCLOSURE REQUIRED` |
| Drittland / Region | **OPEN** — A3, §13 |
| Rechtsgrundlage Transfer | **OPEN** — §13 |
| Speicherfristen | teilweise — Protokoll **OPEN** (Feld 11), Anbieter **UNKNOWN** |
| Protokolldaten | bisher **nicht erwähnt** — zu ergänzen |
| Betroffenenrechte | geklärt, Umsetzung im Runbook |
| Einwilligung / Widerruf | nur bei Variante A |
| automatisierte Entscheidung (Art. 22) | **nein** (FACT) — keine Entscheidung mit Rechtswirkung |
| Profiling (Art. 4 Nr. 4) | **nein** (FACT) — keine Bewertung persönlicher Aspekte |

Änderungsmatrix im Detail: [Entscheidungsmatrix](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md) §5.

---

## 10. Patienteninformation (B7)

Geprüft am Entwurf [Entscheidungsmatrix, Anhang A](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md).

| Pflichtpunkt | Im Entwurf? |
|---|---|
| Funktion ist optional | ja |
| Original bleibt unverändert und maßgeblich | ja |
| aktive Auslösung | ja |
| welche Daten verarbeitet werden | ja |
| dass ein externer Dienstleister sie verarbeitet | **ergänzt** — fehlte; ohne diesen Satz wäre die Information verschleiernd |
| Maskierung ist keine Anonymisierung | ja |
| sprachliche Transformation, keine medizinische Beratung | ja |
| **mögliche Fehler** | **ergänzt** — fehlte |
| was gespeichert wird | **korrigiert** — der Entwurf sagte „weder bei uns noch in deinem Gerät"; der PDF-Export legt aber auf Wunsch eine Datei beim Patienten ab |
| Rechte | ja |
| Widerruf bzw. Widerspruch | ja, als Variante je nach Feld 4 |
| wo die weitere Datenschutzinformation steht | **ergänzt** — fehlte |

Platzhalter bleiben an den Stellen, die von einer Entscheidung abhängen:
Rechtsgrundlage (Feld 2–4), Vorhaltedauer beim Dienstleister (A4) und
Empfängernennung (`LEGAL DISCLOSURE REQUIRED`, Feld 10). Der Entwurf nennt keine
Anbieter- oder Modellnamen.

---

## 11. Dritte im Dokument

**FACT.** Arztbriefe nennen regelmäßig Dritte: behandelnde, überweisende und
unterzeichnende Ärztinnen und Ärzte, gelegentlich Angehörige. **Familienanamnesen
enthalten Gesundheitsdaten Dritter** („Mutter mit Diabetes mellitus Typ 2"). Diese
Personen sind keine Nutzer von MedScoutX und werden nicht maskiert.

| Frage | Einschätzung |
|---|---|
| Rechtsgrundlage | **OPEN.** Eine Einwilligung des Patienten nach Art. 9 Abs. 2 lit. a erfasst **nur seine eigenen** Daten. Für Gesundheitsdaten Angehöriger in der Familienanamnese trägt sie nicht. Die DSGVO kennt keine Ausnahme für „mitverarbeitete" Daten. **Das ist die gewichtigste offene Rechtsfrage des Pakets.** |
| Informationspflicht | Art. 14 — die Daten stammen nicht von den Dritten |
| Ausnahme | Art. 14 Abs. 5 lit. b (*„unmöglich"* oder *„unverhältnismäßiger Aufwand"*) ist plausibel: MedScoutX kennt weder Identität noch Kontakt. Dann sind aber *„geeignete Maßnahmen"* zu ergreifen, *„einschließlich der Bereitstellung dieser Informationen für die Öffentlichkeit"* — also ein Abschnitt in der Datenschutzerklärung. Lit. d (Berufsgeheimnis) greift in V1 **nicht** für MedScoutX selbst (INTERPRETATION) |
| Verhältnismäßigkeit | Dritte haben keine Wahl und kein Wissen — hoher Eingriff bei geringem eigenem Nutzen |
| Technische Minimierung | **möglich, heute nicht umgesetzt**: musterbasierte Maskierung von Arzt- und Titelnennungen („Dr. med. …") und erkennbaren Verwandtschaftsbezeichnungen. Eine Umsetzung wäre eine eigene technische Folgemaßnahme und ist **nicht** Teil dieses Schritts |
| Betroffenenrechte | praktisch nicht ausübbar; über sie wird nichts gespeichert |
| DSFA | Risiko R3, verschärft durch Gesundheitsdaten Dritter (R15) |

**EXTERNAL** — Feld 12.

---

## 12. Aufbewahrung und Protokoll

| Kategorie | Zweck | Rechtsgrundlage | Aufbewahrung | Löschauslöser | Wirkung auf Betroffenenrechte |
|---|---|---|---|---|---|
| Originaldokument | Freigabe durch die Praxis | Praxis (S1) | nach Praxisregeln | Rückzug / Löschung durch Praxis | über die Praxis |
| Temporäre Extraktion | Vorbereitung | wie S2 | nur Arbeitsspeicher | Ende des Vorgangs | keine — nichts gespeichert (FACT) |
| Transformation | Anzeige | wie S2 | nicht gespeichert | — | keine (FACT) |
| Browserdaten | Anzeige | wie S2 | keine Speicherung, `no-store` | — | keine (FACT) |
| PDF-Export | Sicherung durch den Patienten | Handeln des Patienten für sich selbst (ErwG 18); MedScoutX erzeugt die Datei nur im Browser (FACT) | beim Patienten | Patient | MedScoutX hat keine Kopie (FACT) |
| Serverdaten sonst | — | — | keine | — | keine (FACT) |
| **Protokolleintrag** | Nachvollziehbarkeit, Missbrauchsschutz | **OPEN** — z. B. Art. 6 Abs. 1 lit. f oder c | keine eigene Frist; Kaskade bei Kontolöschung (FACT) | Kontolöschung; weitere **OPEN** | Auskunft über `patientUserId` möglich (FACT); Löschung vs. Rechenschaft **OPEN** — Feld 11 |
| **Backups** | Betriebssicherheit | Art. 6 Abs. 1 lit. f (INTERPRETATION) | **UNKNOWN** | **UNKNOWN** | Reichweite einer Löschung **UNKNOWN** |
| **Anbieter — Abuse Monitoring** | Missbrauchserkennung | Vertrag | laut Anbieter *„up to 30 days"* ohne ZDR (FACT) | Fristablauf | **UNKNOWN**, bis A4 |
| **Anbieter — Cache** | Performance | Vertrag | `in_memory` unter ZDR, sonst 30 min bis 24 h je Modellklasse (FACT) | Ablauf | abschaltbar über `prompt_cache_options.mode: explicit` ab `gpt-5.6` (FACT) |
| Support-/Fehlerlogs | Betrieb | Art. 6 Abs. 1 lit. f (INTERPRETATION) | der Transformationsendpunkt loggt nur einen Fehlercode (FACT); Aufbewahrung beim Hoster **UNKNOWN** | Hoster | kein Dokumentinhalt (FACT) |

---

## 13. Internationale Verarbeitung

| Punkt | Stand |
|---|---|
| Vertragspartei im EWR | OpenAI Ireland Ltd. laut Vertragsklausel (FACT; im Unterschriftenblock nicht ausgeschrieben) |
| EU-Datenresidenz | **nicht aktiv** für unser Projekt (FACT) — A3 |
| Weitergabe innerhalb der Anbietergruppe / an Unterauftragsverarbeiter außerhalb des EWR | **UNKNOWN** — Liste nicht abrufbar |
| Garantie für solche Transfers | **UNKNOWN** — Standardvertragsklauseln im DPA; ob Empfänger unter dem EU-US Data Privacy Framework (Durchführungsbeschluss (EU) 2023/1795 vom 10.07.2023) zertifiziert sind, ist **nicht geprüft** |
| Transfer Impact Assessment | **OPEN** — erforderlich, soweit Transfers auf Standardvertragsklauseln in Länder ohne Angemessenheitsbeschluss gestützt werden |
| Verhältnis zur EU-Datenresidenz | **INTERPRETATION:** Datenresidenz regelt den Ort der Speicherung und Verarbeitung der Anfragen. Sie schließt nicht aus, dass Support-, System- oder Missbrauchsdaten anders verarbeitet werden. **„EU-Datenresidenz = kein Drittlandrisiko" wird ausdrücklich nicht angenommen.** |

**EXTERNAL** — Feld 13, A3.

---

## 14. Medizinprodukt-Abgrenzung

**FACT** — MDCG 2019-11 rev.1 (Juni 2025), Entscheidungsbaum:
- **Schritt 3:** Software, die eine Aktion *über* Speicherung, Archivierung,
  Kommunikation, einfache Suche oder verlustfreie Kompression hinaus ausführt,
  *kann* Medizinprodukt-Software sein. Eine Übersetzung oder Vereinfachung ist
  **nicht verlustfrei** — dieser Schritt ist voraussichtlich erfüllt
  (INTERPRETATION).
- **Schritt 4:** Handlung zugunsten **einzelner** Patienten — voraussichtlich
  erfüllt (INTERPRETATION).
- **Schritt 5:** Liegt eine **medizinische Zweckbestimmung** nach Art. 2 Nr. 1 MDR
  vor? **Hier entscheidet sich die Einordnung.**

**FACT** — Die *Zweckbestimmung* ergibt sich nach Art. 2 Nr. 12 MDR aus
Kennzeichnung, Gebrauchsanweisung, **Werbe- und Verkaufsmaterial** und Angaben des
Herstellers. Produkt- und Marketingtexte bestimmen sie also mit.

**Sachlage (FACT):** sprachliche Transformation; keine Diagnose, keine
Therapieentscheidung, keine Prognose, keine Empfehlung. Erfundene
Handlungsanweisungen führen technisch zur Ablehnung des Ergebnisses. Das Original
bleibt unverändert, die Anzeige kennzeichnet das Ergebnis als sprachliche
Umformung, die keine medizinische Beratung ersetzt.

**Risiko (INTERPRETATION):** Die Fachübersetzung bleibt nah an der Kommunikation.
Die **Einfache Sprache** formuliert um, und Umformulieren grenzt an Interpretieren.
Jeder Text, der dem Patienten verspricht, seine *Diagnose zu verstehen* oder
Hinweise für sein *Handeln* zu bekommen, verschiebt die Zweckbestimmung.

> **Frage an den externen Prüfer:** *Kann diese konkrete Zweckbestimmung —
> sprachliche Transformation eines ärztlichen Dokuments ohne Diagnose, Therapie,
> Prognose oder Empfehlung — außerhalb einer medizinischen Zweckbestimmung nach
> Art. 2 Nr. 1 MDR bleiben? Entsteht durch die „Einfache Sprache" ein Risiko der
> Interpretation, und welche Formulierungen in Produkt, Hilfe und Marketing sind
> dann auszuschließen?*

**Keine MDR-Einstufung wird hier vorgenommen.**

---

## 15. AI Act

**FACT** — Verordnung (EU) 2024/1689, Art. 113: Geltung ab **2. August 2026**; Art. 50
ist damit anwendbar.

**FACT** — Art. 50 Abs. 2: *Anbieter* von KI-Systemen, die synthetische Texte
erzeugen, stellen sicher, dass die Ausgaben maschinenlesbar als künstlich erzeugt
markiert und erkennbar sind. Das gilt nicht, soweit die Systeme eine unterstützende
Funktion für die Standardbearbeitung ausführen oder die Eingabedaten *„or the
semantics thereof"* **nicht wesentlich verändern**.

**INTERPRETATION:**
- Die Fachübersetzung zielt auf unveränderte Semantik; die Ausnahme ist
  **vertretbar**.
- Die Einfache Sprache verändert die Form bewusst; die Ausnahme ist **zweifelhaft**.
- Ob MedScoutX *Anbieter* eines KI-Systems im Sinne des AI Act ist (Integration
  eines Allzweckmodells unter eigenem Namen) oder *Betreiber*, ist **OPEN**.
- Menschenlesbar ist das Ergebnis bereits gekennzeichnet („KI-generierte
  Übersetzung" bzw. „KI-generierte sprachliche Vereinfachung"), auch im
  exportierten PDF (FACT). Eine **maschinenlesbare** Markierung ist nicht umgesetzt — eine
  mögliche technische Folgemaßnahme, falls Art. 50 Abs. 2 als anwendbar bewertet
  wird.
- **Verknüpfung mit §14:** Wäre die Funktion ein Medizinprodukt, das der
  Konformitätsbewertung durch eine Benannte Stelle unterliegt, käme eine Einstufung
  als Hochrisiko-System nach Art. 6 Abs. 1 in Verbindung mit Anhang I in Betracht.
  Die MDR-Frage ist daher vorgelagert.

Keine weiteren Konstruktionen. Produkttexte werden dadurch **nicht** mit
KI-Begriffen angereichert; die Kennzeichnung am Ergebnis genügt der Transparenz
gegenüber dem Nutzer.

---

## 16. Risiko-Matrix (intern)

| Dimension | Einstufung | Begründung |
|---|---|---|
| **LEGAL** | **UNRESOLVED** | Rolle, Art.-6- und Art.-9-Grundlage offen; Gesundheitsdaten Dritter ohne erkennbare Grundlage (§11) |
| **PRIVACY** | **HIGH (inhärent) · Restrisiko UNRESOLVED** | Art.-9-Daten an externen Verarbeiter, schutzbedürftige Betroffene, Re-Identifikation, Dritte. Starke Minimierung ist umgesetzt, aber Anbieter-Aufbewahrung und Backups sind **UNKNOWN** |
| **CONTRACT** | **UNRESOLVED** | Transferbeschreibung des DPA widerspricht der planmäßigen Nutzung (§7); Modified Retention amendment ausstehend |
| **REGULATORY** | **MEDIUM** | Zweckbestimmung technisch und textlich auf Sprache begrenzt; Restrisiko „Einfache Sprache" (§14); Art. 50 AI Act teilweise zweifelhaft (§15). Interne Einschätzung, nicht geprüft |
| **TECHNICAL** | **LOW** | abgeschaltet, fail-closed, leere Host-Allowlist, 327 funktionsspezifische Tests; Integritätsprüfung gegen erfundene Werte und Anweisungen. Offen: Ablehnungsquote an echten Dokumenten |

`UNRESOLVED` wurde nicht auf `LOW` gesetzt.

---

## 17. Quellen

Alle am **2026-09-18** abgerufen.

| Quelle | Stand | Verwendet für |
|---|---|---|
| DSGVO, Textausgabe der BfDI „DSGVO – BDSG, Texte und Erläuterungen" (Info 1) — amtlicher Wortlaut, EUR-Lex war per Bot-Schutz nicht automatisiert abrufbar | März 2026, 1. Auflage | Art. 4 Nr. 11, 7, 9, 14 Abs. 5, 28, 35; ErwG 18, 51 |
| BDSG, ebd. | März 2026 | § 22 Abs. 1 Nr. 1 lit. b |
| EDPB, Guidelines 07/2020 on the concepts of controller and processor | v2.1, 7. Juli 2021 | Rn. 40, 42–43, 45, 54–55 |
| EDPB, Guidelines 05/2020 on consent | v1.1, 4. Mai 2020 | Rn. 42–44, 93, 98, 99, 121–123 |
| Art.-29-Gruppe, WP248 rev.01 (DSFA), vom EDPB übernommen | 4. Oktober 2017 | Neun Kriterien, Zwei-Kriterien-Regel |
| DSK, Liste der Verarbeitungstätigkeiten mit DSFA-Pflicht (nicht-öffentlicher Bereich) | Version 1.1, 17.10.2018 | Nr. 11, Nr. 17 |
| Verordnung (EU) 2024/1689 (AI Act), Art. 50, 113 — über den AI Act Service Desk der Kommission | — | Transparenz, Geltungsbeginn |
| Verordnung (EU) 2017/745 (MDR), Art. 2 Nr. 1, Nr. 12 — über MDCG 2019-11 | — | Zweckbestimmung |
| MDCG 2019-11 rev.1 | Juni 2025 | Entscheidungsschritte 3–5 |
| § 203 StGB, gesetze-im-internet.de | — | Abs. 1 Nr. 1, Abs. 3 S. 2, Abs. 4 S. 2 Nr. 1 |
| OpenAI, Data controls in the OpenAI platform; Prompt caching; Chat Completions API reference | 2026-09-18 | Aufbewahrung, Residenz, Caching |
| OpenAI Data Processing Addendum `v.010126` | 2026-08-16 (unterzeichnet) | Schedule 1 Nr. 5, Rollenzuordnung |

**Nicht abrufbar, daher nicht verwendet:** EuGH C-667/21 (Portal lieferte keinen
Inhalt) — die Kumulation Art. 6 / Art. 9 stützt sich hier stattdessen auf ErwG 51;
Unterauftragsverarbeiter-Liste des Anbieters (HTTP 403) — als **UNKNOWN** geführt.

---

## 18. Was aus den Entscheidungen technisch folgt

Damit erkennbar ist, dass hier eine abschließbare Liste bearbeitet wird und keine
offene:

| Feld | Technische Folge | Aufwand |
|---|---|---|
| 1, 2, 3 | Datenschutzerklärung: Zweck, Datenkategorie, Rechtsgrundlage, Empfänger | Textersetzung im deutschen Original, Sprachfassungen abgeleitet |
| 4, 5 | Einwilligung an- oder abwählen | eine serverseitige Prüfung plus ein Eintrag im Einwilligungskatalog; Oberfläche zum Erteilen und Widerrufen existiert |
| 6, 7 | Vertragsergänzung mit dem Dienstleister | außerhalb des Systems |
| 8 | DSFA bewerten und zeichnen | Entwurf liegt vor |
| 9 | Praxisinformation; AVV-Anpassung | Oberfläche existiert nicht und wäre zu bauen, **der einzige größere Punkt**; AVV außerhalb des Systems |
| 10 | Hinweis vor dem ersten Start | ein Element plus ein Textschlüssel in sechs Sprachen |
| 11 | Löschregel für Protokolleinträge | Abfrage existiert, Regel fehlt |
| 12 | je nach Entscheidung, z. B. zusätzliche Maskierungsmuster | offen |
| 13 | Endpunkt eintragen | eine Zeile, als geprüfter Commit, erst nach A3 |
| Z1 | Textauflagen für Produkt, Hilfe, Marketing | Textänderungen |
| Z2 | ggf. maschinenlesbare Markierung | kleine technische Folgemaßnahme |

Keine dieser Folgen wird vor der Zeichnung des Freigabebogens umgesetzt.

---

*Status: Vorprüfung abgeschlossen. `LEGAL PACKAGE = COMPLETE` ·
`LEGAL SIGN-OFF = PENDING EXTERNAL REVIEW`.*
