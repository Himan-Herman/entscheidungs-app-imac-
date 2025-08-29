import React, { useEffect, useRef, useState } from "react";
import "../styles/Startseite.css";
import { useNavigate } from "react-router-dom";

export default function Startseite() {
  const navigate = useNavigate();

  
  const cards = [
    {
      key: "bild",
      title: "Bild-Analyse",
      lines: [
        "Foto hochladen – MedScout beschreibt das Sichtbare und fragt nach Details.",
        "So bekommst du eine passende Facharzt-Empfehlung.",
      ],
      to: "/bild",
      className: "bereich bild-chat",
    },
    {
      key: "symptom",
      title: "Symptom-Check",
      lines: [
        "Beschreibe deine Beschwerden in eigenen Worten – MedScout fragt nach.",
        "Dann fasst er zusammen und empfiehlt die passende Fachrichtung.",
      ],
      to: "/symptom",
      className: "bereich symptom-chat",
    },
    {
      key: "map",
      title: "Body-Map",
      lines: [
        "Region wählen – MedScout fragt gezielt nach.",
        "Am Ende führt er dich zur passenden Empfehlung.",
      ],
      to: "/region-start",
      className: "bereich koerperregionen",
    },
  ];

  
  const [active, setActive] = useState(0);
  const timerRef = useRef(null);
  const stoppedRef = useRef(false);

  
  useEffect(() => {
    stoppedRef.current = false;
    timerRef.current = setInterval(() => {
      if (!stoppedRef.current) {
        setActive((i) => (i + 1) % cards.length);
      }
    }, 4000);
    return () => clearInterval(timerRef.current);
    
  }, []); 

  const handleChoose = (path) => {
    stoppedRef.current = true;
    clearInterval(timerRef.current);
    navigate(path);
  };

  return (
    <div className="startseite-container">
      <h1>Willkommen bei MedScout</h1>

      <div className="startseite-grid" role="list" aria-label="MedScout Bereiche">
        {cards.map((c, idx) => (
          <button
            key={c.key}
            role="listitem"
            className={`${c.className} ${idx === active ? "is-active" : ""}`}
            onClick={() => handleChoose(c.to)}
            aria-pressed={idx === active}
          >
            <h2>{c.title}</h2>
            {c.lines.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </button>
        ))}
      </div>
    </div>
  );
}
