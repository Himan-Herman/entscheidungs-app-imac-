# Dokumenttransformation — Prüfunterlage für die datenschutzrechtliche Bewertung

> **Zweck:** Diese Unterlage beschreibt eine geplante Verarbeitung technisch
> vollständig und neutral, damit eine Datenschutzberatung bzw. Rechtsberatung sie
> bewerten kann.
>
> **Sie enthält bewusst keine rechtliche Bewertung, keine Rechtsgrundlage und
> keine Freigabe.** Zusicherungen zur Rechtmäßigkeit, zur Erfüllung einzelner
> Vorschriften oder zur Erforderlichkeit einer Einwilligung fehlen hier nicht aus
> Versehen — sie sind der Prüfung vorbehalten und dürfen nicht vorweggenommen
> werden.
>
> **Stand:** 2026-08-17 · Repository-Stand `02806e5b` · Funktion **deaktiviert**
> · Keine Patientendaten, keine Zugangsdaten, keine Konto-Identifikatoren.

---

## 1. Executive Summary

MedScoutX hat eine Funktion fertig entwickelt, aber **nicht aktiviert**, mit der
Patientinnen und Patienten ein medizinisches Dokument, das ihre Praxis ihnen
bereits freigegeben hat, in eine andere Sprache übersetzen oder sprachlich
vereinfachen lassen können.

Der Textinhalt des Dokuments wird dafür an einen externen KI-Dienst (OpenAI)
übertragen. Vorher werden lokal bekannte Patientenidentifikatoren sowie
medizinisch kritische Angaben (Medikamente, Dosierungen, Messwerte, Daten)
maskiert und nach der Rückkehr wieder eingesetzt.

**Die zu entscheidende Frage ist nicht, ob die Technik funktioniert — das ist
belegt —, sondern ob und auf welcher Grundlage diese Verarbeitung stattfinden
darf.** Vier Punkte machen sie prüfbedürftig:

1. Es handelt sich um **Gesundheitsdaten** (potenziell Art. 9 DSGVO), nicht um
   allgemeine Texteingaben.
2. Die Daten stammen **nicht vom Patienten selbst**, sondern von der Praxis.
3. Der abgeschlossene Providervertrag beschreibt die Übertragung sensibler Daten
   als *nicht beabsichtigt* — geplant ist aber genau das (§ 9).
4. Die geltende Datenschutzerklärung beschreibt eine **andere** Verarbeitung mit
   einer **anderen** Region (§ 13).

Die Funktion ist per Feature-Flag abgeschaltet; ohne Freigabe bleibt sie es.

---

## 2. Product Flow — tatsächliches Verhalten

Aus dem Code abgeleitet, nicht aus einer Produktbeschreibung.

```
Praxis lädt medizinisches Dokument in MedScoutX
   → Praxis gibt es für den Patienten frei
      → Patient öffnet das bereits freigegebene Dokument
         → Patient startet optional selbst
            „Fachgetreu übersetzen" oder „Einfach erklärt"
            → Prüfung: Authentifizierung
            → Prüfung: aktive Praxis-Patient-Beziehung
            → Prüfung: Dokument tatsächlich für diesen Patienten freigegeben
            → Prüfung: zulässiger Dokumenttyp
            → Prüfung: Ausgangssprache (nur Deutsch, deklariert)
            → Prüfung: Provider überhaupt konfiguriert
               → Dokument wird lokal aus dem Speicher gelesen
               → lokale Textextraktion in isoliertem Prozess
               → lokale Maskierung: bekannte Patientendaten,
                 Medikamente, Dosierungen, Messwerte, Daten, Kennnummern
                  → vorbereitete Textsegmente an den externen Provider
                  → Provider führt ausschließlich sprachliche
                    Transformation durch
                  → Integritätsprüfung der Antwort
                  → Maskierungen werden lokal wieder eingesetzt
                     → Ergebnis wird transient angezeigt
                     → keine persistente Speicherung der Transformation
```

