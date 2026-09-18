# Dokumenttransformation — Entscheidungs- und Freigabebogen

> **Für die externe Prüfung (Datenschutz-, IT-, Medizinprodukterecht).** A–L sind
> allein bearbeitbar. Die **Vorprüfung** je Feld ist intern und nicht bindend;
> Begründung und Quellen stehen im [Vorprüfungsmemo](DOCUMENT_TRANSLATION_LEGAL_ASSESSMENT.md).
> **Kein Kästchen ist vorausgefüllt.** Keine Patientendaten, Zugangsdaten, Schlüssel.

| | |
|---|---|
| **Gegenstand** | Übersetzung oder Einfache Sprache für Dokumente, die eine Praxis ihrem Patienten freigegeben hat. Technisch fertig, **nicht aktiv**, keine Datenübermittlung |
| **Verantwortliche Stelle** | Himan Khorshidi, Einzelunternehmer — MedScoutX |
| **KI-Dienstleister** | OpenAI; im EWR laut Vertragsklausel OpenAI Ireland Ltd. (im Unterschriftenblock nicht ausgeschrieben) |
| **Vorlage · Status** | 2026-09-18 · `LEGAL PACKAGE = COMPLETE` · `LEGAL SIGN-OFF = PENDING EXTERNAL REVIEW` |
| **Offene Einzelpunkte** | `A1a = LEGAL REVIEW REQUIRED` · `B4 = PENDING EXTERNAL LEGAL DETERMINATION` · `B5 = DPIA DRAFT COMPLETE / FINAL APPROVAL PENDING` |

---

## A — Sachverhalt

Eine Praxis gibt ihrem Patienten einen Befund, einen Entlassungsbericht oder eine
Überweisung frei. Der Patient kann **ausdrücklich** eine Übersetzung oder eine
Fassung in Einfacher Sprache starten. Ohne diesen Klick passiert nichts. Das
Original bleibt unverändert und ist auch ohne die Funktion lesbar.

**Übermittelt** werden Diagnosen, Befunde und Verläufe, also **Gesundheitsdaten
nach Art. 9 Abs. 1 DSGVO**, **absichtlich und planmäßig**. Datei, Kennungen und
Kontodaten werden nicht übermittelt. MedScoutX speichert keinen Text und kein
Ergebnis, sondern je Vorgang einen personenbezogenen Protokolleintrag. Der Patient
kann das Ergebnis selbst als PDF auf seinem Gerät sichern.

**Vier Punkte legen wir selbst als ungeklärt vor:**

1. Für Praxisdokumente ist **keine Rolle beschrieben**. Die Datenschutzerklärung
   nennt MedScoutX Verantwortlichen, der AVV nennt MedScoutX Auftragsverarbeiter,
   gilt aber nur für die Abrechnungsprüfung.
2. Der **Vertrag mit dem Dienstleister** nennt sensible Daten *nicht
   beabsichtigt*. Die Funktion überträgt sie planmäßig.
3. Die **Maskierung ist keine Anonymisierung**. Über den Kontext bleibt der Text
   re-identifizierbar.
4. **Daten Dritter** werden nicht maskiert, auch nicht die Gesundheitsdaten
   Angehöriger in der Familienanamnese.

## B — Datenfluss

```
Praxis ──gibt frei──► MedScoutX ◄──startet ausdrücklich── Patient
MedScoutX: Text lokal extrahieren → maskieren → in Abschnitte teilen
MedScoutX ──nur maskierte Abschnitte──► Dienstleister   (Region offen, A3)
MedScoutX ◄──Antwort────────────────── Dienstleister
MedScoutX: prüfen (erfundene Werte/Anweisungen → Ablehnung) → Platzhalter zurück
MedScoutX ──Anzeige, nicht gespeichert──► Patient   (auf Klick: PDF im Browser)
MedScoutX: Protokolleintrag ohne Text
```

| Ort | Was bleibt, wie lange |
|---|---|
| MedScoutX | Protokolleintrag ohne Frist, Löschung mit dem Konto · Sicherungskopien **UNKNOWN** |
| Gerät des Patienten | nichts automatisch · PDF nur auf eigenen Klick, MedScoutX erhält keine Kopie |
| Dienstleister | laut Dienstleister bis 30 Tage Missbrauchskontrolle, solange keine Null-Speicherung bestätigt ist (A4 offen) · Unterauftragsverarbeiter **UNKNOWN** |

