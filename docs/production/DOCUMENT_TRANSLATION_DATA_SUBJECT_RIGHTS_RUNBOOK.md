# Betroffenenrechte — Betriebsanweisung für die Dokumenttransformation

> **Betriebsanweisung, keine Rechtsberatung.** Sie beschreibt, was im realen
> MedScoutX-System tatsächlich passiert, wenn ein Patient ein Datenschutzrecht
> ausübt und dabei die Dokumenttransformation berührt ist.
>
> Wo eine Antwort von einer noch ausstehenden rechtlichen Entscheidung abhängt,
> steht `LEGAL DECISION REQUIRED` mit Verweis. Wo etwas schlicht nicht bekannt
> ist, steht `UNKNOWN`. Beides wird nicht überbrückt.
>
> **Enthält keine Patientendaten, keine Zugangsdaten, keine Schlüssel.**

**Status:** `B6 = OPEN`. Technisch adressierbar, prozessual offen an den in §8
genannten Stellen.

**Wichtig vorweg:** Die Funktion ist **nicht aktiv**. Es existieren daher heute
**keine** Audit-Datensätze aus produktiver Nutzung. Diese Anweisung beschreibt
den Prozess für den Fall der Aktivierung — und gilt ab dem ersten produktiven
Lauf.

---

## 1. Die Ausgangsfrage bei jedem Ersuchen

Bevor irgendetwas anderes geschieht, ist **eine** Frage zu klären:

> Betrifft das Ersuchen das **Dokument** oder die **Nutzung der Funktion**?

Das sind zwei verschiedene Datenbestände mit zwei verschiedenen Stellen:

| Gegenstand | Wer hält die Daten | Weg |
|---|---|---|
| Der Arztbrief selbst, seine Inhalte, seine Freigabe | die **Praxis** — sie hat ihn erstellt und freigegeben | bestehender Pfad `PatientDataRequest` (Typ `deletion`, `access_restriction`, `export`) an die Praxis; im Patientenbereich unter Datenkontrolle |
| Dass und wann eine Transformation lief | **MedScoutX** — Audit-Datensatz | Prozess in dieser Anweisung |
| Das Transformationsergebnis | **niemand** — es wird nicht gespeichert | keine Maßnahme möglich oder nötig |

Die Verantwortlichkeit für den zweiten Bestand hängt an der Rollenentscheidung.
`LEGAL DECISION REQUIRED` —
[Entscheidungsmatrix 2.1](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md).
Bis dahin gilt: Anfragen zum Audit-Bestand werden **von MedScoutX beantwortet**
und die Rollenfrage wird im Antwortschreiben nicht behauptet.

---

## 2. Was überhaupt existiert

Eine vollständige Antwort setzt voraus, dass klar ist, wonach zu suchen ist.

| Bestand | Ort | Auffindbar über | Enthält |
|---|---|---|---|
| Audit-Datensatz je Transformation | Tabelle `AuditLog` | `patientUserId` **und** `userId` (beide gesetzt), Aktion `document_translation.completed` / `.failed` | Zeitpunkt, Dokumentkennung, Praxiskennung, Modus, Zielsprache, Ergebnis, technische Kennzahlen, gehashte IP, User-Agent |
| Originaldokument | Praxisdokumentbestand | bestehende Dokumentverwaltung | unverändert; von dieser Funktion nicht berührt |
| Transformationsergebnis | — | — | **existiert nicht** |
| Dokumenttext, Segmente, Providerantwort | — | — | **existiert nicht**; nur im Arbeitsspeicher während des Laufs |
| Temporäre Dateien | — | — | **existieren nicht**; die Funktion schreibt nichts auf die Platte |
| Browser-Speicher | — | — | **nichts**; Antwort ist als nicht zwischenspeicherbar markiert, kein `localStorage`, kein `sessionStorage`, kein IndexedDB |

**Dass beide Kennungen gesetzt sind, ist die Voraussetzung dafür, dass eine
Auskunft vollständig sein kann.** Bis Commit `07757b7d` trug der Datensatz nur
`userId`; eine Suche über den `patientUserId`-Index hätte jede Transformation
übersehen. Das ist behoben und durch einen Test abgesichert.

