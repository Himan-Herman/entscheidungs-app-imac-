# Dokumenttransformation — Entscheidungs- und Freigabebogen

> **Für die datenschutzrechtliche Prüfung.** Dieses Dokument ist so gebaut, dass
> es **allein** bearbeitet werden kann. Die Anhänge vertiefen, sie sind nicht
> Voraussetzung.
>
> Es enthält keine Rechtsauffassung von uns, keine Vorentscheidung und keine
> Freigabe. Die Felder sind leer, weil sie leer sein müssen.
>
> **Keine Patientendaten, keine Zugangsdaten, keine Schlüssel.**

| | |
|---|---|
| **Gegenstand** | Sprachliche Transformation von Praxisdokumenten für Patienten |
| **Stand** | Technisch fertig, **nicht aktiv**. Beide Schalter aus, kein Dienstleister konfiguriert, es werden derzeit **keine** Daten übermittelt |
| **Was hier entschieden wird** | 13 Felder. Danach ist die Verarbeitung entweder freigegeben oder begründet abgelehnt |
| **Datum der Vorlage** | 2026-09-18 |
| **Status** | `LEGAL SIGN-OFF = PENDING EXTERNAL REVIEW` |
| **Verantwortliche Stelle (Anbieter der App)** | Himan Khorshidi, Einzelunternehmer — MedScoutX |
| **KI-Dienstleister** | OpenAI. Vertragspartei ist für Kunden im EWR laut Vertragsklausel **OpenAI Ireland Ltd.**; im Unterschriftenblock ist die Gesellschaft nicht ausgeschrieben |

---

## Teil 1 — Sachverhalt in einer halben Seite

Eine Praxis gibt einem Patienten ein Dokument frei — einen Arztbrief, einen
Entlassungsbericht oder eine Überweisung. Der Patient öffnet es in der App und
kann **ausdrücklich** eine von zwei Umformungen starten: eine Übersetzung in eine
andere Sprache, oder eine allgemeinverständliche Fassung in derselben Sprache.

Dazu wird der Text serverseitig aus der Datei gelesen, es werden die dem System
bekannten Angaben zur Person sowie Medikamente, Dosierungen, Messwerte und Daten
durch Platzhalter ersetzt, und die so vorbereiteten Textabschnitte werden an
einen externen KI-Dienstleister gesendet. Dessen Antwort wird auf erfundene Werte
und verlorene Platzhalter geprüft, die Platzhalter werden zurückgesetzt, das
Ergebnis wird angezeigt — und **nicht gespeichert**.

**Was übermittelt wird:** der Textinhalt eines medizinischen Dokuments. Also
Diagnosen, Befunde, Behandlungsverläufe — **besondere Kategorien nach Art. 9
Abs. 1 DSGVO**, und zwar **absichtlich und planmäßig**, nicht als Nebenwirkung.

**Was nicht übermittelt wird:** die Datei selbst, Kennungen von Dokument, Praxis
oder Patient, Kontodaten, Metadaten mit Personenbezug.

**Was gespeichert wird:** ein technischer Protokolleintrag pro Vorgang —
Zeitpunkt, welches Dokument, welche Praxis, Modus, Zielsprache, Ergebnis,
gehashte IP-Adresse. **Kein Dokumenttext, kein Ergebnis.** Dieser Eintrag ist
personenbezogen.

**Freiwilligkeit:** Es gibt keinen Automatismus. Ohne Klick passiert nichts. Das
Original bleibt unverändert und auch ohne die Funktion vollständig lesbar.

**Eine Einschränkung, die wir ausdrücklich nennen:** Die Maskierung ist **keine
Anonymisierung**. Sie verringert, was von einer Person erkennbar bleibt, aber ein
medizinischer Text bleibt über Kontext, Formulierung, genannte Einrichtungen oder
seltene Sachverhalte re-identifizierbar. Nichts an dieser Funktion darf als
anonym oder pseudonymisiert beschrieben werden.

**Zwei Punkte, die wir selbst als ungeklärt vorlegen, statt sie zu glätten:**

1. Unsere Live-Datenschutzerklärung nennt uns **Verantwortlichen** für die App.
   Der Auftragsverarbeitungsvertrag mit Praxen nennt uns **Auftragsverarbeiter**
   — und er gilt ausdrücklich nur für ein anderes Modul (Abrechnungsprüfung).
   Für Praxisdokumente ist bislang **gar keine Rolle beschrieben**.
