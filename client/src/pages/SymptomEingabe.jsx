// src/pages/SymptomEingabe.jsx
import React, { useEffect, useRef, useState } from "react";
import "../styles/SymptomEingabe.css";

const ENDPOINT = "/api/textsymptom";
const LS_CHAT_KEY = "symptomEingabeVerlauf";

const __DEV__ = import.meta.env.MODE !== "production";
const safeSetLS = (k, v) => {
  try { localStorage.setItem(k, v); }
  catch (e) { if (__DEV__) console.warn("[LS set] failed:", k, e); }
};
const safeGetLS = (k) => {
  try { return localStorage.getItem(k); }
  catch (e) { if (__DEV__) console.warn("[LS get] failed:", k, e); return null; }
};
const safeRemoveLS = (k) => {
  try { localStorage.removeItem(k); }
  catch (e) { if (__DEV__) console.warn("[LS remove] failed:", k, e); }
};

export default function SymptomEingabe() {
  const [symptom, setSymptom] = useState("");
  const [ladezustand, setLadezustand] = useState(false);
  const [verlauf, setVerlauf] = useState(() => {
    const raw = safeGetLS(LS_CHAT_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); }
    catch (e) {
      if (__DEV__) console.warn("[JSON parse] invalid Verlauf, clearing:", e);
      safeRemoveLS(LS_CHAT_KEY);
      return [];
    }
  });

  const chatEndRef = useRef(null);

  // Auto-Scroll immer ans Ende
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [verlauf, ladezustand]);

  // Persistiere Verlauf bei Änderungen (Backup zu den Sofort-Saves unten)
  useEffect(() => {
    safeSetLS(LS_CHAT_KEY, JSON.stringify(verlauf));
  }, [verlauf]);

  const handleSenden = async () => {
    const text = symptom.trim();
    if (!text) {
      alert("Bitte gib ein Symptom ein.");
      return;
    }

    setLadezustand(true);

    // 1) Nutzerfrage sofort anzeigen & speichern
    setVerlauf((prev) => {
      const nv = [...prev, { frage: text, antwort: "…" }]; // Platzhalter bis Antwort da ist
      safeSetLS(LS_CHAT_KEY, JSON.stringify(nv));
      return nv;
    });
    setSymptom("");

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });

      const data = await response.json();

      // 2) Letzten Eintrag (Platzhalter) durch echte Antwort ersetzen
      setVerlauf((prev) => {
        const nv = [...prev];
        const idx = nv.findLastIndex((e) => e.frage === text);
        if (idx !== -1) nv[idx] = { frage: text, antwort: data.antwort || "…" };
        else nv.push({ frage: text, antwort: data.antwort || "…" });
        safeSetLS(LS_CHAT_KEY, JSON.stringify(nv));
        return nv;
      });
    } catch (error) {
      console.error("Fehler bei der Symptomanalyse:", error);
      setVerlauf((prev) => {
        const nv = [...prev];
        const idx = nv.findLastIndex((e) => e.frage === text);
        const fehlerAntwort = "❌ Fehler bei der Analyse. Bitte erneut versuchen.";
        if (idx !== -1) nv[idx] = { frage: text, antwort: fehlerAntwort };
        else nv.push({ frage: text, antwort: fehlerAntwort });
        safeSetLS(LS_CHAT_KEY, JSON.stringify(nv));
        return nv;
      });
    } finally {
      setLadezustand(false);
    }
  };

  const beiEnter = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSenden();
    }
  };

  const resetVerlauf = () => {
    safeRemoveLS(LS_CHAT_KEY);
    setVerlauf([]);
    setSymptom("");
  };

  return (
    <div className="symptom-container">
      <h2>Symptom beschreiben</h2>

      <textarea
        placeholder="Beschreibe dein Symptom so genau wie möglich..."
        value={symptom}
        onChange={(e) => setSymptom(e.target.value)}
        onKeyDown={beiEnter}
      ></textarea>

      <div className="btn-row">
        <button onClick={handleSenden} disabled={ladezustand || !symptom.trim()}>
          {ladezustand ? "Analyse läuft…" : "Analyse starten"}
        </button>
        <button className="btn-reset" onClick={resetVerlauf} disabled={ladezustand}>
          Verlauf löschen
        </button>
      </div>

      {ladezustand && <p>⏳ Analyse läuft...</p>}

      {verlauf.map((eintrag, index) => (
        <div key={index}>
          <div className="frage-block">
            <strong>👤 Du:</strong> {eintrag.frage}
          </div>
          <div className="antwort-block">
            <strong>🩺 Medo:</strong>{" "}
            <span
              // Falls der Server HTML zurückgibt (z.B. <br/>)
              dangerouslySetInnerHTML={{ __html: eintrag.antwort }}
            />
          </div>
        </div>
      ))}

      {/* Scroll-Anker */}
      <div ref={chatEndRef} />
    </div>
  );
}