---

## 3. Auskunft (Art. 15)

**Auslöser:** Patient fragt, welche Daten zu ihm gespeichert sind.

1. **Identität prüfen** — über das angemeldete Konto; bei Anfragen außerhalb der
   App nach dem allgemeinen Verfahren. Keine Auskunft ohne Zuordnung.
2. **Abfragen** — `AuditLog` nach `patientUserId` **oder** `userId`, gefiltert auf
   die Aktionen `document_translation.completed` und `document_translation.failed`.
   Beide Felder abfragen, nicht nur eines.
3. **Zusammenstellen**, je Datensatz in Klartext:
   - Zeitpunkt
   - um welches Dokument es ging (Bezeichnung, nicht die interne Kennung)
   - welche Praxis das Dokument freigegeben hatte
   - Übersetzung oder einfache Sprache
   - Zielsprache
   - ob es erfolgreich war oder abgelehnt wurde
4. **Mitteilen, was es nicht gibt** — und das ist ein Teil der Antwort, kein
   Weglassen: kein gespeicherter Dokumenttext, kein gespeichertes Ergebnis, keine
   Kopie dessen, was verarbeitet wurde.
5. **Empfänger benennen** — `LEGAL DECISION REQUIRED`, Umfang folgt aus
   [2.10](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md). Nicht stillschweigend
   weglassen.
6. **Zum Dokument selbst** an die Praxis verweisen (§1).

**Frist:** ein Monat, verlängerbar nach Art. 12 Abs. 3.

---

## 4. Berichtigung (Art. 16)

**Auf den Audit-Bestand anwendbar? Im Regelfall nein.** Der Datensatz behauptet
keine Tatsache über die Person, sondern protokolliert ein Ereignis. Ein Protokoll
ist nicht „unrichtig", weil sein Inhalt unerwünscht ist.

**Wohl anwendbar:**

- auf **Stammdaten**, die in die Maskierung einfließen (Name, Geburtsdatum,
  Kontaktdaten). Bestehende Kontoverwaltung. **Wirkung für diese Funktion:**
  korrigierte Daten verbessern die Maskierung künftiger Läufe — rückwirkend
  ändert sich nichts, weil nichts gespeichert ist.
- auf den **Inhalt des Dokuments** — das ist Sache der Praxis, nicht von
  MedScoutX.

