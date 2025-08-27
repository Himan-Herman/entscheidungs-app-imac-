import React from "react";
import { Link } from "react-router-dom";

export default function Datenschutz() {
  return (
    <main style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Datenschutzerklärung</h1>
      <p><em>Letzte Aktualisierung: 21.08.2025</em></p>

      <h2>1. Verantwortlicher</h2>
      <p>
        <strong>Himan Khorshidi</strong><br />
        
        Eisenstraße 64<br />
        40227 Düsseldorf, Deutschland<br />
        
        E-Mail: <a href="mailto:@medscout.de">himankhorshidy@gmail.com</a>
      </p>

      <h2>2. Worum geht es?</h2>
      <p>
        Diese Erklärung informiert darüber, wie die App <strong>MedScout</strong> personenbezogene Daten
        verarbeitet – insbesondere Texteingaben zu Symptomen, Bild-Uploads (z.&nbsp;B. Hautfotos) und technische Nutzungsdaten.
        MedScout ist <strong>kein Ersatz für eine medizinische Diagnose</strong>, sondern dient der
        Orientierung und verweist ggf. an geeignete Fachrichtungen.
      </p>

      <h2>3. Kategorien personenbezogener Daten</h2>
      <ul>
        <li><strong>Nutzungs- &amp; Inhaltsdaten:</strong> Chat-Verläufe, Texteingaben zu Symptomen, Auswahlen von Körperregionen.</li>
        <li><strong>Bilddaten:</strong> von dir hochgeladene Bilder (z.&nbsp;B. Hautveränderungen).</li>
        <li><strong>Technische Daten:</strong> IP-Adresse (gekürzt, soweit möglich), Zeitstempel, Geräte-/Browser-Infos, Fehler-Logs.</li>
        
      </ul>

      <h2>4. Zwecke der Verarbeitung</h2>
      <ul>
        <li>Bereitstellung der Chat-Funktion und KI-gestützter Rückfragen zu Symptomen.</li>
        <li>Analyse der Bilder zur inhaltlichen Einordnung (sofern von dir hochgeladen).</li>
        <li>Verbesserung der App-Stabilität (Fehleranalyse, Missbrauchsabwehr).</li>
        <li>Erfüllung gesetzlicher Pflichten (z.&nbsp;B. Nachweispflichten, IT-Sicherheit).</li>
      </ul>

      <h2>5. Rechtsgrundlagen (DSGVO)</h2>
      <ul>
        <li><strong>Art. 6 Abs. 1 lit. b</strong> (Vertragserfüllung/ vorvertragliche Maßnahmen): Bereitstellung der Kernfunktionen der App.</li>
        <li><strong>Art. 6 Abs. 1 lit. f</strong> (berechtigtes Interesse): App-Sicherheit, Fehlerbehebung, Missbrauchsverhinderung.</li>
        <li>
          <strong>Art. 9 Abs. 2 lit. a</strong> (ausdrückliche Einwilligung) für <em>Gesundheitsdaten</em>:
          Wenn du Symptome oder Bilder mit Gesundheitsbezug eingibst/hochlädst, verarbeiten wir besondere Kategorien personenbezogener Daten auf Basis deiner Einwilligung.
          Diese Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen (siehe Punkt 11).
        </li>
      </ul>

      <h2>6. Weitergabe an Auftragsverarbeiter &amp; Dritte</h2>
      <p>
        Für KI-Funktionen werden Inhalte technisch an einen KI‑Dienst übermittelt, um Antworten zu erzeugen:
      </p>
      
      <p>
        Es erfolgt <strong>keine</strong> Weitergabe zu Werbezwecken. Auftragsverarbeiter werden vertraglich nach Art.28 DSGVO verpflichtet.
      </p>

      <h2>7. Drittlandtransfer</h2>
      <p>
        Soweit Daten in Drittländer (außerhalb der EU/des EWR) übertragen werden, geschieht dies auf Basis geeigneter Garantien
        (insb. EU‑Standardvertragsklauseln nach Art.46 DSGVO) und – wo erforderlich – ergänzender Maßnahmen.
      </p>

      <h2>8. Speicherfristen</h2>
      <ul>
        <li>
          <strong>Chat-/Symptom-Verläufe (Server):</strong> 
         
          werden standardmäßig nach <strong>30 Tagen</strong> gelöscht oder anonymisiert, sofern keine längere Aufbewahrung zur IT‑Sicherheit oder Fehleranalyse notwendig ist.
        </li>
        <li>
          <strong>Bild-Uploads (Server):</strong> 
          
          werden nach <strong>30 Tagen</strong> gelöscht, sofern keine frühere Löschung durch dich erfolgt.
        </li>
        <li>
          <strong>LocalStorage (Gerät/Browser):</strong> liegt vollständig in deiner Kontrolle und kann von dir jederzeit gelöscht werden
          (z.&nbsp;B. über „Verlauf löschen“ in der App oder die Browser/OS‑Einstellungen).
        </li>
        <li>
          <strong>Protokolle/Logs:</strong> 
         
          i.d.R. <strong>14–30 Tage</strong> zu Sicherheits- und Fehlerzwecken.
        </li>
      </ul>

      <h2>9. Sicherheit</h2>
      <p>
        Wir treffen angemessene technische und organisatorische Maßnahmen (u.a. Transportverschlüsselung, Zugriffskontrollen,
        Datenminimierung), um personenbezogene Daten vor Verlust, Missbrauch oder unbefugtem Zugriff zu schützen.
      </p>

      <h2>10. Kinder/Jugendliche</h2>
      <p>
        MedScout richtet sich nicht an Kinder unter 16 Jahren. Wenn du minderjährig bist, nutze die App nur mit Einwilligung deiner Erziehungsberechtigten.
      </p>

      <h2>11. Deine Rechte (Betroffenenrechte)</h2>
      <ul>
        <li>Auskunft (Art.15 DSGVO), Berichtigung (Art.16), Löschung (Art.17), Einschränkung (Art.18), Datenübertragbarkeit (Art.20), Widerspruch (Art.21).</li>
        <li>
          <strong>Widerruf von Einwilligungen</strong> (Art.7 Abs.3): Du kannst uns jederzeit kontaktieren und erteilte Einwilligungen mit Wirkung für die Zukunft widerrufen.
        </li>
        <li>
          <strong>Beschwerderecht</strong> bei einer Aufsichtsbehörde (Art.77 DSGVO), z.B. bei der für deinen Wohnsitz zuständigen Behörde.
        </li>
      </ul>
      <p>
        Zur Wahrnehmung deiner Rechte genügt eine E‑Mail an:{" "}
      
        <a href="mailto:info@medscout.de">himankhorshidy@gmail.com</a>
      </p>

      <h2>12. Cookies &amp; LocalStorage</h2>
      <p>
        MedScout setzt aktuell keine Tracking‑Cookies für Werbezwecke ein. Für Komfortfunktionen können lokale Speichermethoden
        (z.&nbsp;B. LocalStorage) verwendet werden, um deinen Chatverlauf auf deinem Gerät zu erhalten. Du kannst dies jederzeit
        über die App („Verlauf löschen“) oder in deinem Browser/OS entfernen.
      </p>

      <h2>13. App‑Berechtigungen</h2>
      <p>
        Für die Bildanalyse fragt MedScout – nur wenn du diese Funktion nutzt – nach Zugriff auf Kamera/Dateien,
        um ein Bild aufzunehmen oder auszuwählen. Die Berechtigung ist optional und kann in den System‑Einstellungen widerrufen werden.
      </p>

      <h2>14. KI‑Hinweise</h2>
      <ul>
        <li>Texte und Bilder, die du aktiv sendest, werden automatisiert verarbeitet, um Antworten zu erzeugen.</li>
        <li>Bitte übermittele <strong>keine Klarnamen</strong> anderer Personen und keine sensiblen Daten, die für den Zweck nicht erforderlich sind.</li>
        <li>Die Ausgaben der KI sind <strong>Vorschläge</strong> und ersetzen keine ärztliche Diagnose oder Behandlung.</li>
      </ul>

      <h2>15. Änderungen dieser Erklärung</h2>
      <p>
        Wir passen diese Datenschutzerklärung an, wenn sich Funktionen oder Rechtslagen ändern. Die jeweils aktuelle Fassung ist in der App/Website abrufbar.
      </p>
      <p style={{ marginTop: "2rem" }}>
        <Link to="/impressum">Zum Impressum</Link>
      </p>
    </main>
  );
}