Jede Prüfung liegt **vor** der Übertragung. Schlägt eine fehl, wird abgebrochen,
und es wird nichts übertragen.

**Reihenfolge-Detail mit datenschutzrechtlicher Relevanz:** Die Prüfung, ob ein
Provider konfiguriert ist, erfolgt **bevor** die Dokumentbytes geladen werden.
Ohne freigegebene Providerkonfiguration wird das Dokument also nicht einmal
gelesen.

---

## 3. Actors / Roles to Review

Die Rollenzuordnung ist **nicht abschließend geklärt** und ist eine der zu
entscheidenden Fragen.

| Akteur | Was das Repository dokumentiert |
|---|---|
| **Patient** | Betroffene Person. Startet die Transformation selbst. |
| **Praxis** | Stellt das Dokument bereit und gibt es frei. Ist an der Transformation selbst nicht beteiligt und wird über sie nicht informiert. |
| **MedScoutX / Himan Khorshidi** | Betreiber. Die geltende Datenschutzerklärung nennt Himan Khorshidi als **Verantwortlichen** für die App. |
| **OpenAI** | Externer Dienst. Der abgeschlossene DPA ordnet OpenAI die Rolle **Data Processor** zu (§ 1.1 des DPA). Für Kunden mit Sitz im EWR ist Vertragspartei OpenAI Ireland Ltd. |
| **Weitere Subprozessoren** | Der DPA erlaubt Subprozessoren per Generalautorisierung mit Widerspruchsrecht; die konkrete Liste wird von OpenAI geführt. |

### Der ungeklärte Punkt

Im Repository existieren **zwei unterschiedliche Rollenbilder nebeneinander**:

- Die **Datenschutzerklärung** der App nennt MedScoutX als **Verantwortlichen**
  für die Verarbeitung der Patientendaten.
- Ein **AVV-Entwurf** in `docs/legal/` sieht die **Praxis als Verantwortlichen**
  und MedScoutX als **Auftragsverarbeiter** vor.

Dieser Entwurf ist jedoch **ausschließlich auf die GOÄ/PKV-Abrechnungs­plausibilität
bezogen** und deckt weder das Hosting noch die Freigabe von Praxisdokumenten ab.
Er ist zudem unsigniert und enthält Platzhalter.

**Für den hier beschriebenen Ablauf existiert damit keine dokumentierte
Rollenzuordnung.** Er beginnt mit Praxisdaten und wird durch eine
Patientenhandlung ausgelöst — die Rolle könnte sich gegenüber dem reinen
Dokument-Hosting ändern.

```
LEGAL REVIEW REQUIRED
```

---

## 4. Data Categories

Strikt getrennt nach dem, was **den Provider erreicht**, und dem, was
**MedScoutX speichert**.

### 4.1 Was der Provider erhält

Der Textinhalt eines medizinischen Dokuments, in Segmente zerlegt, mit maskierten
kritischen Werten. Inhaltlich können darin vorkommen:

- Gesundheitsdaten, Diagnosen, Befunde
- Arztbriefe, Entlassungsberichte, Überweisungsinformationen
- Behandlungsinformationen und Verlaufsbeschreibungen
- Medikationsangaben und Dosierungen — als Platzhalter maskiert
- Messwerte, Referenzbereiche, Datumsangaben — als Platzhalter maskiert
- Patientenkontext, der sich nicht aus einzelnen Feldern ergibt, sondern aus dem
  Zusammenhang des Textes
- **Identifikatoren, die nicht deterministisch maskierbar sind** — die Maskierung
  kennt nur die in der Datenbank hinterlegten Patientendaten und
  musterbasiert erkennbare Angaben
- **seltene medizinische Sachverhalte**, über die eine Re-Identifikation möglich
  bleiben kann, auch wenn kein Name übertragen wird

Nicht übertragen werden: die Originaldatei, Dokument-, Datei-, Praxis- oder
Patienten-Identifikatoren, Kontodaten, Prompt-Metadaten mit Personenbezug.

### 4.2 Was MedScoutX intern speichert

Pro Transformation **ein Audit-Datensatz**, ausschließlich Metadaten:

