import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  FileText,
  HeartPulse,
  Languages,
  Moon,
  ShieldCheck,
  Stethoscope,
  SunMedium,
  UserRound,
} from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { resolveLanding } from "../i18n/translations/resolveLanding.js";
import { HEADER_SELECTABLE_LOCALE_CODES } from "../i18n/localeConfig";
import { useTheme } from "../ThemeMode";
import GlobalLanguageSelector from "../components/language/GlobalLanguageSelector";
import heroPoster from "../assets/media/hero-medscoutx.png";
import demoVideo from "../assets/media/medscoutx-demo.mp4";
import "../styles/LandingPage.css";

export default function LandingPage() {
  const { language } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const copy = useMemo(() => resolveLanding(language), [language]);
  const headerCopy = useMemo(() => getMessages(language).header, [language]);
  const footerCopy = useMemo(() => getMessages(language).footer, [language]);

  useEffect(() => {
    document.title = copy.pageTitle;
  }, [copy.pageTitle]);

  const themeLabel =
    theme === "dark" ? headerCopy.themeLight : headerCopy.themeDark;

  const pillars = [
    {
      Icon: HeartPulse,
      title: copy.pillarOneTitle,
      body: copy.pillarOneBody,
    },
    {
      Icon: Languages,
      title: copy.pillarTwoTitle,
      body: copy.pillarTwoBody,
    },
    {
      Icon: ShieldCheck,
      title: copy.pillarThreeTitle,
      body: copy.pillarThreeBody,
    },
  ];

  const patientPoints = copy.patientPoints || [];
  const practicePoints = copy.practicePoints || [];

  const bridgeSteps = [
    { icon: UserRound, label: copy.bridgeStepOne },
    { icon: FileText, label: copy.bridgeStepTwo },
    { icon: Languages, label: copy.bridgeStepThree },
    { icon: Stethoscope, label: copy.bridgeStepFour },
  ];

  return (
    <div className="landing-page" data-theme={theme}>
      <a href="#landing-main" className="landing-page__skip-link">
        {copy.skip}
      </a>

      <header className="landing-page__header">
        <Link to="/" className="landing-page__brand" aria-label="MedScoutX home">
          <span className="landing-page__brand-mark" aria-hidden="true">
            MX
          </span>
          <span className="landing-page__brand-copy">
            <strong>MedScoutX</strong>
            <span>{copy.brandLine}</span>
          </span>
        </Link>

        <div className="landing-page__header-actions">
          <GlobalLanguageSelector
            compact
            label={headerCopy.languageLabel}
            selectableLocaleCodes={HEADER_SELECTABLE_LOCALE_CODES}
          />

          <button
            type="button"
            className="landing-page__icon-button"
            onClick={toggleTheme}
            aria-label={themeLabel}
            title={themeLabel}
          >
            {theme === "dark" ? (
              <SunMedium size={18} aria-hidden />
            ) : (
              <Moon size={18} aria-hidden />
            )}
          </button>

          <Link className="landing-page__utility-link" to="/login">
            {copy.login}
          </Link>

          <Link className="landing-page__utility-link is-strong" to="/choose">
            {copy.enterCta}
          </Link>
        </div>
      </header>

      <main id="landing-main" className="landing-page__main">
        <section className="landing-page__hero">
          <div className="landing-page__hero-copy">
            <p className="landing-page__eyebrow">{copy.badge}</p>
            <h1 className="landing-page__headline">{copy.headline}</h1>
            <p className="landing-page__description">{copy.description}</p>

            <div className="landing-page__cta-row">
              <Link
                className="landing-page__cta landing-page__cta--primary"
                to="/choose"
              >
                {copy.primaryCta}
                <ArrowRight size={18} aria-hidden />
              </Link>
              <a
                className="landing-page__cta landing-page__cta--secondary"
                href="#support"
              >
                {copy.secondaryCta}
              </a>
            </div>

            <p className="landing-page__trust-line">{copy.trustLine}</p>

            <div className="landing-page__metrics" aria-label={copy.metricsAria}>
              <article className="landing-page__metric-card">
                <span className="landing-page__metric-index">01</span>
                <strong>{copy.metricA}</strong>
              </article>
              <article className="landing-page__metric-card">
                <span className="landing-page__metric-index">02</span>
                <strong>{copy.metricB}</strong>
              </article>
              <article className="landing-page__metric-card">
                <span className="landing-page__metric-index">03</span>
                <strong>{copy.metricC}</strong>
              </article>
            </div>
          </div>

          <div className="landing-page__hero-media">
            <div className="landing-page__hero-glow" aria-hidden="true" />

            <div className="landing-page__media-copy">
              <p className="landing-page__media-eyebrow">{copy.mediaEyebrow}</p>
              <h2 className="landing-page__media-title">{copy.mediaTitle}</h2>
              <p className="landing-page__media-text">{copy.mediaText}</p>
            </div>

            <div className="landing-page__video-shell">
              <video
                className="landing-page__video"
                src={demoVideo}
                poster={heroPoster}
                autoPlay
                loop
                muted
                playsInline
              />
            </div>

            <div className="landing-page__signal-row" aria-label={copy.mediaSignalsAria}>
              <div className="landing-page__signal-pill">
                <HeartPulse size={16} aria-hidden />
                <span>{copy.mediaSignalOne}</span>
              </div>
              <div className="landing-page__signal-pill">
                <Languages size={16} aria-hidden />
                <span>{copy.mediaSignalTwo}</span>
              </div>
              <div className="landing-page__signal-pill">
                <ShieldCheck size={16} aria-hidden />
                <span>{copy.mediaSignalThree}</span>
              </div>
            </div>
          </div>
        </section>

        <section id="support" className="landing-page__section">
          <div className="landing-page__section-heading">
            <p className="landing-page__section-eyebrow">{copy.purposeEyebrow}</p>
            <h2>{copy.purposeTitle}</h2>
            <p>{copy.purposeBody}</p>
          </div>

          <div className="landing-page__pillar-grid">
            {pillars.map((pillar) => {
              const PillarIcon = pillar.Icon;
              return (
                <article key={pillar.title} className="landing-page__pillar-card">
                  <div className="landing-page__pillar-icon" aria-hidden="true">
                    <PillarIcon size={22} strokeWidth={1.9} />
                  </div>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="landing-page__section landing-page__workspace">
          <div className="landing-page__section-heading">
            <p className="landing-page__section-eyebrow">{copy.forWhomTitle}</p>
            <h2>{copy.workspaceTitle}</h2>
            <p>{copy.workspaceBody}</p>
          </div>

          <div className="landing-page__workspace-grid">
            <article className="landing-page__workspace-card">
              <div className="landing-page__workspace-icon" aria-hidden="true">
                <UserRound size={22} />
              </div>
              <h3>{copy.patientCardTitle}</h3>
              <p>{copy.patientCardBody}</p>
              <ul>
                {patientPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="landing-page__workspace-card">
              <div className="landing-page__workspace-icon" aria-hidden="true">
                <Building2 size={22} />
              </div>
              <h3>{copy.practiceCardTitle}</h3>
              <p>{copy.practiceCardBody}</p>
              <ul>
                {practicePoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="landing-page__flow-card">
              <h3>{copy.howTitle}</h3>
              <ol className="landing-page__flow-list">
                {(copy.howSteps || []).map((step, index) => (
                  <li key={step}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{step}</strong>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="landing-page__flow-outcome">{copy.howOutcome}</p>
            </article>
          </div>
        </section>

        <section className="landing-page__section landing-page__bridge">
          <div className="landing-page__section-heading">
            <p className="landing-page__section-eyebrow">{copy.bridgeEyebrow}</p>
            <h2>{copy.bridgeTitle}</h2>
            <p>{copy.bridgeBody}</p>
          </div>

          <div className="landing-page__bridge-diagram" aria-label={copy.bridgeTitle}>
            {bridgeSteps.map((step, index) => {
              const BridgeIcon = step.icon;
              return (
                <div key={step.label} className="landing-page__bridge-step">
                  <div className="landing-page__bridge-badge" aria-hidden="true">
                    <BridgeIcon size={20} strokeWidth={1.9} />
                  </div>
                  <span>{step.label}</span>
                  {index < bridgeSteps.length - 1 ? (
                    <div className="landing-page__bridge-line" aria-hidden="true" />
                  ) : null}
                </div>
              );
            })}
          </div>

          <p className="landing-page__bridge-caption">{copy.bridgeCaption}</p>
        </section>

        <section className="landing-page__section landing-page__safety-grid">
          <article className="landing-page__safety-card">
            <h2>{copy.safetyTitle}</h2>
            <p>{copy.safetyBody}</p>
          </article>

          <article className="landing-page__safety-card">
            <h2>{copy.privacyTitle}</h2>
            <p>{copy.privacyBody}</p>
          </article>
        </section>

        <section className="landing-page__cta-panel">
          <p className="landing-page__section-eyebrow">{copy.finalEyebrow}</p>
          <h2>{copy.finalTitle}</h2>
          <p>{copy.finalBody}</p>

          <div className="landing-page__cta-row landing-page__cta-row--center">
            <Link
              className="landing-page__cta landing-page__cta--primary"
              to="/choose"
            >
              {copy.finalPrimary}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link
              className="landing-page__cta landing-page__cta--secondary"
              to="/login"
            >
              {copy.finalSecondary}
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-page__footer">
        <p>{copy.footerDisclaimer}</p>
        <nav
          className="landing-page__footer-links"
          aria-label={footerCopy.ariaLabel}
        >
          <Link to="/choose">{copy.enterCta}</Link>
          <Link to="/login">{copy.login}</Link>
          <Link to="/impressum?public=1">{footerCopy.imprint}</Link>
          <Link to="/datenschutz?public=1">{footerCopy.privacy}</Link>
          <Link to="/agb?public=1">{footerCopy.terms}</Link>
          <Link to="/disclaimer?public=1">{footerCopy.disclaimer}</Link>
        </nav>
      </footer>
    </div>
  );
}
