import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations/index.js";
import "../styles/PreVisitModuleChrome.css";

export default function PreVisitModuleChrome() {
  const { language } = useLanguage();
  const t = getMessages(language).preVisit.chrome;

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
