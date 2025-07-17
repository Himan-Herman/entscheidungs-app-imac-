// src/pages/Intro.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Intro.css";
import logo from "../assets/img/medscout-logo.png";

export default function Intro() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/startseite"); // Ändere das ggf. auf deine Ziel-Route
    }, 3000); // 3 Sekunden

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="intro-container">
      <img src={logo} alt="MedScout Logo" className="intro-logo" />
    </div>
  );
}
