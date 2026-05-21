import { Link } from "react-router-dom";
import { Languages } from "lucide-react";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import { isMedicalInterpreterClientEnabled } from "../config/isMedicalInterpreterEnabled.js";
import "../styles/MedicalInterpreter.css";

/**
 * B2C patient hub entry — one dedicated Medical Interpreter card (not in tile grid).
 */
export default function InterpreterCard() {
  const t = useMedicalInterpreterMessages();

  if (!isMedicalInterpreterClientEnabled()) {
    return null;
  }

  return (
    <section
      className="interpreter-hub-card interp-root"
      aria-labelledby="interpreter-hub-card-title"
    >
      <div className="interpreter-hub-card__head">
        <span className="interpreter-hub-card__icon" aria-hidden>
          <Languages size={22} strokeWidth={1.75} />
        </span>
        <h2 id="interpreter-hub-card-title" className="interpreter-hub-card__title">
          {t.hub.title}
        </h2>
      </div>
      <p className="interpreter-hub-card__subtitle">{t.hub.subtitle}</p>
      <p className="interpreter-hub-card__trust">{t.hub.trustLine}</p>
      <p className="interpreter-hub-card__privacy">{t.hub.privacyLine}</p>
      <Link
        className="interpreter-hub-card__cta"
        to="/patient/interpreter"
        aria-label={t.aria.startInterpreter}
      >
        {t.hub.cta}
      </Link>
    </section>
  );
}
