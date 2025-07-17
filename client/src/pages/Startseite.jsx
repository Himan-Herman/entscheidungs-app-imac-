// src/pages/Startseite.jsx
import React from "react";
import "../styles/Startseite.css";
import { useNavigate } from "react-router-dom";

export default function Startseite() {
  const navigate = useNavigate();

  return (
    <div className="startseite-container">
      <h1>Willkommen bei MedScout</h1>

      <div className="startseite-grid">
        {/* 1 – Bild-Upload + Bild-Chat */}
        
<div className="bereich bild-chat" onClick={() => navigate("/bild")} style={{ cursor: "pointer" }}>
  <h2>Bild hochladen</h2>
  <p>Hier kannst du z.B. ein Hautbild hochladen und analysieren lassen.</p>
</div>


        {/* 2 – Symptomeingabe + KI-Chat */}
        <div
  className="bereich symptom-chat"
  onClick={() => navigate("/symptom")}
  style={{ cursor: "pointer" }}
>
  <h2>Symptom beschreiben</h2>
  <p>Klicke hier, um dein Symptom einzugeben und von der KI analysieren zu lassen.</p>
</div>


        {/* 3 – Körperregionen-Auswahl */}
        <div
  className="bereich koerperregionen"
  onClick={() => navigate("/region-start")}
  style={{ cursor: "pointer" }}
>
  <h2>Körperregion wählen</h2>
  <p>Klicke hier, um die Region auszuwählen und passende Fragen zu erhalten.</p>
</div>

      </div>
    </div>
  );
}
