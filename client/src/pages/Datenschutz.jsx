import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/legal.css";

export default function Datenschutz() {
  const navigate = useNavigate();
  const fromPublic = new URLSearchParams(useLocation().search).get("public") === "1";

  return (
    <main
      className="legal"
      role="main"
      aria-labelledby="datenschutz-title"
    >
      <header className="legal__header">
        <h1 id="datenschutz-title">Datenschutzerklärung</h1>
        <p className="legal__subtitle">
          <em>Letzte Aktualisierung: 29.11.2025</em>
        </p>
      </header>

      {/* 1. Verantwortlicher */}
      <section className="legal__section" aria-labelledby="ds-1-verantwortlich">
        <h2 id="ds-1-verantwortlich">1. Verantwortlicher</h2>
        <p>
          Diese Datenschutzerklärung informiert dich darüber, wie die App{" "}
          <strong>MedScoutX</strong> personenbezogene Daten verarbeitet.
        </p>
        <address className="legal__address">
          <strong>Verantwortlich im Sinne der DSGVO</strong>
          <br />
          <strong>Himan Khorshidi</strong>
          <br />
          Eisenstraße 64
          <br />
          40227 Düsseldorf, Deutschland
        </address>
        <dl className="legal__list">
          <dt>E-Mail</dt>
          <dd>
            <a href="mailto:privacy@medscout.app">
              himankhorshidy@gmail.com
            </a>
          </dd>
          <dt>Telefon</dt>
          <dd>
            <a href="tel:+4921115895272">+49 211 15895272</a>
          </dd>
        </dl>
      </section>

      <hr className="legal__divider" />

      {/* 2. Worum geht es? */}
      <section className="legal__section" aria-labelledby="ds-2-worum">
        <h2 id="ds-2-worum">2. Worum geht es?</h2>
        <p>
          Diese Erklärung beschreibt, wie <strong>MedScoutX</strong> deine
          personenbezogenen Daten verarbeitet, wenn du:
        </p>
        <ul>
          <li>die App installierst und ein Konto anlegst,</li>
          <li>Symptome über den Text-Chat eingibst,</li>
          <li>Körperregionen über die Body-Map auswählst,</li>
          <li>Bilder (z. B. Hautfotos oder medizinische Aufnahmen) hochlädst,</li>
          <li>unser KI-basiertes System zur Einschätzung nutzt.</li>
        </ul>
        <p>
          MedScoutX ist <strong>kein medizinisches Diagnosewerkzeug</strong> und
          ersetzt keine ärztliche Untersuchung oder Beratung. Die App dient
          ausschließlich der <strong>orientierenden Einschätzung</strong> und
          kann dir Hinweise auf mögliche Fachrichtungen geben, an die du dich
          wenden kannst.
        </p>
      </section>

      {/* 3. Kategorien personenbezogener Daten */}
      <section className="legal__section" aria-labelledby="ds-3-kategorien">
        <h2 id="ds-3-kategorien">3. Kategorien personenbezogener Daten</h2>
        <p>
          Je nach Nutzung der App können die folgenden Kategorien von
          personenbezogenen Daten verarbeitet werden:
        </p>
        <ul>
          <li>
            <strong>Kontodaten:</strong> E-Mail-Adresse, ggf. Name oder
            Benutzername, Passwort-Hash (kein Klartext-Passwort), Spracheinstellung.
          </li>
          <li>
            <strong>Gesundheitsbezogene Daten:</strong> Texteingaben zu Symptomen,
            Antworten im Symptomchat, Auswahl von Körperregionen auf der Body-Map,
            Gesundheitsangaben in Freitextfeldern.
          </li>
          <li>
            <strong>Bilddaten:</strong> von dir hochgeladene Bilder (z. B.
            Hautveränderungen, Fotos von Körperregionen oder anderen
            gesundheitlich relevanten Bereichen). MedScoutX nutzt diese Bilder,
            um Auffälligkeiten zu beschreiben, jedoch <strong>nicht</strong> zur
            eigenständigen medizinischen Diagnostik.
          </li>
          <li>
            <strong>Nutzungs- und Protokolldaten:</strong> Zeitstempel von Anfragen,
            technische Fehler-Logs, ggf. gekürzte IP-Adresse, Browser-/Geräteinformationen,
            Betriebssystem, verwendete App-Version.
          </li>
          <li>
            <strong>Abo- und Vertragsdaten (falls du ein kostenpflichtiges Abo nutzt):</strong>{" "}
            gebuchter Tarif, Laufzeit, Status des Abos, technische Informationen zum
            Kauf (über App Store/Play Store). Vollständige Zahlungsdaten (z. B.
            Kreditkartennummern) werden nicht von MedScoutX gespeichert, sondern vom
            jeweiligen Zahlungsdienst der Plattform verarbeitet.
          </li>
          <li>
            <strong>Lokale Daten auf deinem Gerät:</strong> z. B. lokal gespeicherter
            Chatverlauf oder Einstellungen (z. B. Sprache, Barrierefreiheitsoptionen)
            im LocalStorage oder vergleichbaren Speichermechanismen.
          </li>
        </ul>
      </section>

      {/* 4. Zwecke der Verarbeitung */}
      <section className="legal__section" aria-labelledby="ds-4-zwecke">
        <h2 id="ds-4-zwecke">4. Zwecke der Verarbeitung</h2>
        <ul>
          <li>
            <strong>Bereitstellung der App-Funktionen:</strong> Login, Registrierung,
            Kontoverwaltung und Grundfunktionen von MedScoutX.
          </li>
          <li>
            <strong>Symptomchat &amp; KI-gestützte Rückfragen:</strong> Verarbeitung
            deiner Texteingaben, um dir Fragen und Hinweise zur weiteren Abklärung zu
            geben.
          </li>
          <li>
            <strong>Body-Map:</strong> Zuordnung deiner ausgewählten Körperregionen
            zu geeigneten KI-Rückfragen und Hinweisen.
          </li>
          <li>
            <strong>Bildanalyse:</strong> Verarbeitung deiner hochgeladenen Bilder, um
            Auffälligkeiten zu beschreiben und mögliche Handlungsoptionen vorzuschlagen
            (z. B. „ärztlich abklären lassen“). Es erfolgt keine automatische Diagnose
            im medizinisch-rechtlichen Sinne.
          </li>
          <li>
            <strong>Stabilität &amp; Sicherheit:</strong> Fehleranalyse,
            Missbrauchserkennung, Schutz der Systeme und Daten.
          </li>
          <li>
            <strong>Rechtliche Anforderungen:</strong> Erfüllung gesetzlicher
            Pflichten (z. B. Nachweis von IT-Sicherheitsmaßnahmen, Speicherfristen).
          </li>
        </ul>
      </section>

      {/* 5. Rechtsgrundlagen */}
<section className="legal__section" aria-labelledby="ds-5-rechtsgrundlagen">
  <h2 id="ds-5-rechtsgrundlagen">5. Rechtsgrundlagen (DSGVO)</h2>

  <p>
    Je nach Nutzung stützen wir die Verarbeitung deiner Daten auf folgende Rechtsgrundlagen:
  </p>

  <ul>
    <li>
      <strong>Art. 6 Abs. 1 lit. b DSGVO – Vertragserfüllung:</strong> 
      Für die Bereitstellung der technischen App-Funktionen, wie Registrierung, Login 
      und Verwaltung deines Nutzerkontos.
    </li>

    <li>
      <strong>Art. 6 Abs. 1 lit. f DSGVO – berechtigtes Interesse:</strong> 
      Zur Gewährleistung der Sicherheit der IT-Systeme, Fehleranalyse und 
      Missbrauchserkennung.
    </li>

    <li>
      <strong>Art. 6 Abs. 1 lit. c DSGVO – rechtliche Verpflichtung:</strong> 
      Soweit gesetzliche Pflichten zur Aufbewahrung bestimmter Daten bestehen 
      (z. B. steuerrechtliche Pflichten im Zusammenhang mit Abonnements).
    </li>

    <li>
      <strong>Art. 9 Abs. 2 lit. a DSGVO – ausdrückliche Einwilligung:</strong> 
      Dies ist die maßgebliche Rechtsgrundlage für die Verarbeitung deiner 
      Gesundheitsdaten. Dazu zählen alle von dir freiwillig eingegebenen Symptome 
      im Text-Chat, die Auswahl von Körperregionen in der Body-Map sowie das 
      Hochladen und die Analyse von Bildern. 
      <br />
      Vor der ersten Nutzung dieser Funktionen wirst du 
      <strong>explizit um deine Einwilligung</strong> gebeten 
      (z. B. durch eine Checkbox und Bestätigungsschaltfläche). 
      Du kannst diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen.
    </li>
  </ul>
</section>


     {/* 6. Auftragsverarbeiter & Weitergabe */}
<section className="legal__section" aria-labelledby="ds-6-auftragsverarbeiter">
  <h2 id="ds-6-auftragsverarbeiter">6. Auftragsverarbeiter &amp; Weitergabe an Dritte</h2>

  <p>
    Für bestimmte Funktionen setzt MedScoutX Dienstleister als 
    <strong>Auftragsverarbeiter</strong> nach Art. 28 DSGVO ein. Die wichtigsten Kategorien sind:
  </p>

  <ul>
    <li>
      <strong>Hosting-Anbieter (EU):</strong> 
      Ein europäischer Cloud-Anbieter stellt die Infrastruktur für Server und Datenbank bereit 
      (z.&nbsp;B. Render.com mit EU-Standort).
    </li>

    <li>
      <strong>KI-Dienstleister – OpenAI (USA):</strong> 
      Für die KI-basierte Verarbeitung deiner 
      <strong>Texteingaben, Bilddaten und Body-Map-Angaben</strong> nutzt MedScoutX Dienste 
      der OpenAI LLC (San Francisco, USA). 
      Dabei werden die Inhalte verschlüsselt an OpenAI übermittelt, dort maschinell 
      verarbeitet und nach der Verarbeitung gelöscht.
    </li>

    <li>
      <strong>E-Mail-Dienstleister:</strong> 
      Für die Zustellung von System-E-Mails (z.&nbsp;B. Verifizierungs-E-Mails) 
      wird ein technischer Dienstleister eingesetzt.
    </li>
  </ul>

  <p>
    Alle Dienstleister wurden nach Art. 28 DSGVO vertraglich verpflichtet und 
    verarbeiten Daten ausschließlich nach unserer Weisung. 
    Es erfolgt <strong>keine Weitergabe</strong> deiner Daten zu Werbe- oder Marketingzwecken.
  </p>
</section>


     {/* 7. Drittlandtransfer */}
<section className="legal__section" aria-labelledby="ds-7-drittland">
  <h2 id="ds-7-drittland">7. Drittlandtransfer</h2>

  <p>
    Bei der Nutzung der KI-Funktionen von MedScoutX werden Inhalte 
    (z.&nbsp;B. Texte, Symptome, Bilddaten) an den 
    <strong>KI-Dienstleister OpenAI LLC in den USA</strong> übertragen. 
    Ein solcher Transfer stellt ein Drittlandtransfer im Sinne der DSGVO dar.
  </p>

  <p>
    Um ein angemessenes Datenschutzniveau sicherzustellen, erfolgt die Übermittlung 
    auf Grundlage der <strong>EU-Standardvertragsklauseln (Art. 46 DSGVO)</strong> 
    sowie zusätzlicher technischer und organisatorischer Maßnahmen 
    (Verschlüsselung während der Übermittlung, kurze Verarbeitungsdauer, 
    Löschung der Daten nach der Beantwortung durch den KI-Dienst).
  </p>

  <p>
    Weitere Informationen findest du in der Datenschutzdokumentation von OpenAI: 
    <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noreferrer">
      https://openai.com/policies/privacy-policy
    </a>
  </p>
</section>


      {/* 8. Speicherfristen */}
<section className="legal__section" aria-labelledby="ds-8-speicherfristen">
  <h2 id="ds-8-speicherfristen">8. Speicherfristen</h2>

  <p>
    MedScoutX speichert grundsätzlich <strong>keine Chatverläufe, keine Symptome und keine Bilder dauerhaft auf dem Server</strong>. 
    Alle gesundheitsbezogenen Inhalte werden ausschließlich <strong>lokal auf deinem Gerät</strong> gespeichert 
    (z.&nbsp;B. im LocalStorage) und können jederzeit gelöscht werden.
  </p>

  <ul>
    <li>
      <strong>Kontodaten:</strong> E-Mail-Adresse, Passwort-Hash und Spracheinstellung 
      werden für die Dauer deines Nutzerkontos gespeichert. Nach Löschung des Kontos 
      werden diese Daten gelöscht oder anonymisiert, sofern keine gesetzlichen Pflichten bestehen.
    </li>

    <li>
      <strong>Chat- und Symptomdaten:</strong> werden <strong>nicht auf dem Server gespeichert</strong>. 
      Sie verbleiben ausschließlich auf deinem Gerät und werden vollständig gelöscht, 
      sobald du „Neue Unterhaltung“ oder „Verlauf löschen“ verwendest.
    </li>

    <li>
      <strong>Bild-Uploads:</strong> werden nur <strong>kurzzeitig</strong> verarbeitet, 
      um sie an den KI-Dienst weiterzuleiten. Danach werden sie verworfen. 
      Eine <strong>dauerhafte Speicherung erfolgt nicht</strong>.
    </li>

    <li>
      <strong>Technische Protokolle / Server-Logs:</strong> 
      Für Betrieb, Sicherheit und Fehleranalyse speichern Hosting-Dienste automatisch 
      technische Protokolle (z. B. Zeitpunkt, IP-Adresse in gekürzter Form, Fehlerdetails) 
      für gewöhnlich <strong>14–30&nbsp;Tage</strong>. 
      Diese Daten werden <strong>nicht</strong> mit deinem Profil oder deinen Inhalten verknüpft 
      und <strong>nicht</strong> zu Werbezwecken genutzt.
    </li>

    <li>
      <strong>Lokale Daten (LocalStorage, App-Speicher):</strong> 
      Chatverläufe, Einstellungen (z.&nbsp;B. Sprache, Barrierefreiheit) und 
      Verlaufseinträge werden ausschließlich auf deinem Gerät gespeichert und 
      können jederzeit über „Verlauf löschen“ oder Geräteeinstellungen entfernt werden.
    </li>
  </ul>
</section>

      {/* 9. Sicherheit */}
      <section className="legal__section" aria-labelledby="ds-9-sicherheit">
        <h2 id="ds-9-sicherheit">9. Sicherheit</h2>
        <p>
          Wir setzen angemessene technische und organisatorische Maßnahmen ein, um
          deine Daten vor Verlust, Veränderung, unbefugtem Zugriff oder
          sonstigem Missbrauch zu schützen. Dazu zählen insbesondere:
        </p>
        <p>
  Die Verarbeitung deiner Gesundheitsdaten erfolgt ausschließlich, 
  nachdem du bei der ersten Nutzung der Funktionen 
  (Symptom-Chat, Body-Map, Bildanalyse) eine 
  <strong> ausdrückliche Einwilligung </strong> 
  erteilt hast (Checkbox + Bestätigung). 
  Diese Einwilligung kannst du jederzeit in den Einstellungen der App widerrufen.
</p>

        <ul>
          <li>Transportverschlüsselung (TLS/HTTPS) bei der Übertragung,</li>
          <li>Zugriffsbeschränkungen und Rollen-/Rechtesysteme,</li>
          <li>Datenminimierung und pseudonymisierte Verarbeitung, wo möglich,</li>
          <li>regelmäßige Aktualisierung der Systeme.</li>
        </ul>
      </section>

      {/* 10. Kinder/Jugendliche */}
      <section className="legal__section" aria-labelledby="ds-10-kinder">
        <h2 id="ds-10-kinder">10. Kinder und Jugendliche</h2>
        <p>
          MedScoutX richtet sich nicht an Kinder unter 16 Jahren. Minderjährige
          sollten die App nur mit Einwilligung ihrer Erziehungsberechtigten
          nutzen. Wenn wir Kenntnis erhalten, dass Daten eines Kindes unter 16
          Jahren ohne Zustimmung der Sorgeberechtigten verarbeitet wurden,
          werden wir diese Daten löschen.
        </p>
      </section>

      {/* 11. Betroffenenrechte */}
      <section className="legal__section" aria-labelledby="ds-11-rechte">
        <h2 id="ds-11-rechte">11. Deine Rechte (Betroffenenrechte)</h2>
        <p>
          Als betroffene Person stehen dir im Rahmen der DSGVO insbesondere die
          folgenden Rechte zu:
        </p>
        <ul>
          <li>
            <strong>Auskunft (Art. 15 DSGVO):</strong> Du kannst Auskunft darüber
            verlangen, welche personenbezogenen Daten wir über dich verarbeiten.
          </li>
          <li>
            <strong>Berichtigung (Art. 16 DSGVO):</strong> Du kannst die
            Berichtigung unrichtiger oder Vervollständigung unvollständiger Daten
            verlangen.
          </li>
          <li>
            <strong>Löschung (Art. 17 DSGVO):</strong> Du kannst die Löschung deiner
            personenbezogenen Daten verlangen, sofern keine gesetzlichen
            Aufbewahrungspflichten entgegenstehen.
          </li>
          <li>
            <strong>Einschränkung (Art. 18 DSGVO):</strong> Du kannst die
            Einschränkung der Verarbeitung verlangen.
          </li>
          <li>
            <strong>Datenübertragbarkeit (Art. 20 DSGVO):</strong> Du kannst verlangen,
            Daten in einem strukturierten, gängigen und maschinenlesbaren Format
            zu erhalten.
          </li>
          <li>
            <strong>Widerspruch (Art. 21 DSGVO):</strong> Du kannst der Verarbeitung
            aus Gründen, die sich aus deiner besonderen Situation ergeben,
            widersprechen, sofern wir uns auf ein berechtigtes Interesse stützen.
          </li>
          <li>
            <strong>Widerruf von Einwilligungen (Art. 7 Abs. 3 DSGVO):</strong>{" "}
            Eine einmal erteilte Einwilligung, insbesondere in die Verarbeitung
            von Gesundheitsdaten, kannst du jederzeit mit Wirkung für die Zukunft
            widerrufen.
          </li>
          <li>
            <strong>Beschwerderecht (Art. 77 DSGVO):</strong> Du hast das Recht,
            dich bei einer Datenschutzaufsichtsbehörde zu beschweren, z. B. an
            deinem Wohnort oder am Sitz des Verantwortlichen.
          </li>
        </ul>
        <p>
          Für die Ausübung deiner Rechte kannst du dich jederzeit über die oben
          angegebenen Kontaktdaten an uns wenden.
        </p>
      </section>

      {/* 12. Cookies & LocalStorage */}
      <section className="legal__section" aria-labelledby="ds-12-cookies">
        <h2 id="ds-12-cookies">12. Cookies &amp; LocalStorage</h2>
        <p>
          MedScoutX verwendet <strong>keine Tracking-Cookies zu Werbezwecken</strong>.
          Für Komfortfunktionen kann lokaler Speicher auf deinem Gerät genutzt
          werden, zum Beispiel:
        </p>
        <ul>
          <li>Speicherung deiner Spracheinstellungen,</li>
          <li>optionale Speicherung des Chatverlaufs,</li>
          <li>Barrierefreiheitsoptionen (z. B. Schriftgröße).</li>
        </ul>
        <p>
          Du kannst diese Daten jederzeit über entsprechende Funktionen in der
          App oder über die Einstellungen deines Geräts bzw. Browsers löschen.
        </p>
      </section>

      {/* 13. App-Berechtigungen */}
      <section className="legal__section" aria-labelledby="ds-13-berechtigungen">
        <h2 id="ds-13-berechtigungen">13. App-Berechtigungen</h2>
        <p>
          Je nach Nutzung kann MedScoutX auf folgende Berechtigungen deines
          Geräts zugreifen:
        </p>
        <ul>
          <li>
            <strong>Kamera/Dateizugriff:</strong> für das Aufnehmen bzw. Auswählen
            von Bildern zur Bildanalyse. Diese Berechtigung ist optional und kann
            in den System-Einstellungen deines Geräts widerrufen werden.
          </li>
          <li>
            <strong>Speicherzugriff:</strong> um Bilddateien oder temporäre Daten
            verarbeiten zu können.
          </li>
        </ul>
        <p>
          MedScoutX greift nicht ohne dein Zutun auf Inhalte zu und sendet keine
          Daten im Hintergrund an Dritte, die nicht für die Funktionsweise der
          App erforderlich sind.
        </p>
      </section>

      {/* 14. KI-Hinweise */}
      <section className="legal__section" aria-labelledby="ds-14-ki">
        <h2 id="ds-14-ki">14. Hinweise zur KI-Verarbeitung</h2>
        <ul>
          <li>
            Deine Texte und gegebenenfalls Bilder werden automatisiert verarbeitet,
            um Vorschläge und Hinweise zu generieren.
          </li>
          <li>
            Die KI kann Fehler machen oder Situationen falsch einschätzen. Bitte
            überprüfe die Inhalte kritisch und nutze sie nur zur Orientierung.
          </li>
          <li>
            Übermittle keine Namen oder identifizierende Angaben Dritter und
            vermeide unnötig umfangreiche personenbezogene Daten.
          </li>
          <li>
            Die Nutzung der App ersetzt keine persönliche medizinische Beratung,
            Diagnose oder Behandlung durch Ärztinnen und Ärzte oder anderes
            medizinisches Fachpersonal.
          </li>
        </ul>
      </section>

      {/* 15. Keine automatisierte Entscheidungsfindung */}
<section className="legal__section" aria-labelledby="ds-15-entscheid">
  <h2 id="ds-15-entscheid">15. Keine automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO</h2>

  <p>
    MedScoutX trifft <strong>keine Diagnosen</strong> und keine 
    automatisierten Entscheidungen mit rechtlicher oder ähnlich erheblicher Wirkung. 
    Die KI-generierten Inhalte dienen ausschließlich der 
    <strong>orientierenden Einschätzung</strong> und ersetzen keine ärztliche Beratung. 
    Du wirst in medizinisch relevanten Fällen aufgefordert, eine Ärztin oder einen Arzt 
    zu kontaktieren.
  </p>
</section>


      {fromPublic && (
        <div className="legal__actions">
          <button
            className="btn"
            type="button"
            onClick={() => navigate("/register")}
            aria-label="Zurück zur Registrierungsseite"
          >
            Zurück zur Registrierung
          </button>
        </div>
      )}
    </main>
  );
}

