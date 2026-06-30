import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Moon, SunMedium, X, ArrowLeft, LogIn } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { useTheme } from "../../../ThemeMode";
import GlobalLanguageSelector from "../../../components/language/GlobalLanguageSelector";
import { LANDING_SELECTABLE_LOCALE_CODES } from "../../../i18n/localeConfig";
import medScoutLogo from "../../../assets/img/medscout-logo.png";
import { PATIENT_DEMO_TILES, PRACTICE_DEMO_TILES } from "../demoContent.js";
import "./PublicDemoHubPage.css";

/**
 * Public Messe / DemoDay showcase.
 *
 * Self-contained on purpose: renders ONLY static dummy data from demoContent.js.
 * It imports no API client, issues no token and makes no /api request — so it can
 * never reach protected routes or expose real data. Real auth is untouched.
 */
export default function PublicDemoHubPage() {
  const { language } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const t = useMemo(
    () => getMessages(language).publicDemo || getMessages("en").publicDemo,
    [language],
  );
  const headerCopy = useMemo(() => getMessages(language).header, [language]);

  // { section, tile } of the currently open example modal, or null.
  const [active, setActive] = useState(null);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  // Esc closes the example modal.
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const themeLabel = theme === "dark" ? headerCopy.themeLight : headerCopy.themeDark;

  const renderSection = (titleKey, subKey, tiles) => (
    <section className="public-demo__section" aria-label={t[titleKey]}>
      <div className="public-demo__section-head">
        <h2 className="public-demo__section-title">{t[titleKey]}</h2>
        <p className="public-demo__section-sub">{t[subKey]}</p>
      </div>
      <div className="public-demo__grid">
        {tiles.map((tile) => {
          const TileIcon = tile.icon;
          const copy = t.tiles[tile.id];
          return (
            <button
              key={tile.id}
              type="button"
              className="public-demo__tile"
              onClick={() => setActive(tile)}
              aria-haspopup="dialog"
              aria-label={`${copy.label} — ${t.openLabel}`}
            >
              <span className="public-demo__tile-icon" aria-hidden>
                <TileIcon size={22} strokeWidth={1.75} />
              </span>
              <span className="public-demo__tile-label">{copy.label}</span>
              <span className="public-demo__tile-sub">{copy.sub}</span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const activeCopy = active ? t.tiles[active.id] : null;

  return (
    <div className="public-demo" data-theme={theme}>
      <header className="public-demo__header">
        <Link to="/" className="public-demo__brand" aria-label="MedScoutX">
          <img src={medScoutLogo} alt="" className="public-demo__brand-mark" />
          <span className="public-demo__brand-text">
            <strong>MedScoutX</strong>
            <span className="public-demo__brand-badge">{t.badge}</span>
          </span>
        </Link>

        <div className="public-demo__header-actions">
          <GlobalLanguageSelector
            compact
            label={headerCopy.languageLabel}
            selectableLocaleCodes={LANDING_SELECTABLE_LOCALE_CODES}
          />
          <button
            type="button"
            className="public-demo__icon-btn"
            onClick={toggleTheme}
            aria-label={themeLabel}
            title={themeLabel}
          >
            {theme === "dark" ? <SunMedium size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
          </button>
          <Link to="/login" className="public-demo__login-link">
            <LogIn size={16} aria-hidden />
            <span>{t.loginCta}</span>
          </Link>
        </div>
      </header>

      <main className="public-demo__main">
        <div className="public-demo__intro">
          <h1 className="public-demo__title">{t.heading}</h1>
          <p className="public-demo__lead">{t.sub}</p>
        </div>

        <div className="public-demo__banner" role="note">
          <strong>{t.bannerTitle}</strong>
          <span>{t.bannerBody}</span>
        </div>

        {renderSection("sectionPatient", "sectionPatientSub", PATIENT_DEMO_TILES)}
        {renderSection("sectionPractice", "sectionPracticeSub", PRACTICE_DEMO_TILES)}

        <div className="public-demo__footer-row">
          <Link to="/" className="public-demo__back">
            <ArrowLeft size={16} aria-hidden />
            <span>{t.backToSite}</span>
          </Link>
        </div>
      </main>

      {active && activeCopy ? (
        <div
          className="public-demo__modal-backdrop"
          role="presentation"
          onClick={() => setActive(null)}
        >
          <div
            className="public-demo__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="public-demo-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="public-demo__modal-close"
              onClick={() => setActive(null)}
              aria-label={t.modalClose}
            >
              <X size={18} aria-hidden />
            </button>
            <h3 id="public-demo-modal-title" className="public-demo__modal-title">
              {activeCopy.label}
            </h3>
            <p className="public-demo__modal-intro">{activeCopy.detail}</p>

            <ul className="public-demo__rows">
              {active.rows.map((row, i) => (
                <li key={i} className="public-demo__row">
                  <span className="public-demo__row-text">
                    <span className="public-demo__row-primary">{row.primary}</span>
                    <span className="public-demo__row-secondary">{row.secondary}</span>
                  </span>
                  {row.badge ? (
                    <span className={`public-demo__badge public-demo__badge--${row.badge}`}>
                      {t.badges[row.badge]}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>

            <p className="public-demo__sample-note">{t.sampleNote}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