2. Der Vertrag mit dem KI-Dienstleister bezeichnet die Übermittlung sensibler
   Daten in seinem eigenen Anhang als *nicht beabsichtigt*. Unser Anwendungsfall
   überträgt sie planmäßig.

---

## Teil 2 — Die 13 Entscheidungsfelder

Je Feld: die technische Realität, die uns erkennbaren Optionen, das
Entscheidungsfeld. **Die Option ist ein Vorschlag zur Auswahl, keine Empfehlung
von uns.**

### 1 — Rollenverteilung

**Realität.** Den Inhalt erstellt und veröffentlicht die Praxis. Ausgelöst wird
die Verarbeitung vom Patienten. Über Mittel und Zweck der Transformation
(Dienstleister, Modell, Maskierung, Prompt) entscheidet MedScoutX; die Praxis ist
nicht beteiligt und erfährt heute nichts davon.

☐ MedScoutX eigener Verantwortlicher  ☐ Auftragsverarbeiter der Praxis
☐ gemeinsame Verantwortlichkeit (Art. 26)  ☐ andere: `__________`

Auflage / Kommentar: `________________________________________________`

### 2 — Rechtsgrundlage Art. 6

**Realität.** Ausdrückliche Auslösung durch den Patienten; die Funktion ist
optional und das Original ohne sie vollständig nutzbar.

☐ Art. 6 (1)(a) Einwilligung  ☐ (b) Vertrag  ☐ (f) berechtigtes Interesse
☐ andere: `__________`

Auflage / Kommentar: `________________________________________________`

### 3 — Rechtsgrundlage Art. 9

**Realität.** Übermittelt werden Gesundheitsdaten, absichtlich. Die Maskierung
ändert daran nichts.

☐ Art. 9 (2)(a) ausdrückliche Einwilligung  ☐ (h) Gesundheitsversorgung
☐ andere: `__________`  ☐ keine tragfähige Ausnahme → Verarbeitung unzulässig

Auflage / Kommentar: `________________________________________________`

### 4 — Einwilligung erforderlich?

**Realität.** Die Einwilligungsinfrastruktur existiert vollständig (Erteilen,
Widerrufen, Versionierung, Protokollierung) und wird von dieser Funktion heute
**nicht** genutzt. Kein bestehender Einwilligungstyp deckt den Fall ab.

☐ **ja** → weiter mit Feld 5  ☐ **nein** → bewusste Auslösung plus
Vorabinformation genügt

Auflage / Kommentar: `________________________________________________`

### 5 — Falls ja: Granularität

**Realität.** Beides ist ohne Umbau umsetzbar.

☐ einmalig für den Dienst  ☐ je Dokument / je Vorgang  ☐ andere: `__________`

Widerruf soll bewirken: ☐ nur Sperre für die Zukunft
☐ zusätzlich Löschung der Protokolleinträge (siehe Feld 11)

### 6 — Deckt der bestehende Vertragsrahmen absichtliche Gesundheitsdaten?

**Realität.** Beidseitig unterzeichnetes *Data Processing Addendum* mit
OpenAI (EWR: OpenAI Ireland Ltd.), Fassung `v.010126`, vom 2026-08-16,
unverhandelt — Text identisch mit der öffentlichen Vorlage. OpenAI ist darin
als *Data Processor* eingeordnet. Schedule 1
Nr. 5 beschreibt die Übermittlung sensibler Daten als *nicht beabsichtigt, es sei
denn, der Nutzer fügt sie unerwartet in unstrukturierte Daten ein*. Die Begriffe
„besondere Kategorien", „Gesundheitsdaten" und „Artikel 9" kommen im Vertrag
nicht vor.

☐ **ja, ausreichend**  ☐ **nein** → weiter mit Feld 7

Auflage / Kommentar: `________________________________________________`

### 7 — Falls nein: erforderliche Ergänzung

☐ Addendum zum bestehenden Vertrag  ☐ gesonderte Vereinbarung
☐ anderer Dienstleister erforderlich  ☐ Verarbeitung so nicht zulässig
☐ andere: `__________`

