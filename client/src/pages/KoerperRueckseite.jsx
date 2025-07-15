// src/pages/KoerperRueckseite.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import rueckenBild from "../assets/img/Koerper_Rueckseite.png";

export default function KoerperRueckseite() {
  const navigate = useNavigate();

  return (
    <div>
      <h2 style={{ textAlign: "center" }}>Körperkarte – Rückseite</h2>

      <svg
        viewBox="0 0 300 700"
        width="100%"
        height="700"
        style={{ backgroundColor: "lightgray" }}
        preserveAspectRatio="xMidYMid meet"
      >
        <image
          href={rueckenBild}
          x="0"
          y="0"
          width="300"
          height="700"
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Wirbelsäule */}
        <rect
  x="135"
  y="120"
  width="30"
  height="250"
  fill="rgba(255, 165, 0, 0.4)"
  stroke="orange"
  strokeWidth="2"
  onClick={() => navigate("/?organ=wirbelsaeule")}
  style={{ cursor: "pointer" }}
/>
{/* Orange halbtransparent */}


  {/* Niere links */}
  <circle
    cx="115"
    cy="280"
    r="15"
    fill="rgba(255, 0, 0, 0.4)"     // Rot halbtransparent
    stroke="red"
    strokeWidth="2"
    onClick={() => navigate("/?organ=niere-links")}
    style={{ cursor: "pointer" }}
  />

  {/* Niere rechts */}
  <circle
    cx="185"
    cy="280"
    r="15"
    fill="rgba(255, 0, 0, 0.4)"
    stroke="red"
    strokeWidth="2"
    onClick={() => navigate("/?organ=niere-rechts")}
    style={{ cursor: "pointer" }}
  />

  {/* Beckenbereich */}
  <rect
    x="120"
    y="380"
    width="60"
    height="50"
    fill="rgba(0, 128, 255, 0.3)"  // Blau halbtransparent
    stroke="blue"
    strokeWidth="2"
    onClick={() => navigate("/?organ=becken")}
    style={{ cursor: "pointer" }}
  />
</svg>
    </div>
  );
}
