import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/img/medscout-logo.png";
import "../styles/Intro.css";

export default function Intro() {
  const navigate = useNavigate();
  const [verschwinden, setVerschwinden] = useState(false);

  useEffect(() => {
    // NEU: nur registrierte Nutzer dürfen Intro sehen
   const hasUser = !!localStorage.getItem("medscout_user_id");
   if (!hasUser) {
     navigate("/startseite", { replace: true });
     return;
   }

   const alreadyShown = sessionStorage.getItem("introShown");
    if (alreadyShown) {
      navigate("/startseite");
    } else {
      sessionStorage.setItem("introShown", "true");

      
      const fadeOutTimer = setTimeout(() => setVerschwinden(true), 4000);
     const navigateTimer = setTimeout(() => navigate("/startseite", { replace: true }), 5000);

      return () => {
        clearTimeout(fadeOutTimer);
        clearTimeout(navigateTimer);
      };
    }
  }, [navigate]);

  return (
    <div className="intro-container">
      <img
        src={logo}
        alt="MedScout Logo"
        className={`intro-logo ${verschwinden ? "fade-out" : ""}`}
      />
    </div>
  );
}