**Hinweis von uns:** Eine europäische Datenverarbeitung beim Dienstleister
verlangt laut dessen Dokumentation ohnehin einen gesonderten Vertragszusatz
(*Modified Retention amendment*). Falls Feld 7 zum Tragen kommt, lässt sich
beides sinnvollerweise in einem Vorgang behandeln.

### 8 — Datenschutz-Folgenabschätzung

**Realität.** Ein vollständiger Entwurf liegt vor (Verarbeitung, Zwecke,
Datenkategorien, Betroffene, Empfänger, Ablauf, Erforderlichkeit, 18 technische
und 9 organisatorische Maßnahmen, 14 benannte Risiken). **Risikobewertung,
Restrisiko und Freigabe sind leer** — sie sind nicht unsere Entscheidung.

☐ DSFA erforderlich  ☐ nicht erforderlich, Begründung: `__________`

Falls erforderlich — wer bewertet und zeichnet:
☐ Verantwortlicher intern  ☐ Datenschutzbeauftragte:r  ☐ externe Beratung

Vorherige Konsultation der Aufsichtsbehörde (Art. 36)? ☐ ja ☐ nein

### 9 — Information oder Zustimmung der Praxis

**Realität.** Die Praxis erfährt heute nichts. Es gibt keine Anzeige, keine
Benachrichtigung und keinen Zustimmungsweg auf Praxisseite — eine solche
Oberfläche existiert nicht und müsste gebaut werden.

☐ keine Information nötig  ☐ Information genügt  ☐ Zustimmung/Opt-in nötig

Auflage / Kommentar: `________________________________________________`

### 10 — Patienteninformation vor dem ersten Start

