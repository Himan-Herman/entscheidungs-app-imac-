
import { useEffect, useRef, useState } from "react";
import "../styles/SymptomThread.css";
import { useSearchParams } from "react-router-dom";
import { getOrganPrompt } from "./prompt/organPrompts";

const THREAD_API = "/api/koerpersymptomthread";
const LS_THREAD_KEY = "koerperThreadId";
const LS_CHAT_KEY   = "koerperThreadVerlauf";

const safeSetLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { console.warn("[LS set] failed:", k, e); } };
const safeRemoveLS = (k) => { try { localStorage.removeItem(k); } catch (e) { console.warn("[LS remove] failed:", k, e); } };

export default function KoerperSymptomThread() {
  const [searchParams] = useSearchParams();
  const organ = searchParams.get("organ");

  const [eingabe, setEingabe] = useState("");
  const [verlauf, setVerlauf] = useState(() => {
    const raw = localStorage.getItem(LS_CHAT_KEY);
    try { return raw ? JSON.parse(raw) : []; }
    catch (e) { console.warn("[JSON parse] invalid chat, clearing:", e); safeRemoveLS(LS_CHAT_KEY); return []; }
  });
  const [threadId, setThreadId] = useState(() => localStorage.getItem(LS_THREAD_KEY) || "");
  const [laden, setLaden] = useState(false);
  const [fehlermeldung, setFehlermeldung] = useState("");
  const chatEndeRef = useRef(null);

  useEffect(() => {
    if (verlauf.length === 0) {
      const startText = organ
        ? getOrganPrompt(organ)
        : "👋 Ich bin Medo. Beschreibe bitte kurz dein Körpersymptom. Ich stelle dir dann gezielte Rückfragen.";
      const welcome = { role: "assistant", content: startText };
      setVerlauf([welcome]);
      safeSetLS(LS_CHAT_KEY, JSON.stringify([welcome]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organ]);

  useEffect(() => {
    chatEndeRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [verlauf, laden]);

  async function senden() {
    if (!eingabe.trim() || laden) return;
    setFehlermeldung("");
    setLaden(true);

    try {
      const userMsg = { role: "user", content: eingabe.trim() };
      setEingabe("");

      setVerlauf((alt) => {
        const nv = [...alt, userMsg];
        safeSetLS(LS_CHAT_KEY, JSON.stringify(nv));
        return nv;
      });

      // ✅ payload wird JEZT auch im fetch verwendet
      const payload = {
        threadId: threadId || null,
        verlauf: (!threadId && organ)
          ? [
              { role: "user", content: `Kontext: Die betroffene Körperregion ist "${organ}".` },
              userMsg
            ]
          : [userMsg]
      };

      const res = await fetch(THREAD_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload) // <-- hier lag der Fehler
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if (data.threadId && data.threadId !== threadId) {
        setThreadId(data.threadId);
        safeSetLS(LS_THREAD_KEY, data.threadId);
      }

      const assistantMsg = { role: "assistant", content: data.antwort || "…" };
      setVerlauf((alt) => {
        const nv = [...alt, assistantMsg];
        safeSetLS(LS_CHAT_KEY, JSON.stringify(nv));
        return nv;
      });

    } catch (e) {
      console.error(e);
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
    safeRemoveLS(LS_THREAD_KEY);
    safeRemoveLS(LS_CHAT_KEY);
    setThreadId("");
    setVerlauf([]);
    setFehlermeldung("");
  }

  return (
    <div className="wrap">
      <h1 className="title">Körpersymptom beschreiben</h1>

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
          placeholder="Beschreibe dein Körpersymptom…"
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