## C — Schutzmaßnahmen

**Umgesetzt (327 funktionsspezifische Servertests):** nur freigegebene Dokumente,
drei Typen, PDF/DOCX, kein OCR · aktive Verknüpfung · Tageslimit · Datei bleibt auf
dem Server · deterministische Maskierung · Abschnitte ohne Kennungen, Historie,
Werkzeuge · Integritätsprüfung mit Ablehnung · keine Speicherung · Schalter aus,
leere Endpunkt-Allowlist, fail-closed. **Nicht geleistet:** Anonymisierung,
Maskierung Dritter, Kontrolle der Speicherung beim Dienstleister (A4) · DSFA §8–§9.

## D — Entscheidungsfelder

Je Feld: Frage, Fakt · **Vorprüfung** (nicht bindend) · **E** Optionen (Auswahl,
keine Empfehlung) · **F** Kommentar.

**1 — Rolle.** Wer verantwortet die patienteninitiierte Transformation? *Die Praxis
ist nicht beteiligt; die wesentlichen Mittel bestimmt MedScoutX.*
- **Vorprüfung:** eigener Verantwortlicher (EDPB 07/2020 Rn. 40); Art. 28 Abs. 10
  gegenüber der Praxis offenlegen · Memo §2
- **E** ☐ MedScoutX eigener Verantwortlicher ☐ Auftragsverarbeiter der Praxis
  ☐ gemeinsame Verantwortlichkeit (Art. 26) ☐ andere `__________`
- **F** `______________________________________________`

**2 — Art. 6.** Welche Rechtsgrundlage gilt? *Die Funktion ist optional, das
Original ist ohne sie nutzbar.*
- **Vorprüfung:** lit. a oder lit. b; lit. f ist schwach. Die Wahl muss zu Feld 3/4
  passen, ein späterer Wechsel ist unzulässig (EDPB 05/2020 Rn. 121–123) · Memo §3
- **E** ☐ (1)(a) ☐ (1)(b) ☐ (1)(f) ☐ andere `__________`
- **F** `______________________________________________`

**3 — Art. 9.** Welche Ausnahme trägt? *MedScoutX ist kein Gesundheitsberuf.*
- **Vorprüfung:** als eigener Verantwortlicher nur lit. a erkennbar; lit. h nur bei
  Auftragsverarbeitung (Art. 9 Abs. 3, § 22 BDSG, § 203 StGB) · Memo §4
- **E** ☐ (2)(a) ausdrückliche Einwilligung ☐ (2)(h) ☐ andere `__________`
  ☐ keine tragfähige Ausnahme
- **F** `______________________________________________`

**4 — Einwilligung als Rechtsgrundlage?** *Die Einwilligungsinfrastruktur
existiert, ist aber nicht angebunden.*
- **Vorprüfung:** Die Antwort folgt aus Feld 3. Ein Einwilligungsdialog ohne
  Einwilligungsfunktion scheidet aus (EDPB 05/2020 Rn. 122) · Memo §5
- **Empfohlene Prüffrage:** *Trägt für die von MedScoutX als eigene Leistung
  erbrachte, patienteninitiierte Transformation eine andere Ausnahme als Art. 9
  Abs. 2 lit. a? Falls nein: Genügt eine einmalige ausdrückliche Einwilligung, oder
  sind Einwilligungen je Modus oder je Vorgang erforderlich?*
- **E** ☐ ja, ausdrückliche Einwilligung (→ Feld 5) ☐ nein, aktive Auslösung mit
  Vorabinformation, **ohne** Einwilligungsdialog
- **F** `______________________________________________`

**5 — Granularität und Widerruf** (nur falls Feld 4 = ja). *Jede Variante ist
ohne Umbau umsetzbar.*
- **E** ☐ einmalig ☐ getrennt je Modus ☐ je Vorgang · Widerruf: ☐ Sperre für die
  Zukunft ☐ zusätzlich Löschung der Protokolleinträge
- **F** `______________________________________________`

