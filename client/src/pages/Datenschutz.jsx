import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/legal.css"; 

export default function Datenschutz() {
  const navigate = useNavigate();
  const fromPublic = new URLSearchParams(useLocation().search).get("public") === "1";

  return (
    <main className="legal">
      <header className="legal__header">
        <h1>Datenschutzerklärung</h1>
        <p className="legal__subtitle"><em>Letzte Aktualisierung: 21.08.2025</em></p>
      </header>

      <section className="legal__section">
        <h2>1. Verantwortlicher</h2>
        <address className="legal__address">
          <strong>Himan Khorshidi</strong><br/>
          Eisenstraße 64<br/>
          40227 Düsseldorf, Deutschland
        </address>
        <dl className="legal__list">
          <dt>E-Mail</dt>
          <dd><a href="mailto:himankhorshidy@gmail.com">himankhorshidy@gmail.com</a></dd>
          <dt>Telefon</dt>
          <dd><a href="tel:+491722956919">+49 172 2956919</a></dd>
        </dl>
      </section>

      <hr className="legal__divider" />

      <section className="legal__section">
        <h2>2. Worum geht es?</h2>
        <p>
          Diese Erklärung informiert darüber, wie <strong>MedScout</strong> personenbezogene Daten verarbeitet –
          insbesondere Texteingaben zu Symptomen, Bild-Uploads (z. B. Hautfotos) und technische Nutzungsdaten.
          MedScout ist kein Ersatz für eine medizinische Diagnose, sondern dient der Orientierung und kann an
          geeignete Fachrichtungen verweisen.
        </p>
      </section>

      <section className="legal__section">
        <h2>3. Kategorien personenbezogener Daten</h2>
        <ul>
          <li><strong>Nutzungs- &amp; Inhaltsdaten:</strong> Chat-Verläufe, Texteingaben, Auswahl von Körperregionen.</li>
          <li><strong>Bilddaten:</strong> von dir hochgeladene Bilder (z. B. Hautveränderungen).</li>
          <li><strong>Technische Daten:</strong> IP (ggf. gekürzt), Zeitstempel, Geräte-/Browser-Infos, Fehler-Logs.</li>
        </ul>
      </section>

      <section className="legal__section">
        <h2>4. Zwecke der Verarbeitung</h2>
        <ul>
          <li>Bereitstellung der Chat-Funktion und KI-gestützter Rückfragen.</li>
          <li>Bildanalyse zur inhaltlichen Einordnung (wenn du Bilder hochlädst).</li>
          <li>Stabilität &amp; Sicherheit (Fehleranalyse, Missbrauchsabwehr).</li>
          <li>Erfüllung gesetzlicher Pflichten (z. B. IT-Sicherheit).</li>
        </ul>
      </section>

      <section className="legal__section">
        <h2>5. Rechtsgrundlagen (DSGVO)</h2>
        <ul>
          <li><strong>Art. 6 Abs. 1 lit. b</strong> – Vertrag/ vorvertraglich: Kernfunktionen der App.</li>
          <li><strong>Art. 6 Abs. 1 lit. f</strong> – berechtigtes Interesse: Sicherheit und Fehlerbehebung.</li>
          <li><strong>Art. 9 Abs. 2 lit. a</strong> – ausdrückliche Einwilligung für <em>Gesundheitsdaten</em> (Symptome/Bilder). Widerruf jederzeit mit Wirkung für die Zukunft möglich (siehe Punkt 11).</li>
        </ul>
      </section>

      <section className="legal__section">
        <h2>6. Weitergabe an Auftragsverarbeiter &amp; Dritte</h2>
        <p>Für KI-Funktionen werden Inhalte technisch an einen KI-Dienst übermittelt, um Antworten zu erzeugen.</p>
        <p>Es erfolgt <strong>keine</strong> Weitergabe zu Werbezwecken. Auftragsverarbeiter werden nach Art. 28 DSGVO vertraglich verpflichtet.</p>
      </section>

      <section className="legal__section">
        <h2>7. Drittlandtransfer</h2>
        <p>Soweit Daten in Drittländer übertragen werden, erfolgt dies auf Basis geeigneter Garantien (insb. EU-Standardvertragsklauseln nach Art. 46 DSGVO) und ggf. ergänzender Maßnahmen.</p>
      </section>

      <section className="legal__section">
        <h2>8. Speicherfristen</h2>
        <ul>
          <li><strong>Chat-/Symptom-Verläufe (Server):</strong> i. d. R. Löschung/Anonymisierung nach <strong>30 Tagen</strong>, sofern nicht länger zur IT-Sicherheit/Fehleranalyse erforderlich.</li>
          <li><strong>Bild-Uploads (Server):</strong> Löschung nach <strong>30 Tagen</strong> oder früher auf deinen Wunsch.</li>
          <li><strong>LocalStorage (Gerät/Browser):</strong> liegt in deiner Kontrolle; du kannst ihn jederzeit löschen (App-Funktion „Verlauf löschen“ oder System/Browser-Einstellungen).</li>
          <li><strong>Protokolle/Logs:</strong> i. d. R. <strong>14–30 Tage</strong> zu Sicherheits-/Fehlerzwecken.</li>
        </ul>
      </section>

      <section className="legal__section">
        <h2>9. Sicherheit</h2>
        <p>Wir setzen angemessene technische und organisatorische Maßnahmen ein (Transportverschlüsselung, Zugriffskontrollen, Datenminimierung), um Daten vor Verlust, Missbrauch oder unbefugtem Zugriff zu schützen.</p>
      </section>

      <section className="legal__section">
        <h2>10. Kinder/Jugendliche</h2>
        <p>MedScout richtet sich nicht an Kinder unter 16 Jahren. Minderjährige nutzen die App nur mit Einwilligung der Erziehungsberechtigten.</p>
      </section>

      <section className="legal__section">
        <h2>11. Deine Rechte (Betroffenenrechte)</h2>
        <ul>
          <li>Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21).</li>
          <li><strong>Widerruf von Einwilligungen</strong> (Art. 7 Abs. 3) jederzeit mit Wirkung für die Zukunft.</li>
          <li><strong>Beschwerderecht</strong> bei einer Aufsichtsbehörde (Art. 77 DSGVO), z. B. am Wohnsitz.</li>
        </ul>
      </section>

      <section className="legal__section">
        <h2>12. Cookies &amp; LocalStorage</h2>
        <p>Keine Tracking-Cookies zu Werbezwecken. Für Komfortfunktionen kann lokaler Speicher (z. B. LocalStorage) genutzt werden, z. B. zur Sicherung deines Chatverlaufs auf deinem Gerät.</p>
      </section>

      <section className="legal__section">
        <h2>13. App-Berechtigungen</h2>
        <p>Bei Nutzung der Bildanalyse fragt MedScout nach Kamera/Dateizugriff, um ein Bild aufzunehmen/auszuwählen. Die Berechtigung ist optional und in den System-Einstellungen widerrufbar.</p>
      </section>

      <section className="legal__section">
        <h2>14. KI-Hinweise</h2>
        <ul>
          <li>Von dir gesendete Texte/Bilder werden automatisiert verarbeitet, um Antworten zu erzeugen.</li>
          <li>Bitte übermittle keine Klarnamen Dritter und keine unnötig sensiblen Daten.</li>
          <li>KI-Ausgaben sind Vorschläge und ersetzen keine ärztliche Diagnose oder Behandlung.</li>
        </ul>
      </section>

      <section className="legal__section">
        <h2>15. Änderungen dieser Erklärung</h2>
        <p>Wir passen diese Datenschutzerklärung an, wenn sich Funktionen oder Rechtslagen ändern. Die aktuelle Fassung ist in der App/Website abrufbar.</p>
      </section>

      {fromPublic && (
        <div className="legal__actions">
          <button className="btn" onClick={() => navigate("/register")}>
            Zurück zur Registrierung
          </button>
        </div>
      )}
    </main>
  );
}
