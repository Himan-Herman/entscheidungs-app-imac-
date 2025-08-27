import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/img/medscout-logo.png";
import "../styles/Intro.css";

export default function Intro() {
  const navigate = useNavigate();
  const [verschwinden, setVerschwinden] = useState(false);

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem("introShown");

    if (alreadyShown) {
      navigate("/startseite");
    } else {
      sessionStorage.setItem("introShown", "true");

      
      const fadeOutTimer = setTimeout(() => {
        setVerschwinden(true);
      }, 4000);

      
      const navigateTimer = setTimeout(() => {
        navigate("/startseite");
      }, 5000);

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
