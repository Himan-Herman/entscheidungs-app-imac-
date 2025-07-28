// src/KoerperRueckseite.jsx

import React from "react";
import { useNavigate } from "react-router-dom";
import rueckenBild from "../assets/img/Koerper_Rueckseite.png";

export default function KoerperRueckseite() {
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Körperkarte – Rückseite</h2>

      <svg
        viewBox="0 0 300 700"
        width="100%"
        height="700"
        preserveAspectRatio="xMidYMid meet"
        
      >
        {/* Hintergrundbild */}
        <image
          href={rueckenBild}
          x="0"
          y="0"
          width="300"
          height="700"
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Klickbare Regionen */}
        
       {/* 1 – Nacken (als Rechteck) */}
<rect
  x="134"
  y="76"
  width="42"
  height="30"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate("/koerpersymptom?organ=nacken")}
  style={{ cursor: "pointer" }}
/>



        {/* 2 – Schultern */}
        <circle
          cx="95"
          cy="145"
          r="20"
          fill="transparent" 
  stroke="transparent"
          strokeWidth="2"
          onClick={() => navigate("/koerpersymptom?organ=schulterblatt_links")}
          style={{ cursor: "pointer" }}
        />
        <circle
          cx="214"
          cy="145"
          r="20"
          fill="transparent" 
  stroke="transparent"
          strokeWidth="2"
          onClick={() => navigate("/koerpersymptom?organ=schulterblatt_rechts")}
          style={{ cursor: "pointer" }}
        />

        {/* 3 – Rückenmitte (Wirbelsäule) als vertikales Rechteck */}
<rect
  x="147"
  y="107"
  width="16"
  height="172"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate("/koerpersymptom?organ=wirbelsaeule")}
  style={{ cursor: "pointer" }}
/>
        

     {/* 4 – Nierenbereich (als Ellipse) */}
<ellipse
  cx="136"
  cy="236"
  rx="9"
  ry="14"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate("/koerpersymptom?organ=niere_links")}
  style={{ cursor: "pointer" }}
/>
<ellipse
  cx="172"
  cy="237"
  rx="8"
  ry="14"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate("/koerpersymptom?organ=niere_rechts")}
  style={{ cursor: "pointer" }}
/>
       

        {/* 5 – Lende/unterer Rücken */}
        <ellipse
  cx="125"
  cy="315"
  rx="24"
  ry="40"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate("/koerpersymptom?organ=becken_rechts")}
  style={{ cursor: "pointer" }}
/>
<ellipse
  cx="180"
  cy="315"
  rx="24"
  ry="40"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate("/koerpersymptom?organ=becken_links")}
  style={{ cursor: "pointer" }}
/>
        
        {/* 6 – Hinterkopf */}
<circle
  cx="155"
  cy="46"
  r="30"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate("/koerpersymptom?organ=hinterkopf")}
  style={{ cursor: "pointer" }}
/>
<ellipse
  cx="127"
  cy="70"
  rx="4"
  ry="10"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate("/koerpersymptom?organ=ohr_links")}
  style={{ cursor: "pointer" }}
/>

<ellipse
  cx="183"
  cy="70"
  rx="4"
  ry="10"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate("/koerpersymptom?organ=ohr_rechts")}
  style={{ cursor: "pointer" }}
/>
{/*Linkes Bein}*/}
<ellipse
  cx="115"
  cy="510"
  rx="25"
  ry="150"
  fill="transparent" 
  stroke="transparent"
  onClick={() => navigate("/koerpersymptom?organ=bein_links")}
  style={{ cursor: "pointer" }}
/>

{/*Rechtes Bein */}
<ellipse
  cx="185"
  cy="510"
  rx="25"
  ry="150"
  fill="transparent" 
  stroke="transparent"
  onClick={() => navigate("/koerpersymptom?organ=bein_rechts")}
  style={{ cursor: "pointer" }}
/>


      </svg>
    </div>
  );
}