**Realität.** Heute zeigt die Oberfläche vorab **nicht**, was mit dem Dokument
geschieht. Ein deutscher Entwurf liegt vor (Anhang, Abschnitt „B7") — mit
markierter Lücke genau dort, wo die Rechtsgrundlage stehen müsste.

☐ Entwurf inhaltlich freigegeben  ☐ freigegeben mit Änderungen (siehe Kommentar)
☐ Neufassung erforderlich

Muss der konkrete Empfänger namentlich genannt werden, und wo?
☐ in der Funktion selbst  ☐ in der Datenschutzerklärung  ☐ beides ☐ nein

Auflage / Kommentar: `________________________________________________`

### 11 — Aufbewahrung der Protokolleinträge

**Realität.** Ein Eintrag je Vorgang, der das Dokument erreicht hat — bei Erfolg
und bei Ablehnung. Reine Formfehler erzeugen keinen. Bei Kontolöschung werden die
Einträge automatisch mitgelöscht. **Eine eigene Frist ist nicht definiert.**

☐ auf Verlangen löschbar  ☐ Aufbewahrung aus Rechenschaftspflicht (Art. 5 Abs. 2)
☐ feste Frist: `______` Monate

**Offen und für uns nicht feststellbar:** ob und wie lange Sicherungskopien
bestehen und ob eine Löschung sie erreicht. Wir haben das als `UNKNOWN`
markiert statt eine Zusage zu machen, die wir nicht halten können.

Auflage / Kommentar: `________________________________________________`

### 12 — Personenbezogene Daten Dritter im Dokument

**Realität.** Ein Arztbrief nennt regelmäßig andere Personen — überweisende
Ärztinnen, Unterzeichner, gelegentlich Angehörige. Diese werden **nicht
maskiert**, erfahren von der Verarbeitung nichts und können ihre Rechte
praktisch nicht ausüben. Über sie wird nichts gespeichert; ihre Namen standen im
übermittelten Text.

☐ hinnehmbar, keine Maßnahme  ☐ zusätzliche Maßnahme erforderlich: `__________`
☐ Verarbeitung so nicht zulässig

Auflage / Kommentar: `________________________________________________`

### 13 — Internationale Verarbeitung und Empfängertransparenz

**Realität.** Heute wird **nichts** übermittelt. Eine Aktivierung ist technisch
nur möglich, wenn ein geprüfter Endpunkt eingetragen wird — die Liste ist leer,
und das Eintragen ist ein reviewter Codeänderungsschritt. Der Dienstleister
dokumentiert einen europäischen Endpunkt; ob **unser** Projekt dafür
freigeschaltet ist, ist offen. Unsere Live-Datenschutzerklärung nennt für andere
Datenarten (eigene Eingaben des Patienten) derzeit OpenAI LLC, USA, mit
Transfer unter Standardvertragsklauseln — bei europäischer Verarbeitung dieser
Funktion entstünde dort ein direkter Widerspruch.

☐ nur Verarbeitung in der EU/EWR zulässig
☐ Drittland zulässig unter: `__________`
☐ Entscheidung erst nach Vorlage der Bestätigung des Dienstleisters

Empfänger in der Datenschutzerklärung namentlich zu nennen? ☐ ja ☐ nein

Auflage / Kommentar: `________________________________________________`

---

## Teil 3 — Gesamtergebnis

☐ **Verarbeitung freigegeben** unter den oben eingetragenen Auflagen
☐ **Freigegeben nach Erfüllung von:** `__________________________________`
☐ **Nicht freigegeben.** Begründung: `__________________________________`

| | |
|---|---|
| Name | `__________________________` |
| Funktion / Rolle | `__________________________` |
| Organisation | `__________________________` |
| Datum | `__________________________` |
| Unterschrift bzw. schriftliche Bestätigung | `__________________________` |

> Eine schriftliche Bestätigung per E-Mail genügt, sofern sie eindeutig auf
> dieses Dokument und sein Datum Bezug nimmt.

---

## Teil 4 — Was nach der Freigabe passiert

Damit erkennbar ist, dass hier keine offene Liste bearbeitet wird, sondern eine
abschließbare:

| Feld | Technische Folge | Aufwand |
|---|---|---|
| 1, 2, 3 | Datenschutzerklärung: Zweck, Datenkategorie, Rechtsgrundlage, Empfänger | Textersetzung im deutschen Original, 21 Sprachfassungen abgeleitet |
| 4, 5 | Einwilligung an- oder abwählen | **zwei Zeilen Server-Code** plus ein Eintrag im Einwilligungskatalog; Oberfläche zum Erteilen und Widerrufen existiert bereits |
| 6, 7 | Vertragsergänzung mit dem Dienstleister | außerhalb des Systems |
| 8 | DSFA finalisieren und zeichnen | Entwurf liegt vollständig vor |
| 9 | Praxisinformation | Oberfläche existiert nicht und wäre zu bauen — **der einzige größere Punkt** |
| 10 | Hinweis vor dem ersten Start | ein Element plus ein Textschlüssel in sechs Sprachen |
| 11 | Löschregel für Protokolleinträge | Abfrage existiert, Regel fehlt |
| 12 | je nach Entscheidung | offen |
| 13 | Endpunkt eintragen | eine Zeile, als reviewter Commit |

---

## Anhänge

Nur bei Bedarf. Der Bogen oben ist ohne sie vollständig bearbeitbar.
Bei externer Weitergabe werden die Anhänge als eigene Dateien mitgeliefert;
die Verweise unten benennen genau diese Dateien. Der unterzeichnete Vertrag
selbst liegt außerhalb dieses Pakets und wird auf Anforderung gesondert
übergeben.

| Anhang | Inhalt |
|---|---|
| [Legal Review Packet](DOCUMENT_TRANSLATION_LEGAL_REVIEW_PACKET.md) | ausführliche Sachverhaltsdarstellung, Datenflussgrenze, Vertragslage |
| [Entscheidungsmatrix](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md) | technische Realität je Frage; Textbausteine für AVV, Datenschutzerklärung und Patienteninformation; beide Einwilligungsvarianten vollständig |
| [DSFA-Entwurf](DOCUMENT_TRANSLATION_DPIA_DRAFT.md) | gehört zu Feld 8 |
| [Betroffenenrechte-Runbook](DOCUMENT_TRANSLATION_DATA_SUBJECT_RIGHTS_RUNBOOK.md) | gehört zu Feld 11 und 12 |
| [Evidence Register](DOCUMENT_TRANSLATION_EVIDENCE_REGISTER.md) | Nachweisstand je Anforderung, inkl. was der Dienstleister noch bestätigen muss |

---

*Solange dieser Bogen nicht gezeichnet ist, bleibt die Funktion abgeschaltet.
Das ist kein Vorbehalt, sondern der tatsächliche Systemzustand: ohne
eingetragenen Endpunkt kann sie technisch nicht laufen.*
