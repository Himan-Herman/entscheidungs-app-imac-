import React, { useEffect } from  "react";
import { useNavigate } from "react-router-dom";
import "../styles/disclaimer.css";

export default function Disclaimer() {
  const navigate = useNavigate();
  useEffect(() => {
    document.body.className = "bg-disclaimer";   // Hintergrund aktiv
    return () => {
      document.body.className = "";              // Seite verlassen → reset
    };
  }, []);

  return (
    <main
      className="disclaimer"
      role="main"
      aria-labelledby="disclaimer-title"
    >
      <header className="disclaimer__header">
        <h1 id="disclaimer-title">Rechtlicher Hinweis / Disclaimer</h1>
        <p className="disclaimer__subtitle">
          Letzte Aktualisierung: 29.11.2025
        </p>
      </header>

      {/* 1. Zweck der Anwendung */}
      <section
        className="disclaimer__section"
        aria-labelledby="disc-1-zweck"
      >
        <h2 id="disc-1-zweck">1. Zweck der Anwendung</h2>
        <p>
          Die Anwendung <strong>MedScoutX</strong> ist ein
          KI-gestütztes Informations- und Orientierungssystem im
          Gesundheitsbereich. Die App dient ausschließlich dazu,
          Nutzern eine erste strukturierte Einschätzung möglicher
          Ursachen ihrer Beschwerden sowie potenziell geeigneter
          medizinischer Fachrichtungen bereitzustellen.
        </p>
        <p>
          MedScoutX ist <strong>kein Medizinprodukt</strong> im Sinne
          der EU-Medizinprodukteverordnung (MDR) und verfolgt nicht
          den Zweck, Diagnosen zu stellen, Behandlungen zu empfehlen
          oder ärztliche Entscheidungen zu ersetzen.
        </p>
      </section>

      {/* 2. Keine medizinische Diagnose */}
      <section
        className="disclaimer__section"
        aria-labelledby="disc-2-keinediagnose"
      >
        <h2 id="disc-2-keinediagnose">
          2. Keine medizinische Diagnose oder Behandlung
        </h2>
        <p>
          Die von MedScoutX bereitgestellten Ergebnisse und Hinweise
          basieren auf algorithmischen Berechnungen und statistischen
          Modellen. Sie stellen <strong>keine Diagnose</strong> dar
          und ersetzen in keinem Fall die persönliche Untersuchung,
          Beratung oder Behandlung durch qualifiziertes medizinisches
          Fachpersonal.
        </p>
        <p>
          Entscheidungen über Diagnostik, Behandlung oder Medikation
          dürfen nicht auf Grundlage der KI-Ausgaben allein getroffen
          werden.
        </p>
      </section>

      {/* 3. Keine Notfallversorgung */}
      <section
        className="disclaimer__section"
        aria-labelledby="disc-3-notfall"
      >
        <h2 id="disc-3-notfall">3. Keine Notfallversorgung</h2>
        <p>
          MedScoutX ist nicht für den Einsatz in Notfallsituationen
          geeignet. Bei akuten oder lebensbedrohlichen Beschwerden
          wende dich unverzüglich an den medizinischen
          Notfalldienst oder wähle direkt die jeweilige
          Notrufnummer (z. B. in der EU: <strong>112</strong>, in den
          USA: <strong>911</strong>).
        </p>
      </section>

      {/* 4. Grenzen der KI */}
      <section
        className="disclaimer__section"
        aria-labelledby="disc-4-grenzen"
      >
        <h2 id="disc-4-grenzen">4. Grenzen der KI-Verarbeitung</h2>
        <p>
          Die KI-Modelle können inhaltliche Fehler aufweisen, unvoll-
          ständige Informationen liefern oder Symptome falsch
          einordnen. Die Genauigkeit der Ergebnisse hängt von der
          Qualität der Nutzereingaben ab (z. B. Beschreibung,
          gewählte Körperregion, Qualität der Bild-Uploads).
        </p>
        <p>
          Eingereichte Informationen werden automatisiert
          verarbeitet. Eine vollständige medizinische Bewertung der
          Gesamtsituation findet nicht statt.
        </p>
      </section>

      {/* 5. Kein Arzt-Patienten-Verhältnis */}
      <section
        className="disclaimer__section"
        aria-labelledby="disc-5-keinverhaeltnis"
      >
        <h2 id="disc-5-keinverhaeltnis">
          5. Kein Arzt-Patienten-Verhältnis
        </h2>
        <p>
          Durch die Nutzung von MedScoutX entsteht ausdrücklich
          <strong>kein</strong> Arzt-Patienten-Verhältnis. Die
          KI-Ausgaben stellen keine ärztliche Beratung dar.
        </p>
      </section>

      {/* 6. Haftungsbeschränkung */}
      <section
        className="disclaimer__section"
        aria-labelledby="disc-6-haftung"
      >
        <h2 id="disc-6-haftung">6. Haftungsbeschränkung</h2>
        <p>
          Für Schäden, die aus der Nutzung oder Unmöglichkeit der
          Nutzung der App entstehen, haftet der Anbieter nur bei
          Vorsatz oder grober Fahrlässigkeit. Eine Haftung für
          mittelbare Schäden, Folgeschäden oder entgangenen Gewinn
          ist ausgeschlossen, sofern keine zwingenden gesetzlichen
          Bestimmungen entgegenstehen.
        </p>
      </section>

      {/* 7. Internationale Nutzung & Altersfreigabe */}
      <section
        className="disclaimer__section"
        aria-labelledby="disc-7-alter"
      >
        <h2 id="disc-7-alter">
          7. Internationale Nutzung und Altersfreigabe
        </h2>
        <p>
          MedScoutX richtet sich weltweit ausschließlich an Personen
          ab <strong>16 Jahren</strong>. In einzelnen Ländern gelten
          strengere Vorgaben; beispielsweise sollten Nutzer in den
          USA die Anwendung erst ab <strong>18 Jahren</strong> und nur
          mit Zustimmung ihrer Erziehungsberechtigten verwenden.
        </p>
        <p>
          Minderjährige unter 18 Jahren sollten MedScoutX nur mit
          Zustimmung der Erziehungsberechtigten nutzen.
        </p>
      </section>

      {/* 8. Automatisierte Entscheidung */}
      <section
        className="disclaimer__section"
        aria-labelledby="disc-8-automatisch"
      >
        <h2 id="disc-8-automatisch">
          8. Keine automatisierte Entscheidungsfindung
        </h2>
        <p>
          MedScoutX trifft keine Entscheidungen im Sinne von Art.&nbsp;22
          DSGVO, die rechtliche oder erhebliche Auswirkungen auf den
          Nutzer haben. Alle KI-Ausgaben dienen ausschließlich der
          orientierenden Einschätzung.
        </p>
      </section>

      {/* 9. Änderungen */}
      <section
        className="disclaimer__section"
        aria-labelledby="disc-9-aenderungen"
      >
        <h2 id="disc-9-aenderungen">9. Änderungen dieses Disclaimers</h2>
        <p>
          Der Anbieter behält sich vor, diesen Disclaimer anzupassen,
          sofern gesetzliche, technische oder funktionale Änderungen
          an der App dies erfordern. Die jeweils aktuelle Version ist
          jederzeit in der App verfügbar.
        </p>
      </section>

      {/* Button */}
      <div className="disclaimer__actions">
      <button
            className="btn"
            type="button"
            onClick={() => navigate("/register")}
            aria-label="Zurück zur Registrierungsseite"
          >
            Zurück zur Registrierung
          </button>
      </div>
    </main>
  );
}
