# Datenschutz-Folgenabschätzung — Dokumenttransformation (ENTWURF)

> ⚠️ **ENTWURF. Keine abgeschlossene DSFA, keine Rechtsberatung, keine Freigabe.**
>
> Dieses Dokument beschreibt die Verarbeitung vollständig und benennt die
> Risiken. Es trifft **keine** Aussage darüber, ob eine DSFA erforderlich ist, ob
> die Verarbeitung zulässig ist oder ob ein Restrisiko akzeptabel ist. Diese
> Bewertungen sind ausdrücklich offen gelassen und mit `OFFEN` markiert.
>
> **Enthält keine Patientendaten, keine Zugangsdaten, keine Schlüssel.**

| | |
|---|---|
| **Gegenstand** | Sprachliche Transformation von der Praxis freigegebener medizinischer Dokumente |
| **Status** | `B5 = OPEN – DPIA draft prepared` |
| **Verarbeitung aktiv?** | **Nein.** Beide Feature-Flags aus, kein Provider konfiguriert, `APPROVED_PROVIDER_HOSTS` leer. Es werden derzeit **keine** Daten übermittelt. |
| **Technischer Stand** | `TECHNICAL IMPLEMENTATION = COMPLETE`, Referenzstand `18884e03` |
| **Erstellt** | 2026-09-18 |
| **Erstellt von** | Rolle: Entwicklung/Technik. **Keine datenschutzrechtliche Bewertung.** |
| **Freigabe** | offen — siehe §14 |
| **Nächste Überprüfung** | offen — siehe §15 |

Vorher prüfen: Im Repository existierte **keine** DSFA und keine DSFA-Vorlage
(Stand 2026-09-18, geprüft über `docs/legal/`, `docs/production/` und den
gesamten Baum). Dies ist die erste.

---

## 1. Beschreibung der Verarbeitung

Ein Patient öffnet in der MedScoutX-App ein Dokument, das seine Praxis ihm
freigegeben hat — einen Befund, einen Entlassungsbericht oder eine Überweisung.
Er wählt eine Zielsprache und eine von zwei Darstellungen und startet die
Transformation ausdrücklich.

Serverseitig wird der Text aus der Datei extrahiert, maskiert, in Segmente
zerlegt und an einen externen Anbieter zur sprachlichen Umformung übermittelt.
Die Antwort wird auf Integrität geprüft, die Maskierungen werden wieder
eingesetzt, das Ergebnis wird angezeigt. **Es wird nicht gespeichert.**

Zwei Modi:

- **Fachübersetzung** — derselbe fachliche Detailgrad in einer anderen Sprache.
- **Einfache Sprache** — derselbe Inhalt ohne unnötigen Fachjargon.

Quellsprache ist ausschließlich Deutsch, und sie wird **deklariert, nie
erraten**. Sechs Zielsprachen.

---

## 2. Zwecke

| Zweck | Beschreibung |
|---|---|
| Sprachliche Zugänglichkeit | Ein Patient, dessen Sprache nicht Deutsch ist, kann ein Dokument lesen, das ihn betrifft |
| Verständlichkeit | Medizinische Fachsprache in eine Fassung bringen, die ein Laie versteht |

**Nicht** Zweck: Diagnose, Therapieempfehlung, Triage, Entscheidungsunterstützung,
Modelltraining, Profilbildung, Analyse über Patienten hinweg.

Die Funktion ersetzt das Original nicht und verändert es nicht.

---

## 3. Kategorien personenbezogener Daten

### 3.1 Was den externen Anbieter erreicht

| Kategorie | Anmerkung |
|---|---|
| Gesundheitsdaten (Art. 9 Abs. 1) | Diagnosen, Befunde, Behandlungsverläufe — der eigentliche Inhalt |
| Medikation und Dosierung | **maskiert** — als unteilbare Einheit ersetzt |
| Messwerte, Referenzbereiche, Datumsangaben | **maskiert** |
| Bekannte Identifikatoren des Patienten | **maskiert** — Name, Geburtsdatum, E-Mail, Telefon, Versicherten- und Patientennummer, soweit in der Datenbank hinterlegt |
| Daten Dritter | **nicht maskiert** — überweisende Ärztinnen, Unterzeichner, Angehörige, genannte Einrichtungen |
| Nicht deterministisch maskierbare Angaben | Die Maskierung kennt nur hinterlegte und musterbasiert erkennbare Werte |
| Kontextinformation | Ergibt sich aus dem Zusammenhang, nicht aus einzelnen Feldern |

