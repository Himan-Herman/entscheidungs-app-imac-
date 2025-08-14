import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/KoerperSymptomChat.css";
import { useNavigate } from "react-router-dom";


const LS_CHAT_KEY = "koerperChatVerlauf";

export default function KoerperSymptomChat() {
  const [eingabe, setEingabe] = useState("");
  const [verlauf, setVerlauf] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_CHAT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("Fehler beim Lesen von LocalStorage:", e);
      return [];
    }
  });

  const [searchParams, setSearchParams] = useSearchParams();

  const organ = searchParams.get("organ");

  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const lastIntroOrganRef = useRef(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!organ) return;
  
    // Falls für dieses Organ bereits eine Intro im Verlauf existiert, nichts tun
    const introExistiert = verlauf.some(
      (m) =>
        m.role === "assistant" &&
        m.content.includes(`"${organ}" als betroffene Region`)
    );
  
    if (introExistiert) {
      lastIntroOrganRef.current = organ; // merken
      return;
    }
  
    // Wenn die letzte Intro nicht zu diesem Organ gehört -> neue Intro anhängen
    if (lastIntroOrganRef.current !== organ) {
      const neueStartFrage = {
        role: "assistant",
        content: `Du hast "${organ}" als betroffene Region gewählt. Kannst du bitte beschreiben, was genau du dort spürst?`,
      };
      setVerlauf((prev) => {
        const neu = [...prev, neueStartFrage];
        try {
          localStorage.setItem(LS_CHAT_KEY, JSON.stringify(neu));
        } catch (e) {
          console.warn("Fehler beim Schreiben in LocalStorage:", e);
        }
        return neu;
      });
      lastIntroOrganRef.current = organ; // merken, damit nicht erneut angehängt wird
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organ]);
  

  // Verlauf immer speichern
  useEffect(() => {
    try {
      localStorage.setItem(LS_CHAT_KEY, JSON.stringify(verlauf));
    } catch (e) {
      console.warn("Fehler beim Speichern in LocalStorage:", e);
    }
  }, [verlauf]);

  // Auto-Scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [verlauf]);

  // Nachricht senden
  const frageSenden = async () => {
    if (!eingabe.trim()) return;

    const neueFrage = { role: "user", content: eingabe };
    const basisVerlauf = [...verlauf, neueFrage];

    const mitUhr = [...basisVerlauf, { role: "assistant", content: "🕒" }];
    setVerlauf(mitUhr);
    setEingabe("");

    try {
      const response = await fetch("/api/koerpersymptom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verlauf: basisVerlauf, organ }),
      });

      const data = await response.json();
      const fertig = [
        ...basisVerlauf,
        { role: "assistant", content: data.antwort },
      ];
      setVerlauf(fertig);
    } catch (error) {
      console.error("Fehler bei der KI-Antwort:", error);
      const mitFehler = [
        ...basisVerlauf,
        { role: "assistant", content: "⚠️ Fehler bei der Antwort." },
      ];
      setVerlauf(mitFehler);
    }
  };

  const neustart = () => {
    // Chat & Storage leeren
    setVerlauf([]);
    setEingabe("");
    try { localStorage.removeItem(LS_CHAT_KEY); } catch (e) { console.warn(e); }
    setSearchParams({});                 // organ aus der URL entfernen
    if (lastIntroOrganRef?.current !== undefined) lastIntroOrganRef.current = null;
  
    // 🔧 History so umbauen, dass "Zurück" direkt zur Körperkarte führt:
    // 1) Aktuellen History-Eintrag durch die Körperkarte ersetzen
    navigate("/koerperregionen", { replace: true });  // <— Pfad ggf. anpassen
  
    // 2) Sofort wieder die Chat-Seite ohne organ pushen (damit man im Chat bleibt)
    navigate("/koerpersymptom", { replace: false });   // <— Pfad ggf. anpassen
  
    // Fokus
    inputRef.current?.focus();
  };
  
  

  return (
    <div className="symptomchat-container">
      <div className="chat-header">
        <h2>Körpersymptom beschreiben</h2>
        <button
          className="reset-btn"
          onClick={neustart}
          title="Chat löschen und neu starten"
        >
          🔄 Neustart
        </button>
      </div>

      <div
        className="chatverlauf"
        ref={chatRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {verlauf.map((nachricht, index) => (
          <div
            key={index}
            className={`chat-bubble ${
              nachricht.role === "user" ? "user" : "assistant"
            }`}
          >
            <strong>
              {nachricht.role === "user" ? "👤 Du:" : "🩺 Medo:"}
            </strong>
            <p>{nachricht.content}</p>
          </div>
        ))}
      </div>

      <div className="eingabe-bereich">
        <input
          ref={inputRef}
          type="text"
          placeholder="Beschreibe dein Symptom hier..."
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              frageSenden();
            }
          }}
        />
        <button onClick={frageSenden}>Frage senden</button>
      </div>
    </div>
  );
}
