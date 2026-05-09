import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Moon, SunMedium, UserRound } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { useTheme } from "../ThemeMode";
import { getMessages } from "../i18n/translations";
import GlobalLanguageSelector from "../components/language/GlobalLanguageSelector";
import {
  USER_MODES,
  writeUserMode,
  PENDING_MODE_KEY,
} from "../utils/userMode.js";
import "../styles/RoleEntryPage.css";

export default function RoleEntryPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const t = useMemo(() => {
    const m = getMessages(language);
    return m.roleEntry ?? getMessages("en").roleEntry;
  }, [language]);

  const copyHeader = useMemo(() => getMessages(language).header, [language]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  const isLoggedIn =
    !!localStorage.getItem("medscout_token") &&
    !!localStorage.getItem("medscout_user_id");

  function goPatient() {
    writeUserMode(USER_MODES.PATIENT);
    if (isLoggedIn) navigate("/patient");
    else {
      try {
        sessionStorage.setItem(PENDING_MODE_KEY, USER_MODES.PATIENT);
      } catch {
        /* ignore */
      }
      navigate("/login");
    }
  }

  function goPractice() {
    writeUserMode(USER_MODES.PRACTICE);
    if (isLoggedIn) navigate("/practice");
    else {
      try {
        sessionStorage.setItem(PENDING_MODE_KEY, USER_MODES.PRACTICE);
      } catch {
        /* ignore */
      }
      navigate("/login");
    }
  }

  const themeLabel =
    theme === "dark" ? copyHeader.themeLight : copyHeader.themeDark;

  return (
    <div className="role-entry" data-theme={theme}>
      <header className="role-entry__top">
        <span className="role-entry__brand">MedScoutX</span>
        <div className="role-entry__top-actions">
          <button
            type="button"
            className="role-entry__icon-btn"
            onClick={toggleTheme}
            aria-label={themeLabel}
          >
            {theme === "dark" ? (
              <SunMedium size={20} aria-hidden />
            ) : (
              <Moon size={20} aria-hidden />
            )}
          </button>
          <GlobalLanguageSelector label={copyHeader.languageLabel} compact />
        </div>
      </header>

      <div className="role-entry__main">
        <p className="role-entry__eyebrow">{t.brandLine}</p>
        <h1 className="role-entry__sr-only">{t.pageTitle}</h1>

        <div className="role-entry__grid">
          <article className="role-entry__card role-entry__card--patient">
            <div className="role-entry__card-icon" aria-hidden>
              <UserRound size={28} strokeWidth={1.5} />
            </div>
            <h2 className="role-entry__card-title">{t.b2c.title}</h2>
            <p className="role-entry__card-sub">{t.b2c.subtitle}</p>
            <ul className="role-entry__modules">
              {t.b2c.modules.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button
              type="button"
              className="role-entry__cta role-entry__cta--primary"
              onClick={goPatient}
            >
              {t.b2c.cta}
            </button>
          </article>

          <article className="role-entry__card role-entry__card--practice">
            <div className="role-entry__card-icon" aria-hidden>
              <Building2 size={28} strokeWidth={1.5} />
            </div>
            <h2 className="role-entry__card-title">{t.b2b.title}</h2>
            <p className="role-entry__card-sub">{t.b2b.subtitle}</p>
            <ul className="role-entry__modules">
              {t.b2b.modules.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button
              type="button"
              className="role-entry__cta role-entry__cta--secondary"
              onClick={goPractice}
            >
              {t.b2b.cta}
            </button>
          </article>
        </div>

        <p className="role-entry__footer-note">
          <Link className="role-entry__inline-link" to="/landing">
            {t.marketingLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
