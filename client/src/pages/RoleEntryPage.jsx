import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { useTheme } from "../ThemeMode";
import { getMessages } from "../i18n/translations";
import {
  RoleCard,
  RoleEntryBackdrop,
  RoleEntryFlow,
  RoleEntryMetrics,
  RoleEntryShowcase,
} from "../components/landing/RoleEntryVisuals.jsx";
import introVideo from "../assets/media/medscoutx-intro.mp4";
import introPoster from "../assets/media/medscoutx-intro-poster.jpg";
import introVideo2 from "../assets/media/medscoutx-intro2.mp4";
import introPoster2 from "../assets/media/medscoutx-intro2-poster.jpg";
import {
  USER_MODES,
  writeUserMode,
  PENDING_MODE_KEY,
} from "../utils/userMode.js";
import "../styles/RoleEntryPage.css";

export default function RoleEntryPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { theme } = useTheme();

  const t = useMemo(() => {
    const m = getMessages(language);
    return m.roleEntry ?? getMessages("en").roleEntry;
  }, [language]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  // Gentle, staggered scroll-reveal. Strictly disabled for reduced motion.
  useEffect(() => {
    const root = document.querySelector(".role-entry");
    if (!root) return undefined;

    const targets = [];
    const addStatic = (selector) => {
      root.querySelectorAll(selector).forEach((el) => {
        el.style.setProperty("--role-reveal-delay", "0ms");
        targets.push(el);
      });
    };
    const addStaggered = (selector) => {
      root.querySelectorAll(selector).forEach((el, index) => {
        el.style.setProperty("--role-reveal-delay", `${index * 70}ms`);
        targets.push(el);
      });
    };

    addStatic(".role-entry__intro");
    addStatic(".role-entry__section-head");
    addStatic(".role-entry__media-row");
    addStatic(".role-entry__manifesto-inner");
    addStaggered(".role-entry__card");
    addStaggered(".role-entry__flow-step");
    addStaggered(".role-entry__metric");

    targets.forEach((el) => el.classList.add("role-entry__reveal"));

    const cleanup = () => {
      targets.forEach((el) => {
        el.classList.remove("role-entry__reveal", "is-visible");
        el.style.removeProperty("--role-reveal-delay");
      });
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return cleanup;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
    );

    targets.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      cleanup();
    };
  }, [language]);

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

  return (
    <div className="role-entry" data-theme={theme}>
      <RoleEntryBackdrop theme={theme} />

      <div className="role-entry__main">
        <header className="role-entry__intro">
          <p className="role-entry__eyebrow">{t.brandLine}</p>
          <h1 className="role-entry__title">{t.hero.title}</h1>
          <p className="role-entry__lead">{t.hero.lead}</p>
        </header>

        <div className="role-entry__grid">
          <RoleCard
            variant="patient"
            title={t.b2c.title}
            subtitle={t.b2c.subtitle}
            modules={t.b2c.modules}
            cta={t.b2c.cta}
            onClick={goPatient}
          />
          <RoleCard
            variant="practice"
            title={t.b2b.title}
            subtitle={t.b2b.subtitle}
            modules={t.b2b.modules}
            cta={t.b2b.cta}
            onClick={goPractice}
          />
        </div>

        <section className="role-entry__section role-entry__section--showcase">
          <RoleEntryShowcase
            copy={t.video}
            videos={[
              { src: introVideo, poster: introPoster },
              { src: introVideo2, poster: introPoster2 },
            ]}
          />
        </section>

        <section
          className="role-entry__section role-entry__section--flow"
          aria-labelledby="role-entry-flow-heading"
        >
          <div className="role-entry__section-head">
            <p className="role-entry__section-eyebrow">{t.flow.eyebrow}</p>
            <h2
              id="role-entry-flow-heading"
              className="role-entry__section-title"
            >
              {t.flow.title}
            </h2>
          </div>
          <RoleEntryFlow flow={t.flow} />
        </section>

        <section
          className="role-entry__section role-entry__section--metrics"
          aria-labelledby="role-entry-metrics-heading"
        >
          <div className="role-entry__section-head">
            <p className="role-entry__section-eyebrow">{t.metrics.eyebrow}</p>
            <h2
              id="role-entry-metrics-heading"
              className="role-entry__section-title"
            >
              {t.metrics.title}
            </h2>
          </div>
          <RoleEntryMetrics metrics={t.metrics} theme={theme} />
          <p className="role-entry__metrics-note">{t.metrics.note}</p>
        </section>

        <section
          className="role-entry__section role-entry__manifesto"
          aria-labelledby="role-entry-manifesto-heading"
        >
          <div className="role-entry__manifesto-inner">
            <div className="role-entry__section-head">
              <p className="role-entry__section-eyebrow">
                {t.manifesto.eyebrow}
              </p>
              <h2
                id="role-entry-manifesto-heading"
                className="role-entry__section-title"
              >
                {t.manifesto.title}
              </h2>
            </div>
            <div className="role-entry__manifesto-body">
              {t.manifesto.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <ul className="role-entry__trust">
              {t.manifesto.trust.map((badge) => (
                <li key={badge}>
                  <span className="role-entry__trust-mark" aria-hidden="true">
                    <Check size={15} strokeWidth={2.5} />
                  </span>
                  {badge}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