Behauptet ein Patient, ein Protokolleintrag sei sachlich falsch (etwa: „ich habe
das nie ausgelöst"), ist das **kein** Berichtigungsfall, sondern ein Hinweis auf
einen möglichen unbefugten Kontozugriff und als Sicherheitsvorfall zu behandeln.

---

## 5. Löschung (Art. 17)

Hier liegt die eine wirklich offene Frage.

### 5.1 Was ohne Weiteres gilt

| Gegenstand | Verhalten |
|---|---|
| Transformationsergebnis | nichts zu löschen — existiert nicht |
| Dokumenttext, Segmente, Providerantwort | nichts zu löschen — nur im Arbeitsspeicher gewesen |
| Originaldokument | folgt den bestehenden Regeln für Praxisdokumente; die Transformation ändert daran nichts |

### 5.2 Kontolöschung

Löscht der Patient sein Konto (`DELETE /api/account/delete`), werden die
`AuditLog`-Zeilen über die Fremdschlüsselbeziehung `onDelete: Cascade` auf
`userId` **mitgelöscht**. Das ist im Schema festgelegt und kein manueller
Schritt.

### 5.3 Einzelne Löschung der Protokolldaten bei fortbestehendem Konto

```
LEGAL DECISION REQUIRED
```

Zwei Antworten sind vertretbar und zeigen in entgegengesetzte Richtungen:

- **löschen** — es ist personenbezogen, der Zweck (Nachvollziehbarkeit eines
  abgeschlossenen Vorgangs) ist erfüllt;
- **aufbewahren** — Rechenschaftspflicht nach Art. 5 Abs. 2: gerade bei einer
  Verarbeitung besonderer Kategorien kann der Nachweis, *was wann geschah*,
  erforderlich sein. Ein gelöschtes Protokoll kann nichts mehr belegen — auch
  nicht zugunsten des Patienten.

**Code kann zwischen diesen beiden nicht wählen.** Siehe
[Entscheidungsmatrix 2.9](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md).

**Bis zur Entscheidung:** ein solches Ersuchen wird **nicht abgelehnt und nicht
still ausgeführt**. Es wird entgegengenommen, als offen geführt und dem Patienten
mitgeteilt, dass die Aufbewahrungsfrage geklärt wird. Die Frist nach Art. 12 ist
dabei einzuhalten.

**Sobald entschieden:** eine Löschung erfolgt zeilenweise über `patientUserId`
und die beiden Aktionsnamen. Ein technischer Weg existiert; eine Regel fehlt.

### 5.4 Backups

```
UNKNOWN
```

Im Repository ist **keine** Backup- oder Aufbewahrungskonfiguration dokumentiert.
Ob, wo, wie lange und in welcher Form Sicherungen bestehen, ist von hier aus
nicht feststellbar, und ob eine Löschung sie erreicht, ebenfalls nicht.

Dies ist **vor einer Aktivierung** zu klären, weil eine Löschzusage, die Backups
nicht erreicht, eine unzutreffende Zusage wäre.

---

## 6. Einschränkung der Verarbeitung (Art. 18)

**Wirksamste Maßnahme, sofort verfügbar:** die Funktion nicht benutzen. Ohne
Auslösung findet keine Verarbeitung statt — es gibt keinen Hintergrundlauf, keine
Vorverarbeitung und keine Wiederholung.

**Dauerhaft und systemseitig:**

| Mittel | Wirkung | Stand |
|---|---|---|
| Widerruf der Praxisverknüpfung | Der Status ist dann nicht mehr `active` — **jede** Transformation wird abgelehnt. Wirkt sofort und serverseitig. | verfügbar; betrifft allerdings die gesamte Praxisbeziehung, nicht nur diese Funktion |
| Rücknahme der Dokumentfreigabe | Das Dokument ist nicht mehr transformierbar | Sache der Praxis |
| Abschalten der Funktion | Kill Switch über die Umgebungsvariable, ohne Deployment | Betreiber, systemweit |
| Sperre nur dieser Funktion für einen einzelnen Patienten | — | **existiert nicht.** Bei Variante A wäre der Widerruf der Einwilligung genau dieser Schalter; bei Variante B wäre ein Weg erforderlich. `LEGAL DECISION REQUIRED`, [2.4](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md) |
| Einschränkung des Protokollbestands | — | keine Kennzeichnung „eingeschränkt" im Datenmodell vorgesehen. Praktisch über eine Ablaufnotiz zu führen, bis 2.9 entschieden ist |

---

## 7. Widerruf und Widerspruch

**Heute nicht anwendbar:** Die Funktion erzwingt keine Einwilligung, weil noch
nicht entschieden ist, ob eine erforderlich ist.

| Nach Variante A | Nach Variante B |
|---|---|
| Widerruf nach Art. 7 Abs. 3 über die bestehende Patienten-Consent-Oberfläche. `revokeConsentRecord` setzt den Datensatz auf `revoked`; die nächste serverseitige Prüfung schlägt fehl. Wirkung **nur für die Zukunft** — vergangene Läufe bleiben unberührt, und es gibt ohnehin kein Ergebnis zu entfernen. Umgang mit den Protokolldaten: 2.9. | Kein Widerruf, da keine Einwilligung. Bei Art. 6 Abs. 1 lit. f ein Widerspruchsrecht nach Art. 21 — der Weg dafür ist `LEGAL DECISION REQUIRED`. |

In **beiden** Fällen gilt und wird so kommuniziert: die Funktion nicht zu
benutzen führt dazu, dass nichts verarbeitet wird.

---

## 8. Datenübertragbarkeit (Art. 20)

| Gegenstand | Bewertung |
|---|---|
| Audit-Datensätze | Vom Patienten „bereitgestellt"? `LEGAL DECISION REQUIRED` — es sind vom System erzeugte Protokolldaten, keine Eingaben. Technisch als strukturierter Export lieferbar |
| Transformationsergebnis | nicht übertragbar — existiert nicht |
| Originaldokument | über den bestehenden Dokument- und Exportpfad; von dieser Funktion unabhängig |

Ein Exportmechanismus existiert bereits (`/api/patient/exports`). Ob die
Protokolldaten dieser Funktion hineingehören, ist Teil derselben Entscheidung.

---

## 9. Beschwerde (Art. 77)

Auf das Beschwerderecht bei einer Aufsichtsbehörde ist in der Antwort hinzuweisen.
Welche Behörde zuständig ist, hängt an der Rollenentscheidung — bei
Auftragsverarbeitung ist es die der Praxis, bei eigener Verantwortlichkeit die von
MedScoutX. `LEGAL DECISION REQUIRED`,
[2.1](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md).

---

## 10. Dritte im Dokument

Ein Arztbrief nennt routinemäßig andere Personen — überweisende Ärztinnen,
Unterzeichner, gelegentlich Angehörige. Sie werden **nicht maskiert**.

| | |
|---|---|
| Wissen sie davon? | **Nein.** Es gibt keine Information an sie und keinen Weg, sie zu erreichen |
| Können sie ihre Rechte ausüben? | Praktisch nicht — sie erfahren von der Verarbeitung nichts |
| Was ist gespeichert? | Nichts über sie. Ihre Namen standen im übermittelten Text, nicht in einem Datensatz |
| Bewertung | `LEGAL DECISION REQUIRED` — als Risiko R3 im [DSFA-Entwurf](DOCUMENT_TRANSLATION_DPIA_DRAFT.md) geführt |

Dieser Punkt wird hier ausdrücklich benannt, weil er in einer Betrachtung, die
nur den auslösenden Patienten im Blick hat, leicht untergeht.

---

## 11. Was zu tun ist, bevor die Funktion aktiviert wird

| # | Punkt | Status |
|---|---|---|
| 1 | Aufbewahrung oder Löschung der Protokolldaten entscheiden (§5.3) | `LEGAL DECISION REQUIRED` |
| 2 | Backup-Reichweite klären (§5.4) | `UNKNOWN` — zu ermitteln |
| 3 | Rollen und damit zuständige Aufsichtsbehörde festlegen (§9) | `LEGAL DECISION REQUIRED` |
| 4 | Sperrweg für einen einzelnen Patienten festlegen (§6) | folgt aus der Consent-Entscheidung |
| 5 | Umgang mit den Rechten Dritter (§10) | `LEGAL DECISION REQUIRED` |
| 6 | Empfängernennung in Auskünften festlegen (§3.5) | folgt aus 2.10 |
| 7 | Protokolldaten im Export — ja/nein (§8) | `LEGAL DECISION REQUIRED` |
| 8 | Diese Anweisung den handelnden Personen bekannt machen | offen |

---

## Anhang — Kurzablauf

```
Ersuchen geht ein
   │
   ├─ Identität geprüft?  ──── nein ──►  zuordnen, dann weiter
   │
   ├─ Betrifft es das DOKUMENT?  ──►  an die Praxis (PatientDataRequest)
   │
   └─ Betrifft es die NUTZUNG der Funktion?
         │
         ├─ Auskunft        ──►  AuditLog über patientUserId UND userId,
         │                        Aktionen document_translation.*
         │                        → Klartext + ausdrücklich, was es nicht gibt
         │
         ├─ Löschung        ──►  Konto gelöscht?  ja ──► Kaskade, erledigt
         │                        nein ──► LEGAL DECISION REQUIRED (§5.3),
         │                                  entgegennehmen, offen führen, Frist wahren
         │
         ├─ Einschränkung   ──►  sofort: Funktion nicht nutzen
         │                        dauerhaft: Verknüpfung/Freigabe, sonst §6
         │
         ├─ Widerruf        ──►  nur bei Variante A; sonst §7
         │
         └─ Übertragbarkeit ──►  LEGAL DECISION REQUIRED (§8)

  Immer: auf das Beschwerderecht hinweisen. Nie: eine Löschzusage geben,
  deren Reichweite in Backups UNKNOWN ist.
```

---

*Status: Betriebsanweisung vorbereitet. `B6 = OPEN` — die in §11 genannten
Punkte sind vor einer Aktivierung zu schließen.*