**Nicht übermittelt:** die Originaldatei, Dokument-, Datei-, Praxis- oder
Patientenkennungen, Kontodaten, Metadaten mit Personenbezug.

### 3.2 Was MedScoutX speichert

Ein Audit-Datensatz je Transformation, die das Dokument erreicht hat — bei Erfolg
und bei Ablehnung. Eine Anfrage, die bereits an ihrer Form scheitert, erzeugt
**keinen**.

| Feld | Inhalt |
|---|---|
| `userId`, `patientUserId` | interne Kennung des Patienten (beide gesetzt) |
| `entityId` | interne Kennung des Dokuments |
| `practiceProfileId` | interne Kennung der Praxis |
| Modus, Zielsprache | `strict_translation` / `plain_language`, Sprachcode |
| Ergebnis | Erfolg oder Fehlerkategorie |
| Technische Kennzahlen | Modell, Promptversion, Segmentanzahl, Versuche, Dauer |
| IP-Adresse | **gehasht**, nie im Klartext |
| User-Agent | wie übermittelt |

**Dieser Datensatz ist personenbezogen.** Er belegt, dass eine bestimmte Person zu
einem bestimmten Zeitpunkt ein bestimmtes Dokument transformieren ließ. Er
enthält keinen Dokumenttext, keine Diagnose, keine Medikation und kein Ergebnis.

---

## 4. Betroffene Personen

| Gruppe | Betroffenheit |
|---|---|
| **Patienten** | unmittelbar; sie lösen aus und ihr Dokument wird verarbeitet |
| **Dritte im Dokument** | mittelbar und **ohne eigene Handlung** — überweisende Ärztinnen, Unterzeichner, genannte Angehörige. Sie werden nicht maskiert, wissen nichts davon und haben keine Wahl. **Eigenes Risiko, siehe §10.** |
| **Praxen** | als Urheber des Dokuments; erfahren heute nichts von der Weiterverarbeitung |

---

## 5. Empfänger

| Empfänger | Was | Status |
|---|---|---|
| Externer KI-Anbieter | vorbereitete Textsegmente | **heute keiner konfiguriert**; Region und Aufbewahrung `UNKNOWN` (A3/A4) |
| Hosting- und Datenbankbetreiber | Audit-Datensatz als Teil des Datenbestands | bestehende Infrastruktur |
| Praxis | **nichts** aus diesem Vorgang | — |

Die Rolle des Anbieters in der Kette ist Gegenstand von
[Entscheidung 2.1](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md).

---

## 6. Verarbeitungsschritte

```
  1  Anfrageform prüfen          geschlossene Schlüsselliste; kein Dokument annehmbar
  2  Sprache und Modus prüfen    Allowlist, bevor irgendetwas geladen wird
  3  Herkunft prüfen             neun kumulative Bedingungen (§7)
  4  Gleiche Sprache?            de→de fachlich: Original zurück, kein Modell
  5  Provider-Gate               ohne eigene Konfiguration: Abbruch
  6  Datei lesen                 aus dem Speicher, nie aus der Anfrage
  7  Text extrahieren            isolierter Thread, Speicher- und Zeitgrenze
  8  Vorbereiten                 Sprache, Maskierung, Medikation, Dosierung, Negation
─────────────────────────────────────────────────────  hier wird die Grenze überschritten
  9  Anbieter aufrufen           nur maskierte Segmente
─────────────────────────────────────────────────────
 10  Antwort validieren          Schema, Kennungen, Reihenfolge
 11  Integrität prüfen           Platzhalter, erfundene Zahlen, erfundene Anweisungen
 12  Höchstens ein Reparaturlauf gleiche Segmente, strengere Anweisung, kein neuer Kontext
 13  Maskierung zurücksetzen     erst wenn alles davor bestanden hat
 14  Protokollieren              nur Metadaten
```

Die Grenze wird **genau einmal** überschritten, und zwar mit vorbereitetem Text.

---

## 7. Notwendigkeit und Verhältnismäßigkeit

**Zweckbindung.** Nur Dokumente, die die Praxis bereits an den Patienten
freigegeben hat. Es gibt keinen Upload-Pfad: der Patient kann nichts einreichen,
was nicht schon aus dieser Beziehung stammt.