| Feld | Inhalt |
|---|---|
| Patient- und Nutzerbezug | interne Kennung |
| Dokumentbezug | interne Kennung |
| Praxisbezug | interne Kennung |
| Modus | `strict_translation` oder `plain_language` |
| Zielsprache | Sprachcode |
| Ergebnis | Erfolg oder Fehlerkategorie |
| Modell, Promptversion, Segmentanzahl, Versuche, Dauer | technische Kennzahlen |
| IP-Adresse | **gehasht**, nicht im Klartext |
| User-Agent | wie übermittelt |

**Dieser Datensatz ist personenbezogen:** Er belegt, dass eine bestimmte Person
zu einem bestimmten Zeitpunkt ein bestimmtes Dokument transformieren ließ.

**Nicht gespeichert:** Dokumenttext, maskierte Segmente, Providerantwort,
Transformationsergebnis, temporäre Dateien. Die Verarbeitung findet
ausschließlich im Arbeitsspeicher statt.

---

## 5. Provider Data Boundary

```
                MedScoutX-Infrastruktur          │        extern
────────────────────────────────────────────────┼────────────────────
 Originaldatei                                  │
 Textextraktion (isolierter Prozess)            │
 Maskierung                                     │
 Segmentierung                                  │
        vorbereitete Textsegmente  ─────────────┼──►  sprachliche
                                                │     Transformation
 Integritätsprüfung  ◄──────────────────────────┼───  Antwort
 Wiedereinsetzung der Maskierungen              │
 transiente Anzeige                             │
```

Die Linie wird genau einmal überschritten, und zwar mit vorbereitetem Text.
Alles links davon verlässt die MedScoutX-Infrastruktur nicht.

---

## 6. Technical Safeguards

Implementiert und getestet:

| Maßnahme | Wirkung |
|---|---|
| Keine Patienten-Uploads | Nur von der Praxis freigegebene Dokumente sind transformierbar |
| Dokumenttyp-Allowlist | Nur Befund, Entlassungsbericht, Überweisung |
| Aktive Praxis-Patient-Beziehung erforderlich | Nach Widerruf der Verknüpfung keine Transformation |
| Lokale Textextraktion | Die Originaldatei verlässt den Server nie |
| Keine Datei-Upload-Schnittstelle zum Provider | Kein Dateitransfer, keine Anhänge |
| Deterministische Maskierung bekannter Patientendaten | Name, Geburtsdatum, Kontaktdaten, Kennnummern |
| Medikamenten- und Dosierungsmaskierung | Als unteilbare Einheit; nicht maskierbare Medikation führt zum Abbruch |
| Segmentierung | Keine Übertragung des Dokuments als Ganzes |
| Keine Werkzeuge, kein Browsing, kein Retrieval | Der Dienst erhält Text und gibt Text zurück |
| Keine Konversationshistorie | Jede Anfrage ist isoliert; kein Bezug zwischen Patienten oder Dokumenten |
| Keine providerseitige Speicherung angefordert | Es wird kein Speicherparameter gesetzt |
| Keine Persistenz des Ergebnisses | Weder serverseitig noch im Browser |
| Integritätsprüfung der Antwort | Erfundene Werte oder verlorene Platzhalter führen zur Ablehnung |
| Höchstens ein interner Wiederholungsversuch | Keine wiederholte Übertragung |
| Fail-closed | Jede unklare Situation endet mit Ablehnung, nicht mit Übertragung |
| Funktion standardmäßig deaktiviert | Zwei getrennte Schalter, beide aus |
| Kill Switch | Sofortige Abschaltung ohne Deployment |

### Ausdrückliche Einschränkung

> **Die Maskierung ist keine Anonymisierung.**
>
> Die Maßnahmen reduzieren die übertragenen Identifikatoren erheblich, stellen
> aber **keine vollständige Anonymisierung sicher**. Der übertragene Text bleibt
> medizinischer Inhalt; eine Re-Identifikation über Kontext, Formulierung oder
> seltene Sachverhalte ist nicht ausgeschlossen. Die Verarbeitung ist daher als
> Verarbeitung personenbezogener Daten zu bewerten, nicht als Verarbeitung
> anonymer Daten.

