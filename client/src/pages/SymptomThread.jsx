import { useEffect, useRef, useState } from "react";
import "../styles/SymptomThread.css";

const THREAD_API = "/api/symptom-thread";
const LS_THREAD_KEY = "symptomThreadId";
const LS_CHAT_KEY = "symptomThreadVerlauf";

// Helper für LocalStorage (verhindert leere catch-Blöcke)
function safeSetLS(key, value) {
  try { localStorage.setItem(key, value); }
  catch (e) { console.warn(`localStorage set failed for "${key}"`, e); }
}
function safeRemoveLS(key) {
  try { localStorage.removeItem(key); }
  catch (e) { console.warn(`localStorage remove failed for "${key}"`, e); }
}
function safeGetJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn(`localStorage parse failed for "${key}"`, e);
    safeRemoveLS(key);
    return fallback;
  }
}

export default function SymptomThread() {
  // ---- State ----
  const [eingabe, setEingabe] = useState("");
  const [verlauf, setVerlauf] = useState(() => safeGetJSON(LS_CHAT_KEY, []));
  const [threadId, setThreadId] = useState(() => localStorage.getItem(LS_THREAD_KEY) || "");
  const [laden, setLaden] = useState(false);
  const [fehlermeldung, setFehlermeldung] = useState("");
  const chatEndeRef = useRef(null);

  // ---- Begrüßung beim ersten Start ----
  useEffect(() => {
    if (verlauf.length === 0) {
      const welcome = {
        role: "assistant",
        content:
          "👋 Ich bin Medo. Beschreibe bitte kurz dein Symptom. Ich stelle dir dann gezielte Rückfragen."
      };
      setVerlauf([welcome]);
      safeSetLS(LS_CHAT_KEY, JSON.stringify([welcome]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Auto-Scroll ----
  useEffect(() => {
    chatEndeRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [verlauf, laden]);

  // ---- Enter-Handling ----
  function beiEnter(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      senden();
    }
  }

  // ---- Senden ----
  async function senden() {
    if (!eingabe.trim() || laden) return;
    setFehlermeldung("");
    setLaden(true);

    try {
      const userMsg = { role: "user", content: eingabe.trim() };
      setEingabe("");

      // 1) Sofort anzeigen & speichern
      setVerlauf((alt) => {
        const nv = [...alt, userMsg];
        safeSetLS(LS_CHAT_KEY, JSON.stringify(nv));
        return nv;
      });

      // 2) Threads-Endpoint: nur neue Message + evtl. vorhandene threadId
      const res = await fetch(THREAD_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verlauf: [userMsg],
          threadId: threadId || null
        })
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const data = await res.json();

      // 3) threadId übernehmen & speichern
      if (data.threadId && data.threadId !== threadId) {
        setThreadId(data.threadId);
        safeSetLS(LS_THREAD_KEY, data.threadId);
      }

      // 4) Antwort anhängen & speichern
      const assistantMsg = { role: "assistant", content: data.antwort || "…" };
      setVerlauf((alt) => {
        const nv = [...alt, assistantMsg];
        safeSetLS(LS_CHAT_KEY, JSON.stringify(nv));
        return nv;
      });
    } catch (err) {
      console.error(err);
      setFehlermeldung("❌ Fehler bei der KI-Antwort. Bitte erneut versuchen.");
    } finally {
      setLaden(false);
    }
  }

  // ---- Neustart ----
  function resetThread() {
    safeRemoveLS(LS_THREAD_KEY);
    safeRemoveLS(LS_CHAT_KEY);
    setThreadId("");
    setVerlauf([]);
    setFehlermeldung("");
  }

  // ---- UI ----
  return (
    <div className="wrap">
      <h1 className="title">Symptom beschreiben (Thread)</h1>

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
        <div className="meta">Thread-ID: <code>{threadId}</code></div>
      ) : (
        <div className="metaMuted">Noch kein Thread erstellt</div>
      )}
    </div>
  );
}