**Datenminimierung.** Übermittelt wird Text, nie die Datei. Kritische Werte und
bekannte Identifikatoren sind vorher ersetzt. Die Segmentierung überträgt das
Dokument nicht als Ganzes. Es werden keine Kennungen mitgesendet.

**Neun kumulative Bedingungen vor jeder Verarbeitung:** Dokument gehört dem
angemeldeten Patienten · Status „freigegeben" · aktive, unabgelaufene Freigabe ·
nicht gelöscht · Praxisverknüpfung vorhanden · Verknüpfung gehört zu demselben
Patienten **und** derselben Praxis · Verknüpfungsstatus `active` (strenger als im
übrigen System: eine noch nicht angenommene Verknüpfung wird abgelehnt) · Datei
gehört zu genau diesem Dokument · Dokumenttyp auf der Allowlist.

**Erforderlichkeit.** `OFFEN` — ob das Ziel mit einem milderen Mittel erreichbar
wäre (etwa rein lokale Verarbeitung, oder ein Anbieter mit vertraglich
zugesicherter EU-Verarbeitung), ist Teil der rechtlichen Bewertung und wird hier
nicht beantwortet.

**Freiwilligkeit.** Expliziter Start, kein Auto-Lauf, kein Vorbelegen, keine
Wiederholung ohne neue Handlung. Das Original bleibt ohne die Funktion
vollständig nutzbar — die Freiwilligkeit hängt an der Architektur, nicht an einem
Text.

---

## 8. Technische Schutzmaßnahmen

Implementiert und durch Tests belegt (327 funktionsspezifische Servertests grün).

| Maßnahme | Wirkung |
|---|---|
| Keine Patienten-Uploads | Nur freigegebene Praxisdokumente sind transformierbar |
| Dokumenttyp-Allowlist | Nur Befund, Entlassungsbericht, Überweisung. Laborbefunde ausgeschlossen: ihre Bedeutung liegt in der Tabellenstruktur |
| Dateityp-Allowlist | Nur PDF und DOCX; Bilder vor jedem Parsen abgelehnt, kein OCR |
| Aktive Verknüpfung erforderlich | Nach Widerruf der Praxisbeziehung keine Transformation mehr |
| Lokale Extraktion | Die Originaldatei verlässt den Server nie |
| Isolierter Parser | Eigener Thread, 256 MB Speichergrenze, Abbruch per `terminate()` — ein bösartiges Dokument kann den Dienst nicht blockieren |
| Deterministische Maskierung | Bekannte Patientenidentifikatoren; kein Modell, keine Entitätserkennung |
| Medikations- und Dosierungsmaskierung | Als unteilbare Einheit. Nicht absicherbarer Kontext führt zur **Ablehnung des ganzen Dokuments**, nicht zu einer Übersetzung auf gut Glück |
| Segmentierung | Keine Übertragung des Dokuments am Stück |
| Keine Werkzeuge, kein Browsing, kein Retrieval, kein Dateitransfer | Der Dienst erhält Text und gibt Text zurück |
| Keine Konversationshistorie | Jede Anfrage isoliert; kein Bezug zwischen Patienten oder Dokumenten |
| Kein Speicherparameter | Es wird keine anbieterseitige Speicherung angefordert |
| Integritätsprüfung | Erfundene Zahlen, verlorene Platzhalter oder erfundene Handlungsanweisungen führen zur Ablehnung des Gesamtergebnisses |
| Höchstens ein Reparaturlauf | Keine wiederholte Übertragung, keine Eskalation auf ein anderes Modell |
| Keine Persistenz | Weder Ergebnis noch Zwischenstände, weder serverseitig noch im Browser (`no-store`) |
| Ratenbegrenzung | Pro IP und **pro Patient und Tag**; dazu nur ein Lauf gleichzeitig je Patient |
| Fail-closed | Jede unklare Lage endet mit Ablehnung, nicht mit Übertragung |
| Zwei getrennte Schalter, beide aus | Server- und Client-Flag, keiner in einer Produktionskonfiguration gesetzt |
| Kill Switch | Abschaltung über die Umgebungsvariable, ohne Code-Änderung |
| Leere Host-Allowlist | Produktion ist **technisch nicht konfigurierbar**, solange kein Host geprüft eingetragen ist |

### Ausdrückliche Einschränkung