---

## 7. Storage / Retention

| Ort | Was | Dauer |
|---|---|---|
| MedScoutX-Datenbank | Audit-Metadatensatz (§ 4.2) | Keine gesonderte Frist definiert; wird mit dem Nutzerkonto gelöscht (Kaskade) |
| MedScoutX-Arbeitsspeicher | Dokumenttext, Segmente, Ergebnis | Nur während der Verarbeitung |
| MedScoutX-Speicher | Originaldatei — unverändert, unabhängig von dieser Funktion | Nach den bestehenden Regeln für Praxisdokumente |
| Browser | Ergebnis | Nur in der Ansicht; keine Speicherung, Antwort ist als nicht zwischenspeicherbar markiert |
| **Provider** | **unbekannt** | **offen — siehe § 8** |

---

## 8. Existing DPA Status

| | |
|---|---|
| Vertrag | OpenAI Data Processing Addendum, Version `v.010126` |
| Kunde | Himan Khorshidi, Einzelunternehmer |
| Vertragspartei OpenAI | Für Kunden im EWR: OpenAI Ireland Ltd. (folgt aus der Vertragsklausel; im Unterschriftenblock nicht ausgeschrieben) |
| Abgeschlossen | 16.08.2026, beide Parteien, elektronisch signiert |
| Umfang | Business-/Entwicklerdienste einschließlich der API |
| Geprüft | 17.08.2026, dokumentarisch |

Der Vertrag enthält die üblichen Art.-28-Regelungsbereiche: Rollenzuordnung,
Weisungsgebundenheit, Vertraulichkeit, Sicherheit, Betroffenenrechte,
Meldung von Verletzungen, Audit- und Informationsrechte, Subprozessoren,
Rückgabe/Löschung, internationale Übermittlungen mit Standardvertragsklauseln.

**Noch nicht bestätigt und ausdrücklich offen:**

- **EU Data Residency** für das konkrete Projekt — angefragt, Antwort ausstehend
- **Zero Data Retention** für das konkrete Projekt — angefragt, Antwort ausstehend
- **Verhalten providerseitiger Zwischenspeicherung** (Prompt Caching, Abuse
  Monitoring) — offen

Der Vertrag allein trifft zu Region und Aufbewahrung **keine** Aussage. Diese
ergeben sich aus der Konfiguration, nicht aus dem Vertragstext.

---

## 9. Health-Data Scope Issue

**Der zentrale Prüfpunkt dieser Unterlage.**

