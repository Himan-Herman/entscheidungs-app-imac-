// src/pages/KoerperregionStart.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function KoerperregionStart() {
  const [zeigeOptionen, setZeigeOptionen] = useState(false);
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: "center", padding: "2rem" }}>
      <h2>Körperregion wählen</h2>
      <button
        onClick={() => setZeigeOptionen(!zeigeOptionen)}
        style={{
          padding: "1em",
          fontSize: "1em",
          marginBottom: "1rem",
          cursor: "pointer",
        }}
      >
        Auswahl öffnen
      </button>

      {zeigeOptionen && (
        <div style={{ marginTop: "15px" }}>
          <button
            onClick={() => navigate("/koerperregionen")}
            style={{ marginRight: "10px", padding: "10px 20px" }}
          >
            Körper_Vorderseite
          </button>
          <button
            onClick={() => navigate("/rueckseite")}
            style={{ padding: "10px 20px" }}
          >
            Körper_Rückseite
          </button>
        </div>
      )}
    </div>
  );
}