> **Die Maskierung ist keine Anonymisierung.**
>
> Sie reduziert die übermittelten Identifikatoren erheblich, stellt aber keine
> vollständige Anonymisierung sicher. Der übermittelte Text bleibt medizinischer
> Inhalt; eine Re-Identifikation über Kontext, Formulierung, genannte
> Einrichtungen oder seltene Sachverhalte ist nicht ausgeschlossen. Die
> Verarbeitung ist als Verarbeitung personenbezogener Daten zu bewerten.

---

## 9. Organisatorische Schutzmaßnahmen

| Maßnahme | Stand |
|---|---|
| Vier-Augen-Prinzip für die Aktivierung | Die Host-Allowlist ist leer; sie zu füllen ist eine geprüfte Code-Änderung — nicht ein Schalter, den eine Person umlegen kann |
| Getrennte Zugangsdaten | Der Code **verweigert** die Wiederverwendung des allgemeinen API-Schlüssels; ein eigener ist zwingend |
| Evidenzführung | `DOCUMENT_TRANSLATION_EVIDENCE_REGISTER.md`, sechswertiges Statusmodell, Beleg je Zeile |
| Freigaberegel | Jede Pflichtzeile `VERIFIED` oder `NO-GO`. Keine Mehrheit, keine Teilaktivierung |
| Trennung der Prüfdimensionen | Technische Sicherheit und rechtliche Zulässigkeit werden getrennt geführt und ersetzen einander nicht |
| Betroffenenrechte-Prozess | `DOCUMENT_TRANSLATION_DATA_SUBJECT_RIGHTS_RUNBOOK.md` |
| Schulung der handelnden Personen | `OFFEN` — nicht dokumentiert |
| Meldeprozess bei Datenschutzverletzungen für diesen Ablauf | `OFFEN` — kein spezifischer Prozess dokumentiert |
| Regelmäßige Überprüfung der Maßnahmen | `OFFEN` — keine Kadenz festgelegt |

---

## 10. Risiken

Benannt, nicht bewertet. Eintrittswahrscheinlichkeit und Schwere sind bewusst
`OFFEN` — ihre Einschätzung ist Teil der ausstehenden Bewertung.

| # | Risiko | Für wen | Bestehende Minderung | Rest |
|---|---|---|---|---|
| R1 | Gesundheitsdaten erreichen einen externen Empfänger | Patient | Maskierung, Segmentierung, keine Kennungen, keine Datei | **bleibt** — das ist der Zweck der Funktion, nicht ein Fehler |
| R2 | Re-Identifikation trotz Maskierung | Patient | Maskierung bekannter Identifikatoren | **bleibt** — seltene Diagnosen, Kontext, genannte Einrichtungen |
| R3 | Daten Dritter werden ohne deren Wissen übermittelt | Dritte | keine | **ungemindert** — Dritte werden nicht maskiert und haben keine Wahl. Ihre Betroffenenrechte sind praktisch nicht ausübbar, weil sie von der Verarbeitung nichts erfahren |
| R4 | Anbieterseitige Speicherung oder Caching | Patient | kein Speicherparameter gesetzt | **`UNKNOWN`** — A4, A7, A8 sind offen; A3/A4 wurden nie beantwortet |
| R5 | Drittlandverarbeitung ohne tragfähige Garantie | Patient | Host-Allowlist leer, Produktion nicht konfigurierbar | `OFFEN` — A3, A13 |
| R6 | Vertragsrahmen deckt Gesundheitsdaten nicht | Patient | DPA existiert | **erkannt und offen** — A1a; der Vertrag nennt sensible Daten *unbeabsichtigt* |
| R7 | Inhaltliche Verfälschung (Dosierung, Medikament, Verneinung) | Patient | atomare Maskierung, Integritätsprüfung, Ablehnung statt Rateversuch, Negationsprüfung | gemindert; Anzeige weist auf den Vorrang des Originals hin |
| R8 | Fehlinterpretation des Ergebnisses als medizinische Aussage | Patient | Hinweise „ersetzt keine Beratung" und „Original maßgeblich" | `OFFEN` — Wirksamkeit nicht gemessen |
| R9 | Ablehnungsquote: berechtigte Dokumente werden nicht übersetzt | Patient | bewusst in Kauf genommen | **Quote unbekannt** — nur an einem echten Korpus messbar; sie wird nicht als niedrig behauptet |
| R10 | Audit-Metadaten offenbaren Verhalten | Patient | nur Metadaten, IP gehasht | **bleibt** — der Datensatz belegt Zeitpunkt und Dokument |
| R11 | Keine Frist für Audit-Daten | Patient | Löschung per Kaskade bei Kontolöschung | `OFFEN` — 2.9 der Entscheidungsmatrix |
| R12 | Aufbewahrung in Backups | Patient | keine | **`UNKNOWN`** — im Repository ist keine Backup-Retention dokumentiert |
| R13 | Praxis erfährt nichts von der Weiterverarbeitung | Praxis, Patient | keine | `OFFEN` — 2.7 |
| R14 | Versehentliche Aktivierung | Patient | zwei Flags aus, Provider-Gate, leere Host-Allowlist, Fake-Anbieter in Produktion gesperrt | gering; mehrere unabhängige Sperren |