Der abgeschlossene Vertrag enthält in Schedule 1 Nr. 5 („Sensitive data
transferred") die Angabe:

> „No sensitive data is intended to be transferred unless the user includes it
> unexpectedly in unstructured data."

Die geplante Verarbeitung sieht demgegenüber vor:

> **Bewusste und systematische Verarbeitung medizinischer Dokumentinhalte.**

Ergänzende Feststellungen aus der Vertragsprüfung:

- Die Begriffe *special categories*, *health*, *Article 9*, *HIPAA*,
  *prohibited* und *restricted* kommen im gesamten Vertrag **nicht** vor.
- Die Kategorien in Schedule 1 Nr. 3 nennen beispielhaft Namen, Kontaktdaten und
  demografische Angaben — Gesundheitsdaten werden nicht genannt.
- Der ausgeführte Vertragstext ist **zeichengleich** mit der öffentlichen
  Vorlage; es wurde nichts individuell vereinbart. Der Anbieter gibt an, den
  Vertrag nicht einzelfallbezogen anzupassen.

**Es liegt weder eine ausdrückliche Erlaubnis noch ein ausdrückliches Verbot
vor.** Einordnung der Vertragslage: *aus dem Vertrag nicht bestimmbar*.

Diese Unterlage zieht daraus **keine** Schlussfolgerung — weder dass die Nutzung
unzulässig, noch dass sie zulässig wäre.

```
LEGAL REVIEW REQUIRED
```

---

## 10. Existing Consent Architecture

Erneut gegen den aktuellen Code geprüft am 2026-08-17.

MedScoutX besitzt einen granularen Einwilligungskatalog mit 21 Typen. Drei sind
für die Bewertung relevant:

| Einwilligungstyp | Technischer Geltungsbereich | Serverseitig durchgesetzt? | Betrifft externe Verarbeitung? |
|---|---|---|---|
| `document_sharing` | Freigabe von Dokumenten zwischen Praxis und Patient | **Ja**, an mehreren Stellen | Nein — betrifft die Freigabe, nicht eine Weiterverarbeitung |
| `ai_organizational_assistance` | UI-Text: „Assistierte Unterstützung (nur organisatorisch)". Wird für eine KI-gestützte Dokumentauswertung verlangt | **Ja**, an genau einer Stelle | **Nein** — die betroffene Komponente verarbeitet ausschließlich lokal; sie enthält keinerlei Netzwerkzugriff |
| `meda_live_translation_processing` | Vorgesehen für externe Echtzeit-Übersetzung | **Nein** — existiert nur im Katalog und als UI-Beschriftung, wird an keiner Stelle im Servercode geprüft | Vorgesehen, aber ohne technische Wirkung |

### Der maßgebliche Befund

**Keiner der Dienste, die tatsächlich einen externen KI-Anbieter aufrufen, prüft
irgendeine Einwilligung.** Geprüft wurden alle 43 Server-Dateien, die den
Anbieter-Client einbinden — von der Terminvorbereitung über den Dolmetscher bis
zur hier beschriebenen Funktion. In keiner davon findet eine
Einwilligungsprüfung statt.

Externe KI-Verarbeitung wird derzeit ausschließlich durch Feature-Flags und
durch die bewusste Nutzerhandlung gesteuert, **nicht** durch eine erfasste
Einwilligung.

Zwei Konsequenzen für die Bewertung:

1. Es gibt **keinen** bestehenden Einwilligungsmechanismus, an den diese Funktion
   anknüpfen könnte — nicht einen unpassenden, sondern gar keinen.
2. Eine UI-Beschriftung ohne serverseitige Durchsetzung darf **nicht** als
   wirksame technische Einwilligungsgrenze dargestellt werden. Das betrifft
   ausdrücklich `meda_live_translation_processing`.

---

## 11. Open Legal Questions

Fragen, keine Antworten.

### Rollen

1. Wer ist Verantwortlicher für die patienteninitiierte Dokumenttransformation?
2. Ist MedScoutX gegenüber der Praxis hier Auftragsverarbeiter, oder verfolgt
   MedScoutX für diesen optionalen Patientendienst einen eigenen Zweck?
3. Welche Rolle hat OpenAI in dieser Kette?

### Art. 6 DSGVO

4. Welche Rechtsgrundlage ist für die Verarbeitung personenbezogener Daten
   einschlägig?

### Art. 9 DSGVO

5. Auf welche Ausnahme für besondere Kategorien personenbezogener Daten soll die
   Verarbeitung von Gesundheitsdaten gestützt werden?

### Einwilligung

6. Ist eine ausdrückliche Einwilligung erforderlich, oder lediglich eine mögliche
   Rechtsgrundlage unter mehreren?
7. Falls Einwilligung: Welche Anforderungen bestehen an Freiwilligkeit,
   Informiertheit, Nachweisbarkeit und Widerruf?
8. Muss die Zustimmung je Dokument oder einmalig für den Dienst erfolgen?
9. Was muss nach einem Widerruf technisch geschehen — insbesondere mit den
   Audit-Metadaten, da das Transformationsergebnis ohnehin nicht gespeichert wird?

### Praxisbeziehung

10. Reicht die ursprüngliche Freigabe des Praxisdokuments an den Patienten als
    Grundlage für die zusätzliche externe KI-Verarbeitung?
11. Muss die Praxis über diese Weiterverarbeitung informiert werden oder ihr
    zustimmen?

### Provider

12. Reicht der abgeschlossene OpenAI-DPA für absichtlich verarbeitete
    Gesundheitsdaten?
13. Wie ist Schedule 1 Nr. 5 des Vertrags (§ 9 dieser Unterlage) für diesen
    Anwendungsfall zu bewerten?

### Transparenz

14. Welche Informationen müssen Patienten **vor** dem Start der Transformation
    erhalten?

### Datenschutz-Folgenabschätzung

15. Ist für diese Verarbeitung eine Datenschutz-Folgenabschätzung erforderlich?

### Betroffenenrechte

16. Welche Audit- und Nutzungsdaten sind bei Auskunfts- und Löschersuchen zu
    berücksichtigen, und ist der Audit-Datensatz zu löschen oder aufgrund einer
    Rechtspflicht aufzubewahren?

---

## 12. Decisions Required

Damit die technische Umsetzung fortgeführt werden kann, werden **Entscheidungen**
zu folgenden Punkten benötigt:

| # | Entscheidung | Blockiert |
|---|---|---|
| 1 | Rollenzuordnung für diesen Ablauf | Datenschutzerklärung, Subprozessorverzeichnis |
| 2 | Rechtsgrundlage nach Art. 6 | alles Weitere |
| 3 | Grundlage für besondere Kategorien nach Art. 9 | alles Weitere |
| 4 | Einwilligung erforderlich — ja/nein | Consent-Umsetzung, UI |
| 5 | Bewertung des Vertragsumfangs für Gesundheitsdaten (§ 9) | Aktivierungsentscheidung insgesamt |
| 6 | Erforderlichkeit einer Datenschutz-Folgenabschätzung | Aktivierungsentscheidung |
| 7 | Umgang mit Audit-Metadaten bei Betroffenenanfragen | Löschprozess |
| 8 | Information der Praxis erforderlich — ja/nein | Praxiskommunikation |

---

## 13. Consequences for B1 / B3 / B5 / B6 / B7

### Warum diese Bewertung zuerst erfolgen muss

Die Datenschutzerklärung kann erst geschrieben werden, wenn Rollen,
Rechtsgrundlage, Art.-9-Grundlage, Empfänger, Datenkategorien, Zweck, Region und
Aufbewahrung feststehen. Würde der Text vorher formuliert, müsste er nach der
Prüfung erneut geändert werden — und ein bereits veröffentlichter Text bindet
gegenüber den Betroffenen.

### B1 — Datenschutzerklärung: bestehender Konflikt

Die geltende Erklärung nennt OpenAI LLC (San Francisco, **USA**) als
Verarbeitungsdienstleister für *„deiner Texteingaben, Bilddaten und
Body-Map-Angaben"* — also für die **eigenen Eingaben** der Patientin. Zwei
Abweichungen:

1. **Umfang:** Der Text eines von der Praxis freigegebenen Dokuments ist keine
   Patienteneingabe. Die beschriebene Verarbeitung ist eine andere.
2. **Region:** Die Erklärung sagt eine Übermittlung in die USA zu. Sollte die
   Aktivierung auf einer EU-Verarbeitung beruhen, widerspräche die Erklärung der
   tatsächlichen Konfiguration.

Weitere betroffene Abschnitte: Datenkategorien, Zwecke, Rechtsgrundlagen
(die dort genannte Einwilligung ist auf selbst eingegebene Inhalte bezogen),
Auftragsverarbeiter, Drittlandtransfer, Speicherfristen (Audit-Datensätze werden
dort nicht erwähnt) sowie der Hinweis, keine Daten Dritter zu übermitteln — was
bei einem Arztbrief mit Namen weiterer Behandelnder nicht zum Ablauf passt.

### B3 — Consent: zwei technische Szenarien

**Szenario A — Einwilligung erforderlich.** Technisch voraussichtlich nötig:
ein eindeutig passender Einwilligungstyp, eine ausdrückliche Zustimmung in der
Oberfläche, eine serverseitige Prüfung **vor jedem** Anbieteraufruf, ein
Nachweis von Zeitpunkt und Fassung, eine Widerrufsmöglichkeit und die Zusicherung,
dass ohne gültige Einwilligung keine Übertragung stattfindet. Der Mechanismus
dafür existiert bereits im System und müsste lediglich für diesen Fall verwendet
werden.

**Szenario B — Einwilligung nicht als Rechtsgrundlage erforderlich.** Dann bleiben
transparente Patienteninformation und die bewusste Nutzerhandlung. Es würde
**kein** zusätzlicher Einwilligungsdialog eingeführt, der lediglich beruhigend
wirkt, ohne rechtliche Funktion zu haben.

**Beides ist derzeit nicht umgesetzt und wird erst nach der Entscheidung
umgesetzt.**

### B5 — Datenschutz-Folgenabschätzung
Ob eine erforderlich ist, wird hier nicht behauptet — in keine Richtung. Im
Repository existiert keine Prüfung dazu.

### B6 — Lösch- und Auskunftsprozess
Das Transformationsergebnis wird nicht gespeichert; die Frage betrifft
ausschließlich die Audit-Metadaten (§ 4.2) und die beim Anbieter möglicherweise
verbleibenden Daten, die von § 8 abhängen.

### B7 — Patienteninformation
Inhalt und Zeitpunkt hängen von den Entscheidungen 1–4 ab. Die Oberfläche weist
heute bereits darauf hin, dass das Ergebnis automatisch erstellt wurde und dass
das Originaldokument maßgeblich bleibt.

---

## 14. Freiwilligkeit — geprüfter Stand

Aus dem Code verifiziert:

| Eigenschaft | Stand |
|---|---|
| Patient muss die Transformation aktiv starten | **Ja** — Auslösung ausschließlich über eine Schaltfläche |
| Automatische Transformation beim Öffnen | **Nein** — kein Effekt startet die Verarbeitung |
| Automatische Übertragung ohne Nutzerhandlung | **Nein** |
| Originaldokument ohne KI nutzbar | **Ja** — Ansicht und Download sind unabhängig |
| Fehlende Providerfreigabe blockiert das Original | **Nein** — die Funktion wird ausgeblendet, das Dokument bleibt zugänglich |
| Fehler der Transformation blockiert eine Kernfunktion | **Nein** — die Ablehnung verweist auf das Original |
| Funktion ist optional | **Ja** |

---

*Zugehörige Dokumente: [`DOCUMENT_TRANSLATION_EVIDENCE_REGISTER.md`](DOCUMENT_TRANSLATION_EVIDENCE_REGISTER.md)
· [`DOCUMENT_TRANSLATION_ACTIVATION_CHECKLIST.md`](DOCUMENT_TRANSLATION_ACTIVATION_CHECKLIST.md)*

---
---

# Anlage — Kurzfassung für die Datenschutzberatung

*Diese Kurzfassung kann eigenständig weitergegeben werden.*

**Betreff: Datenschutzrechtliche Bewertung einer geplanten KI-gestützten
Dokumentübersetzung — MedScoutX**

**Was geplant ist.** MedScoutX ist eine Gesundheits-App. Arztpraxen können ihren
Patientinnen und Patienten darüber medizinische Dokumente bereitstellen —
Befunde, Entlassungsberichte, Überweisungen. Geplant ist eine Funktion, mit der
Patienten ein ihnen bereits freigegebenes Dokument **selbst** in eine andere
Sprache übersetzen oder in verständlichere Sprache umformulieren lassen können.
Die sprachliche Umwandlung übernimmt ein externer KI-Dienst (OpenAI). Es findet
keine medizinische Bewertung statt: Es werden keine Diagnosen gestellt, keine
Empfehlungen gegeben und keine Inhalte ergänzt.

**Welche Daten betroffen sind.** Der Textinhalt medizinischer Dokumente. Das sind
potenziell Gesundheitsdaten im Sinne von Art. 9 DSGVO. Besonders relevant: Die
Daten stammen **nicht** von der betroffenen Person selbst, sondern von der
Praxis.

**Was lokal geschützt wird.** Bevor etwas übertragen wird, entfernt MedScoutX auf
den eigenen Servern die bekannten Patientenidentifikatoren (Name, Geburtsdatum,
Kontaktdaten, Versicherungsnummern) sowie Medikamente, Dosierungen, Messwerte und
Datumsangaben und ersetzt sie durch Platzhalter, die erst nach der Rückkehr
lokal wieder eingesetzt werden. Die Originaldatei verlässt den Server nie.
Übertragen wird ausschließlich vorbereiteter Text.

**Wichtig:** Diese Maßnahmen sind **keine Anonymisierung**. Der übertragene Text
bleibt medizinischer Inhalt, und eine Re-Identifikation über den Zusammenhang ist
nicht ausgeschlossen.

**Was gespeichert wird.** Das Übersetzungsergebnis wird **nirgends** gespeichert —
weder auf dem Server noch im Browser. Gespeichert wird pro Vorgang ein
Protokolldatensatz mit reinen Metadaten (wer, welches Dokument, wann, welcher
Modus, Erfolg oder Fehler) — ohne Dokumenttext.

**Vertragslage.** Mit OpenAI wurde am 16.08.2026 ein Auftragsverarbeitungsvertrag
(Data Processing Addendum) abgeschlossen; für Kunden im EWR ist Vertragspartei
OpenAI Ireland Ltd. Der Vertrag deckt die API ab und enthält die üblichen
Art.-28-Regelungen.

**Noch offen bei OpenAI:** die Bestätigung von EU-Datenresidenz und von
Zero Data Retention für unser konkretes Projekt sowie das Verhalten
providerseitiger Zwischenspeicherung. Diese Punkte sind angefragt.

**Der Punkt, auf den wir besonders hinweisen möchten.** Der Vertrag beschreibt in
seiner eigenen Anlage zu den Standardvertragsklauseln, dass die Übermittlung
sensibler Daten *nicht beabsichtigt* sei und allenfalls unerwartet in
unstrukturierten Daten vorkomme. Unsere geplante Nutzung überträgt
Gesundheitsdaten dagegen **absichtlich und systematisch**. Ein ausdrückliches
Verbot enthält der Vertrag nicht, eine ausdrückliche Erlaubnis ebenso wenig.

**Was wir von Ihnen benötigen.** Eine Bewertung zu folgenden Fragen:

1. Wer ist Verantwortlicher für diese patienteninitiierte Verarbeitung — die
   Praxis oder MedScoutX?
2. Welche Rechtsgrundlage nach Art. 6 DSGVO ist einschlägig?
3. Auf welche Ausnahme nach Art. 9 DSGVO kann die Verarbeitung von
   Gesundheitsdaten gestützt werden?
4. Ist eine ausdrückliche Einwilligung erforderlich? Falls ja: einmalig für den
   Dienst oder je Dokument, und wie ist der Widerruf auszugestalten?
5. Genügt die ursprüngliche Freigabe des Dokuments durch die Praxis, oder muss die
   Praxis über diese Weiterverarbeitung informiert werden?
6. Wie ist der beschriebene Vertragspunkt zu sensiblen Daten zu bewerten?
7. Ist eine Datenschutz-Folgenabschätzung erforderlich?
8. Welche Angaben muss die Datenschutzerklärung aufnehmen, und wie ist mit dem
   dortigen Hinweis auf eine Übermittlung in die USA umzugehen, falls die
   Verarbeitung künftig in der EU stattfindet?

**Aktueller Stand.** Die Funktion ist vollständig entwickelt, aber **abgeschaltet**
und technisch nicht aktivierbar, solange die Providerkonfiguration nicht
freigegeben ist. Es wurde bisher **kein** einziges echtes Patientendokument an
einen externen Dienst übertragen. Eine Aktivierung erfolgt erst nach Ihrer
Bewertung.

Eine ausführliche technische Beschreibung stellen wir auf Wunsch bereit.