**6 — Vertrag und Gesundheitsdaten (A1a).** *DPA `v.010126`, gezeichnet
2026-08-16, unverhandelt. Schedule 1 Nr. 5: sensible Daten „nicht beabsichtigt, es
sei denn, der Nutzer fügt sie unerwartet ein". „Gesundheit" und „Art. 9" kommen
nicht vor.*
- **Vorprüfung:** drei Lesarten vertretbar, keine gesichert; Art. 28 Abs. 3
  verlangt die Festlegung der Datenart · Memo §7
- **E** ☐ ausreichend ☐ nur mit schriftlicher Bestätigung des Dienstleisters
  ☐ nicht ausreichend (→ Feld 7)
- **F** `______________________________________________`

**7 — Ergänzung** (nur falls nicht ausreichend). *Für die EU-Verarbeitung ist
ohnehin ein Modified Retention amendment zu zeichnen.*
- **E** ☐ Addendum ☐ angepasste Transferbeschreibung ☐ gesonderte Vereinbarung
  ☐ anderer Dienstleister ☐ so nicht zulässig
- **F** `______________________________________________`

**8 — DSFA (B5).** *Entwurf vollständig (17 Risiken, 29 Maßnahmen); Bewertung,
Restrisiko und Freigabe leer.*
- **Vorprüfung:** WP248-Kriterien 4, 7, 8 erfüllt, 5 offen; DSK-Liste nicht
  unmittelbar einschlägig. **Voraussichtlich erforderlich** · Memo §6
- **E** ☐ erforderlich ☐ nicht erforderlich, weil `__________` · Zeichnung durch
  ☐ Verantwortlichen ☐ DSB ☐ extern · Art. 36: ☐ ja ☐ nein
- **F** `______________________________________________`

**9 — Praxis und AVV.** *Die Praxis erfährt nichts. Der AVV deckt nur die
Abrechnung ab und hat weder eine § 203-StGB-Klausel noch eine Drittlandregel.*
- **Vorprüfung:** Die Änderungsliste nach Art. 28 Abs. 3 liegt vor; die
  Rollenformulierung folgt aus Feld 1 · Memo §8
- **E** ☐ keine Information ☐ Information ☐ Zustimmung / Opt-in · AVV:
  ☐ nach Änderungsliste ☐ mit Abweichungen ☐ keine Anpassung
- **F** `______________________________________________`

**10 — Patienteninformation und Datenschutzerklärung (B7, B1).** *Heute keine
Vorabinformation; Datenschutzerklärung `CONFLICT`; kein Art. 22, kein Profiling.*
- **Vorprüfung:** Entwurf B7 und Änderungsmatrix liegen vor; Nennung des
  Dienstleisters `LEGAL DISCLOSURE REQUIRED` · Memo §9–§10
- **E** B7: ☐ frei ☐ mit Änderungen ☐ neu · Datenschutzerklärung: ☐ Matrix frei
  ☐ mit Änderungen · Dienstleister nennen: ☐ in der Funktion ☐ in der
  Datenschutzerklärung ☐ beides
- **F** `______________________________________________`

**11 — Protokolleinträge.** *Es gibt keine eigene Frist und keine eigene
Rechtsgrundlage; die Löschung erfolgt mit dem Konto. Sicherungskopien sind
**UNKNOWN**.*
- **E** ☐ auf Verlangen löschbar ☐ Rechenschaft (Art. 5 Abs. 2) ☐ Frist
  `____` Monate · Rechtsgrundlage `__________`
- **F** `______________________________________________`

**12 — Dritte im Dokument.** *Ärztinnen, Ärzte und Angehörige werden nicht
maskiert, Familienanamnesen enthalten **Gesundheitsdaten Angehöriger**.*
- **Vorprüfung:** Die Einwilligung des Patienten erfasst nur seine Daten; für
  Angehörige ist keine Grundlage erkennbar — **die gewichtigste offene Frage**.
  Information nach Art. 14 Abs. 5 lit. b plausibel; zusätzliche Maskierung
  möglich, nicht umgesetzt · Memo §11
- **E** ☐ hinnehmbar mit öffentlicher Information ☐ zusätzliche Maßnahme
  `__________` ☐ so nicht zulässig
- **F** `______________________________________________`

**13 — International (A3).** *EU-Endpunkt dokumentiert, für unser Projekt nicht
freigeschaltet; Unterauftragsverarbeiter **UNKNOWN**.*
- **Vorprüfung:** EU-Datenresidenz schließt Drittlandverarbeitung von Support- oder
  Missbrauchsdaten nicht aus; TIA offen · Memo §13
