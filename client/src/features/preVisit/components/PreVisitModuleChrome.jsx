import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import "../styles/PreVisitModuleChrome.css";

const copy = {
  de: {
    backHome: "Zurück zur MedScoutX-Startseite",
    moduleLabel: "Arztgespräch vorbereiten",
    safety:
      "Dieses Modul dient nur der Vorbereitung und Dokumentation Ihrer Angaben. Es ersetzt keine ärztliche Beratung.",
    navAria: "Pre-Visit-Navigation",
  },
  en: {
    backHome: "Back to MedScoutX home",
    moduleLabel: "Prepare doctor visit",
    safety:
      "This module is only for preparing and documenting your information. It does not replace medical advice.",
    navAria: "Pre-Visit navigation",
  },
};

export default function PreVisitModuleChrome() {
  const { language } = useLanguage();
  const t = copy[language] ?? copy.de;

  return (
    <div className="pre-visit-chrome">
      <nav className="pre-visit-chrome__nav" aria-label={t.navAria}>
        <Link className="pre-visit-chrome__back" to="/">
          {t.backHome}
        </Link>
        <span className="pre-visit-chrome__module">{t.moduleLabel}</span>
      </nav>
      <p className="pre-visit-chrome__safety" role="note">
        {t.safety}
      </p>
    </div>
  );
}