---

## 11. Restrisiken

```
OFFEN — nicht bewertet.
```

Diese Bewertung setzt die Entscheidungen zu Rollen, Rechtsgrundlage, Art. 9 und
Vertragsumfang voraus sowie die noch fehlende Provider-Evidenz zu A3, A4, A7, A8.
Ohne sie wäre jede Aussage über die Akzeptabilität eines Restrisikos eine
Behauptung ohne Grundlage.

**Es wird hier ausdrücklich nicht gesagt, das Restrisiko sei akzeptabel.**

---

## 12. Offene Rechtsfragen

Vollständig in der
[Entscheidungsmatrix](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md) §2 und im
[Legal Review Packet](DOCUMENT_TRANSLATION_LEGAL_REVIEW_PACKET.md) §11.
Kurzfassung:

1. Rollen (Verantwortlicher, Auftragsverarbeiter, gemeinsame Verantwortlichkeit)
2. Rechtsgrundlage nach Art. 6
3. Ausnahme nach Art. 9 Abs. 2
4. Einwilligung erforderlich — ja/nein
5. Vertraglicher Umfang für Gesundheitsdaten (A1a)
6. Ist eine DSFA erforderlich — **diese Frage ist Voraussetzung dieses Dokuments,
   nicht sein Ergebnis**
7. Information oder Zustimmung der Praxis
8. Umfang der Patienteninformation
9. Löschung oder Aufbewahrung der Audit-Metadaten
10. Bewertung der internationalen Verarbeitung und der Empfängernennung
11. Umgang mit den Rechten Dritter, die im Dokument genannt sind (R3)

---

## 13. Konsultation

| | |
|---|---|
| Datenschutzbeauftragte:r | `OFFEN` — ob benannt, ist im Repository nicht dokumentiert |
| Externe Beratung | Prüfunterlage vorbereitet; Beauftragung `OFFEN` |
| Betroffene oder deren Vertreter (Art. 35 Abs. 9) | `OFFEN` — nicht erfolgt |
| Vorherige Konsultation der Aufsichtsbehörde (Art. 36) | `OFFEN` — hängt an §11 |

---

## 14. Freigabe

> Nicht ausfüllen, solange §11 offen ist.

| Feld | Eintrag |
|---|---|
| DSFA erforderlich? | ☐ ja ☐ nein — Begründung: `__________` |
| Restrisiko bewertet als | ☐ gering ☐ mittel ☐ hoch — `__________` |
| Restrisiko akzeptabel? | ☐ ja ☐ nein |
| Vorherige Konsultation erforderlich? | ☐ ja ☐ nein |
| Verantwortliche Rolle | `__________` |
| Name und Funktion | `__________` |
| Datum | `__________` |
| Unterschrift | `__________` |

**Solange dieses Feld leer ist, gilt: `B5 = OPEN – DPIA draft prepared`.**
Ein vorbereiteter Entwurf ist Vorbereitung, kein Nachweis.

---

## 15. Überprüfung

| Anlass | Frist |
|---|---|
| Regelmäßig | `OFFEN` — vorgeschlagen: jährlich, festzulegen bei Freigabe |
| Anlassbezogen | bei Wechsel des Anbieters, der Region, des Modells oder der Aufbewahrung; bei Erweiterung der Dokument- oder Quellsprachen; bei jeder Änderung der Maskierung; vor jeder Aktivierung |
| Nächste Überprüfung | `OFFEN` — zu setzen bei Freigabe |

---

*Status: **ENTWURF — nicht abgeschlossen, nicht freigegeben.** Verarbeitung
nicht aktiv.*