- **E** ☐ nur EU/EWR ☐ Drittland unter `__________` ☐ erst nach Bestätigung des
  Dienstleisters
- **F** `______________________________________________`

**Z1 — MDR** (Zusatzfrage). Bleibt die Zweckbestimmung (sprachliche Transformation
ohne Diagnose, Therapie, Prognose, Empfehlung) außerhalb Art. 2 Nr. 1 MDR? Welche
Formulierungen in Produkt, Hilfe, Marketing sind auszuschließen (Art. 2 Nr. 12)?
*Keine eigene Einstufung* · Memo §14
- **E** ☐ keine medizinische Zweckbestimmung, mit Textauflagen ☐ Einfache Sprache
  gesondert prüfen ☐ Regulatory-Prüfung erforderlich
- **F** `______________________________________________`

**Z2 — AI Act, Art. 50** (Zusatzfrage). Ist MedScoutX Anbieter, und greift die
Ausnahme für Ausgaben ohne wesentliche Änderung der Semantik für beide Modi? *Das
Ergebnis ist menschenlesbar gekennzeichnet, maschinenlesbar nicht* · Memo §15
- **E** ☐ nicht anwendbar ☐ Ausnahme für beide Modi ☐ nur für die Übersetzung
  ☐ maschinenlesbare Markierung erforderlich
- **F** `______________________________________________`

## G — Auflagen

| Nr. | Auflage | Feld | vor Aktivierung? |
|---|---|---|---|
| 1 | `____________________` | `__` | ☐ ja ☐ nein |
| 2 | `____________________` | `__` | ☐ ja ☐ nein |
| 3 | `____________________` | `__` | ☐ ja ☐ nein |
| 4 | `____________________` | `__` | ☐ ja ☐ nein |

## H — Gesamtentscheidung

- ☐ **Freigabe ohne Auflagen**
- ☐ **Freigabe mit Auflagen** (G)
- ☐ **keine Freigabe**. Begründung: `______________________________`
- ☐ **weitere Informationen erforderlich**: `______________________________`

Eine Freigabe aktiviert nichts. Dafür müssen außerdem A3 (EU-Verarbeitung) und A4
(Null-Speicherung) beim Dienstleister nachgewiesen sein.

## I–L — Zeichnung

| | |
|---|---|
| **I** Name | `______________________________` |
| **J** Funktion und Organisation | `______________________________` |
| **K** Datum | `______________________________` |
| **L** Unterschrift / schriftl. Bestätigung | `______________________________` |

Eine E-Mail genügt, wenn sie eindeutig auf dieses Dokument und sein Vorlagedatum
verweist.

---

## Anhänge (nur Verweise)

Die Anhänge werden bei externer Weitergabe als eigene Dateien mitgeliefert. Der
gezeichnete Vertrag mit dem Dienstleister wird auf Anforderung gesondert
übergeben.

| Anhang | Inhalt |
|---|---|
| [Vorprüfungsmemo](DOCUMENT_TRANSLATION_LEGAL_ASSESSMENT.md) | Begründung jeder Vorprüfung, Quellen mit Standdatum, Risikomatrix, Folgen der Entscheidungen (§18) |
| [Legal Review Packet](DOCUMENT_TRANSLATION_LEGAL_REVIEW_PACKET.md) | ausführlicher Sachverhalt, Datenflussgrenze, Vertragslage |
| [Entscheidungsmatrix](DOCUMENT_TRANSLATION_LEGAL_DECISION_MATRIX.md) | Textbausteine für AVV, Datenschutzerklärung und Patienteninformation (Anhang A = B7), beide Einwilligungsvarianten |
| [DSFA-Entwurf](DOCUMENT_TRANSLATION_DPIA_DRAFT.md) | zu Feld 8 |
| [Betroffenenrechte-Runbook](DOCUMENT_TRANSLATION_DATA_SUBJECT_RIGHTS_RUNBOOK.md) | zu Feld 11 und 12 |
| [Evidence Register](DOCUMENT_TRANSLATION_EVIDENCE_REGISTER.md) | Nachweisstand je Anforderung, einschließlich A3/A4 |

*Solange dieser Bogen nicht gezeichnet ist, bleibt die Funktion abgeschaltet. Ohne
eingetragenen Endpunkt kann sie technisch nicht laufen.*
