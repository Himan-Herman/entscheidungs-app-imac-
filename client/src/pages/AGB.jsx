import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/agb.css";
import { useLocation } from "react-router-dom";


export default function AGB() {
    const navigate = useNavigate();
    const location = useLocation();
  

  // Individueller Hintergrund nur für AGB-Seite
  useEffect(() => {
    document.body.classList.add("bg-agb");
    return () => document.body.classList.remove("bg-agb");
  }, []);
  const showBackButton =
  new URLSearchParams(location.search).get("from") === "register";
  return (
    <main className="agb" role="main" aria-labelledby="agb-title">
      <header className="agb__header">
        <h1 id="agb-title">Allgemeine Geschäftsbedingungen (AGB)</h1>
        <p className="agb__subtitle">Version 1.0 – gültig ab 01.12.2025</p>
      </header>

      {/* §1 Geltungsbereich und Anbieter */}
      <section
        className="agb__section"
        aria-labelledby="agb-1-geltungsbereich"
      >
        <h2 id="agb-1-geltungsbereich">§1 Geltungsbereich und Anbieter</h2>
        <p>
          Diese Allgemeinen Geschäftsbedingungen regeln die Nutzung der mobilen
          und webbasierten Anwendung <strong>MedScoutX</strong> (im Folgenden
          „App“) durch private Endnutzer.
        </p>
        <p>
          Anbieter der App ist:
          <br />
          <strong>MedScoutX Health Solutions – Inh. Himan Khorshidi</strong>
          <br />
          Eisenstraße 64<br />
          40227 Düsseldorf<br />
          Deutschland
          <br />
          E-Mail:{" "}
          <a href="mailto:contact@medscout.app">contact@medscout.app</a>
        </p>
        <p>
          Die Nutzung der App ist ausschließlich volljährigen Personen ab{" "}
          <strong>18 Jahren</strong> gestattet. Minderjährige dürfen die App
          nicht verwenden.
        </p>
      </section>

      {/* §2 Zweck der App und medizinischer Hinweis */}
      <section className="agb__section" aria-labelledby="agb-2-zweck">
        <h2 id="agb-2-zweck">§2 Zweck der App und medizinischer Hinweis</h2>
        <p>
          MedScoutX ist ein KI-gestütztes Informations- und
          Orientierungssystem im Gesundheitsbereich. Die App dient dazu,
          Nutzern eine erste strukturierte Einschätzung möglicher Ursachen
          ihrer Beschwerden sowie potenziell geeigneter medizinischer
          Fachrichtungen bereitzustellen.
        </p>
        <p>
          MedScoutX ist <strong>kein Medizinprodukt</strong> im Sinne der
          EU-Medizinprodukteverordnung (MDR). Insbesondere:
        </p>
        <ul>
          <li>stellt die App <strong>keine Diagnosen</strong>,</li>
          <li>
            empfiehlt sie <strong>keine konkreten Therapien</strong> oder
            Medikamente,
          </li>
          <li>
            ersetzt sie <strong>nicht die ärztliche Entscheidung</strong> oder
            Behandlung.
          </li>
        </ul>
        <p>
          Die Nutzung der App ersetzt in keinem Fall die persönliche
          Untersuchung, Beratung oder Behandlung durch Ärztinnen, Ärzte oder
          anderes medizinisches Fachpersonal. Entscheidungen über Diagnostik,
          Therapien oder Medikationen dürfen nicht allein auf Grundlage der
          KI-Ausgaben getroffen werden.
        </p>
        <p>
          In akuten oder lebensbedrohlichen Situationen ist unverzüglich der
          jeweilige Notruf (z.&nbsp;B. EU: <strong>112</strong>, USA:{" "}
          <strong>911</strong>) oder der ärztliche Notdienst zu wählen.
        </p>
      </section>

      {/* §3 Nutzungsvoraussetzungen und Registrierung */}
      <section className="agb__section" aria-labelledby="agb-3-vertrag">
        <h2 id="agb-3-vertrag">
          §3 Nutzungsvoraussetzungen, Registrierung und Konto
        </h2>
        <p>
          (1) Die Nutzung von MedScoutX setzt in der Regel die Anlage eines
          Nutzerkontos voraus. Die Registrierung ist ausschließlich Personen
          gestattet, die das <strong>18. Lebensjahr vollendet</strong> haben.
        </p>
        <p>
          (2) Der Nutzer bestätigt im Rahmen der Registrierung ausdrücklich,
          dass er mindestens 18 Jahre alt ist. Der Anbieter ist berechtigt,
          Altersnachweise zu verlangen oder Konten bei begründetem Zweifel am
          Alter zu sperren.
        </p>
        <p>
          (3) Der Nutzer ist verpflichtet, bei der Registrierung korrekte und
          vollständige Angaben zu machen und diese bei Änderungen zu
          aktualisieren.
        </p>
        <p>
          (4) Zugangsdaten (z.&nbsp;B. Passwort, Login-Token) sind
          vertraulich zu behandeln und dürfen nicht an Dritte weitergegeben
          werden. Der Nutzer ist für alle Aktivitäten verantwortlich, die unter
          Verwendung seiner Zugangsdaten vorgenommen werden, sofern er dies zu
          vertreten hat.
        </p>
        <p>
          (5) Die Nutzung der App zu rechtswidrigen Zwecken, zur Analyse von
          Daten Dritter ohne deren Einwilligung, zur Umgehung von
          Sicherheitsmechanismen oder zur automatisierten Massennutzung
          (Scraping, Bots) ist untersagt.
        </p>
      </section>

      {/* §4 Leistungen der App */}
      <section className="agb__section" aria-labelledby="agb-4-leistungen">
        <h2 id="agb-4-leistungen">§4 Leistungen der App</h2>
        <p>
          (1) MedScoutX stellt insbesondere folgende Funktionen bereit:
        </p>
        <ul>
          <li>KI-gestützte Symptomanalyse über einen Chatbereich,</li>
          <li>KI-gestützte Analyse von Bilddaten,</li>
          <li>Auswahl von Körperregionen über eine Körperkarte,</li>
          <li>Verwaltung eines Nutzerkontos und Verlaufsfunktionen,</li>
          <li>
            ggf. zusätzliche Funktionen im Rahmen kostenpflichtiger
            Abonnements.
          </li>
        </ul>
        <p>
          (2) Der konkrete Funktionsumfang kann je nach App-Version und
          gewähltem Abonnement variieren. Ein Anspruch auf bestimmte
          Funktionalitäten besteht nur, soweit diese ausdrücklich zugesichert
          wurden.
        </p>
        <p>
          (3) Der Anbieter ist berechtigt, Funktionen anzupassen, zu erweitern
          oder einzuschränken, sofern dies für den Nutzer zumutbar ist und
          wesentliche Vertragspflichten nicht beeinträchtigt werden.
        </p>
      </section>

      {/* §5 Abonnements und Zahlungsbedingungen */}
      <section className="agb__section" aria-labelledby="agb-5-abo">
        <h2 id="agb-5-abo">§5 Abonnements und Zahlungsbedingungen</h2>
        <p>
          (1) Neben einer ggf. kostenlosen Basisnutzung bietet MedScoutX
          kostenpflichtige Abonnements an (z.&nbsp;B. „Pro“, „Premium“,
          „Unlimited“). Die jeweils aktuellen Preise, Laufzeiten und
          Leistungsumfänge werden in der App sowie im Apple App Store und
          Google Play Store angezeigt.
        </p>
        <p>
          (2) Der Abschluss eines Abonnements erfolgt ausschließlich über den
          Apple App Store oder den Google Play Store. Es gelten die
          Geschäftsbedingungen und Zahlungsbedingungen des jeweiligen
          Store-Betreibers.
        </p>
        <p>
          (3) Abonnements verlängern sich in der Regel automatisch um den
          jeweils angegebenen Abrechnungszeitraum, sofern sie nicht spätestens
          24 Stunden vor Ablauf des aktuellen Zeitraums in den
          Store-Einstellungen gekündigt werden.
        </p>
        <p>
          (4) Widerrufe und Erstattungen von In-App-Käufen sind ausschließlich
          über den jeweiligen Store-Betreiber abzuwickeln. MedScoutX kann keine
          Widerrufe oder Erstattungen für Store-Abonnements direkt bearbeiten.
        </p>
      </section>

      {/* §6 Verbrauchszähler und Fair-Use */}
      <section className="agb__section" aria-labelledby="agb-6-fairuse">
        <h2 id="agb-6-fairuse">
          §6 Verbrauchszähler und Fair-Use-Regelung
        </h2>
        <p>
          (1) Je nach gewähltem Abonnement stehen dem Nutzer pro
          Abrechnungszeitraum bestimmte Nutzungskontingente (z.&nbsp;B.
          Anzahl an KI-Nachrichten, Bildanalysen) zur Verfügung.
        </p>
        <p>
          (2) Sind diese Kontingente ausgeschöpft, können die entsprechenden
          Funktionen erst im nächsten Abrechnungszeitraum wieder vollumfänglich
          genutzt werden, sofern kein Upgrade erfolgt.
        </p>
        <p>
          (3) MedScoutX behält sich vor, bei außergewöhnlich hoher oder
          missbräuchlicher Nutzung die Funktionen im Rahmen einer
          Fair-Use-Regelung vorübergehend zu begrenzen, um die Stabilität des
          Dienstes für alle Nutzer sicherzustellen.
        </p>
      </section>

      {/* §7 Widerrufsrecht */}
      <section className="agb__section" aria-labelledby="agb-7-widerruf">
        <h2 id="agb-7-widerruf">§7 Widerrufsrecht</h2>
        <p>
          (1) Soweit der Nutzer ein kostenpflichtiges Abonnement als
          Verbraucher abschließt, steht ihm grundsätzlich ein gesetzliches
          Widerrufsrecht zu.
        </p>
        <p>
          (2) Da der Vertrag über das Abonnement mit dem jeweiligen
          Store-Betreiber zustande kommt, richtet sich die Ausübung des
          Widerrufsrechts ausschließlich nach den Bedingungen des Apple App
          Store bzw. Google Play Store.
        </p>
        <p>
          (3) Widerrufe sind daher gegenüber dem jeweiligen Store-Betreiber zu
          erklären. Ein Widerruf direkt gegenüber MedScoutX ist nicht möglich.
        </p>
      </section>

      {/* §8 Nutzungsrechte an der App */}
      <section
        className="agb__section"
        aria-labelledby="agb-8-nutzungsrechte"
      >
        <h2 id="agb-8-nutzungsrechte">
          §8 Nutzungsrechte an der App
        </h2>
        <p>
          (1) Sämtliche Inhalte der App, insbesondere Software, Designs, Texte,
          Grafiken und Datenbanken, sind urheberrechtlich geschützt und stehen
          im Eigentum des Anbieters oder seiner Lizenzgeber.
        </p>
        <p>
          (2) Der Nutzer erhält ein einfaches, nicht übertragbares und nicht
          unterlizenzierbares Recht, die App auf seinen eigenen Endgeräten für
          private Zwecke zu nutzen.
        </p>
        <p>
          (3) Es ist dem Nutzer untersagt, die App oder Teile davon über den
          bestimmungsgemäßen Gebrauch hinaus zu vervielfältigen, zu
          verbreiten, öffentlich zugänglich zu machen, zu dekompilieren oder zu
          verändern, soweit dies nicht gesetzlich ausdrücklich erlaubt ist.
        </p>
      </section>

      {/* §9 Nutzereingaben und KI-Ausgaben */}
      <section
        className="agb__section"
        aria-labelledby="agb-9-nutzereingaben"
      >
        <h2 id="agb-9-nutzereingaben">
          §9 Nutzereingaben und KI-Ausgaben
        </h2>
        <p>
          (1) Der Nutzer bleibt Inhaber etwaiger Rechte an seinen Eingaben
          (z.&nbsp;B. Texte, Bilder), soweit diese urheberrechtlich
          schutzfähig sind.
        </p>
        <p>
          (2) Der Nutzer räumt dem Anbieter ein einfaches, räumlich
          unbeschränktes Nutzungsrecht ein, seine Eingaben zur Erbringung der
          vertraglichen Leistungen, zur Verarbeitung durch KI-Dienste sowie in
          anonymisierter oder aggregierter Form zur Verbesserung und Analyse
          des Dienstes zu verwenden.
        </p>
        <p>
          (3) Die von der KI erzeugten Ausgaben dienen ausschließlich der
          ersten Orientierung. Sie können fehlerhaft, unvollständig oder
          sachlich unzutreffend sein und sind nicht als medizinische Diagnose
          oder verbindliche Empfehlung zu verstehen.
        </p>
      </section>

      {/* §10 Haftung */}
      <section className="agb__section" aria-labelledby="agb-10-haftung">
        <h2 id="agb-10-haftung">§10 Haftung</h2>
        <p>
          (1) Der Anbieter haftet unbeschränkt für Schäden aus der Verletzung
          des Lebens, des Körpers oder der Gesundheit, die auf einer
          vorsätzlichen oder fahrlässigen Pflichtverletzung des Anbieters, eines
          gesetzlichen Vertreters oder Erfüllungsgehilfen beruhen, sowie nach
          den Vorschriften des Produkthaftungsgesetzes.
        </p>
        <p>
          (2) Für sonstige Schäden haftet der Anbieter bei Vorsatz und grober
          Fahrlässigkeit unbeschränkt.
        </p>
        <p>
          (3) Bei einfacher Fahrlässigkeit haftet der Anbieter nur bei der
          Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht).
          In diesem Fall ist die Haftung der Höhe nach auf den typischerweise
          vorhersehbaren Schaden begrenzt.
        </p>
        <p>
          (4) Eine weitergehende Haftung des Anbieters ist ausgeschlossen.
          Dies gilt auch für indirekte Schäden, entgangenen Gewinn oder
          Datenverluste, soweit gesetzlich zulässig.
        </p>
        <p>
          (5) Die Nutzung der App als Grundlage für medizinische Diagnosen oder
          Therapien erfolgt auf eigenes Risiko des Nutzers und ist nicht
          Vertragszweck.
        </p>
      </section>

      {/* §11 Laufzeit, Sperrung und Kündigung */}
      <section className="agb__section" aria-labelledby="agb-11-laufzeit">
        <h2 id="agb-11-laufzeit">
          §11 Laufzeit, Sperrung und Kündigung
        </h2>
        <p>
          (1) Der Nutzungsvertrag wird auf unbestimmte Zeit geschlossen.
        </p>
        <p>
          (2) Der Nutzer kann sein Konto jederzeit in der App löschen oder die
          Nutzung einstellen.
        </p>
        <p>
          (3) Der Anbieter ist berechtigt, den Zugang des Nutzers ganz oder
          teilweise zu sperren oder den Vertrag außerordentlich zu kündigen,
          wenn der Nutzer in erheblicher Weise gegen diese AGB verstößt, die
          App missbräuchlich nutzt oder Sicherheitsmechanismen umgeht.
        </p>
        <p>
          (4) Die Löschung des App-Kontos beendet ein über den App Store oder
          Play Store abgeschlossenes Abonnement <strong>nicht</strong>.
          Abonnements sind gesondert über den jeweiligen Store zu kündigen.
        </p>
      </section>

      {/* §12 Datenschutz */}
      <section
        className="agb__section"
        aria-labelledby="agb-12-datenschutz"
      >
        <h2 id="agb-12-datenschutz">§12 Datenschutz</h2>
        <p>
          Informationen zur Verarbeitung personenbezogener Daten, insbesondere
          zu Gesundheitsdaten im Sinne von Art.&nbsp;9 DSGVO, ergeben sich aus
          der{" "}
          <a href="/datenschutz">
            Datenschutzerklärung von MedScoutX
          </a>
          . Die App ist aufgrund der Sensibilität der Daten ausschließlich für
          volljährige Nutzer (18+) bestimmt.
        </p>
      </section>

      {/* §13 Änderungen der AGB */}
      <section
        className="agb__section"
        aria-labelledby="agb-13-aenderungen"
      >
        <h2 id="agb-13-aenderungen">§13 Änderungen der AGB</h2>
        <p>
          Der Anbieter kann diese AGB ändern, sofern dies aufgrund gesetzlicher
          Anforderungen oder technischer bzw. funktionaler Anpassungen der App
          erforderlich ist und die Änderungen für den Nutzer zumutbar sind.
        </p>
        <p>
          Über wesentliche Änderungen wird der Nutzer in geeigneter Form
          informiert. Widerspricht der Nutzer nicht innerhalb einer angemessenen
          Frist oder nutzt die App weiter, gelten die geänderten AGB als
          akzeptiert, sofern hierauf ausdrücklich hingewiesen wurde.
        </p>
      </section>

      {/* §14 Anwendbares Recht und Streitbeilegung */}
      <section className="agb__section" aria-labelledby="agb-14-recht">
        <h2 id="agb-14-recht">
          §14 Anwendbares Recht und Streitbeilegung
        </h2>
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland. Zwingende
          Verbraucherschutzvorschriften des Staates, in dem der Nutzer seinen
          gewöhnlichen Aufenthalt hat, bleiben unberührt.
        </p>
        <p>
          Die EU-Plattform zur Online-Streitbeilegung ist unter{" "}
          <a
            href="https://ec.europa.eu/consumers/odr"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://ec.europa.eu/consumers/odr
          </a>{" "}
          erreichbar. Der Anbieter ist weder verpflichtet noch bereit, an einem
          Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
          teilzunehmen.
        </p>
      </section>

      {/* §15 Kontakt */}
      <section className="agb__section" aria-labelledby="agb-15-kontakt">
        <h2 id="agb-15-kontakt">§15 Kontakt</h2>
        <p>
          Allgemeine Anfragen:{" "}
          <a href="mailto:contact@medscout.app">contact@medscout.app</a>
        </p>
        <p>
          Technischer Support:{" "}
          <a href="mailto:support@medscout.app">support@medscout.app</a>
        </p>
        <p>
          Abrechnung &amp; Rechnungen:{" "}
          <a href="mailto:billing@medscout.app">billing@medscout.app</a>
        </p>
      </section>

      {showBackButton && (
  <div className="agb__actions">
    <button
      type="button"
      className="btn-agb-back"
      onClick={() => navigate(-1)}
      aria-label="Zurück zur Registrierung"
    >
      Zurück zur Registrierung
    </button>
  </div>
)}
    </main>
  );
}
