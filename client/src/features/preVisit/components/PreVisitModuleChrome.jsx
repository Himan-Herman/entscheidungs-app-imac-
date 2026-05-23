import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations/index.js";
import { readUserMode, USER_MODES } from "../../../utils/userMode.js";
import "../styles/PreVisitModuleChrome.css";

function resolveChromeBack(t) {
  try {
    const loggedIn = !!localStorage.getItem("medscout_token");
    if (loggedIn && readUserMode() === USER_MODES.PATIENT) {
      return { to: "/patient", label: t.backPatientHub };
    }
  } catch {
    /* private mode */
  }
  return { to: "/startseite", label: t.backHome };
}

export default function PreVisitModuleChrome() {
  const { language } = useLanguage();
  const t = getMessages(language).preVisit.chrome;
  const back = useMemo(() => resolveChromeBack(t), [t]);

  return (
    <div className="pre-visit-chrome">
      <nav className="pre-visit-chrome__nav" aria-label={t.navAria}>
        <Link className="pre-visit-chrome__back" to={back.to}>
          {back.label}
        </Link>
        <span className="pre-visit-chrome__module">{t.moduleLabel}</span>
      </nav>
      <p className="pre-visit-chrome__safety" role="note">
        {t.safety}
      </p>
    </div>
  );
}
