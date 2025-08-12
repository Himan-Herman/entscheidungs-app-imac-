import { useEffect, useRef, useState } from "react";
import "../styles/SymptomThread.css";
console.log("[SymptomThread] Datei geladen");


const THREAD_API = "/api/thread";
const LS_THREAD_KEY = "symptomThreadId";
const LS_CHAT_KEY = "symptomThreadVerlauf";

export default function SymptomThread() {
  const [eingabe, setEingabe] = useState("");
  const [verlauf, setVerlauf] = useState(() => {
    const raw = localStorage.getItem(LS_CHAT_KEY);
    // LOG: Laden
    console.log("[LOAD] raw Verlauf:", raw);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("[PARSE-ERROR] Verlauf, lösche defekten Wert:", e);
      localStorage.removeItem(LS_CHAT_KEY);
      return [];
    }
  });
  const [threadId, setThreadId] = useState(() => {
    const tid = localStorage.getItem(LS_THREAD_KEY) || "";
    // LOG: Laden
    console.log("[LOAD] threadId:", tid);
    return tid;
  });
  const [laden, setLaden] = useState(false);
  const [fehlermeldung, setFehlermeldung] = useState("");
  const chatEndeRef = useRef(null);

  useEffect(() => {
    if (verlauf.length === 0) {
      const welcome = {
        role: "assistant",
        content:
          "👋 Ich bin Medo. Beschreibe bitte kurz dein Symptom. Ich stelle dir dann gezielte Rückfragen."
      };
      setVerlauf([welcome]);
      // LOG: Initial speichern
      localStorage.setItem(LS_CHAT_KEY, JSON.stringify([welcome]));
      console.log("[SAVE] init Verlauf mit welcome");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_CHAT_KEY, JSON.stringify(verlauf));
    // LOG: Jede Änderung am Verlauf
    console.log("[SAVE] Verlauf ->", verlauf);
  }, [verlauf]);

  useEffect(() => {
    if (threadId) {
      localStorage.setItem(LS_THREAD_KEY, threadId);
      console.log("[SAVE] threadId ->", threadId);
    }
  }, [threadId]);

  useEffect(() => {
    chatEndeRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [verlauf, laden]);

  async function senden() {
    if (!eingabe.trim() || laden) return;
    setFehlermeldung("");
    setLaden(true);
  
    try {
      // Nutzer-Nachricht erzeugen + sofort im UI anzeigen
      const userMsg = { role: "user", content: eingabe.trim() };
      setVerlauf((alt) => [...alt, userMsg]);
      setEingabe("");
  
      // An Backend schicken (vorhandene threadId mitgeben)
      const res = await fetch(THREAD_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verlauf: [userMsg],          // nur die neue Nachricht senden
          threadId: threadId || null
        })
      });
  
      if (!res.ok) throw new Error(await res.text());
  
      const data = await res.json();
      const assistantMsg = { role: "assistant", content: data.antwort || "…" };
  
      // threadId aus Antwort übernehmen
      if (data.threadId) setThreadId(data.threadId);
  
      // Antwort anhängen
      setVerlauf((alt) => [...alt, assistantMsg]);
    } catch (err) {
      console.error(err);
      setFehlermeldung("❌ Fehler bei der KI-Antwort. Bitte erneut versuchen.");
    } finally {
      setLaden(false);
    }
  }
  

  function beiEnter(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      senden();
    }
  }

  function resetThread() {
    setVerlauf([]);
    setThreadId("");
    localStorage.removeItem(LS_THREAD_KEY);
    localStorage.removeItem(LS_CHAT_KEY);
  }

  return (
    <div className="wrap">
      <h1 className="title">Symptom beschreiben</h1>

      <div className="chatBox">
        {verlauf.map((m, i) => (
          <div key={i} className={`msg ${m.role === "user" ? "user" : "assistant"}`}>
            <div className="msgHeader">{m.role === "user" ? "👤 Du:" : "🕊️ Medo:"}</div>
            <div className="msgBody">{m.content}</div>
          </div>
        ))}

        {laden && (
          <div className="msg assistant">
            <div className="msgHeader">🕊️ Medo:</div>
            <div className="msgBody">… denkt nach</div>
          </div>
        )}

        <div ref={chatEndeRef} />
      </div>

      {fehlermeldung && <div className="error">{fehlermeldung}</div>}

      <div className="inputRow">
        <input
          className="input"
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          onKeyDown={beiEnter}
          placeholder="Beschreibe dein Symptom…"
          disabled={laden}
        />
        <button className="sendBtn" onClick={senden} disabled={laden || !eingabe.trim()}>
          {laden ? "Senden…" : "Senden"}
        </button>
        <button className="resetBtn" onClick={resetThread} disabled={laden}>
          Neustart
        </button>
      </div>

      {threadId ? (
        <div className="meta">
          Thread-ID: <code>{threadId}</code>
        </div>
      ) : (
        <div className="metaMuted">Noch kein Thread erstellt</div>
      )}
    </div>
  );
}
