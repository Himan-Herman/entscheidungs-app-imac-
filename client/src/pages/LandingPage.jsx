import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { resolveLanding } from "../i18n/translations/resolveLanding.js";
import heroPoster from "../assets/media/hero-medscoutx.png";
import demoVideo from "../assets/media/medscoutx-demo.mp4";
import "../styles/LandingPage.css";

export default function LandingPage() {
  const { language } = useLanguage();
  const currentCopy = useMemo(() => resolveLanding(language), [language]);

  useEffect(() => {
    document.title = currentCopy.pageTitle;
  }, [currentCopy.pageTitle]);

  return (
    <div className="landing-page">
      <a href="#landing-main" className="landing-page__skip-link">
        {currentCopy.skip}
      </a>

      <main id="landing-main" className="landing-page__main">
        <section className="landing-page__hero">
          <div className="landing-page__hero-copy">
            <p className="landing-page__eyebrow">{currentCopy.badge}</p>
            <h1 className="landing-page__headline">{currentCopy.headline}</h1>
            <p className="landing-page__description">{currentCopy.description}</p>

            <div className="landing-page__cta-row">
              <Link
                className="landing-page__cta landing-page__cta--primary"
                to="/pre-visit"
              >
                {currentCopy.primaryCta}
              </Link>
              <Link
                className="landing-page__cta landing-page__cta--secondary"
                to="/info"
              >
                {currentCopy.secondaryCta}
              </Link>
            </div>

            <p className="landing-page__trust-line">{currentCopy.trustLine}</p>

            <div
              className="landing-page__metrics"
              aria-label={currentCopy.howTitle}
            >
              <div className="landing-page__metric-card">
                <span>01</span>
                <strong>{currentCopy.metricA}</strong>
              </div>
              <div className="landing-page__metric-card">
                <span>02</span>
                <strong>{currentCopy.metricB}</strong>
              </div>
              <div className="landing-page__metric-card">
                <span>03</span>
                <strong>{currentCopy.metricC}</strong>
              </div>
            </div>
          </div>

          <div className="landing-page__hero-media">
            <div className="landing-page__media-shell">
              <div className="landing-page__media-copy">
                <p className="landing-page__media-eyebrow">
                  {currentCopy.mediaEyebrow}
                </p>
                <h2>{currentCopy.mediaTitle}</h2>
                <p>{currentCopy.mediaText}</p>
              </div>

              <div className="landing-page__video-frame">
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
            </div>
          </div>
        </section>

        <section
          className="landing-page__value-grid"
          aria-labelledby="landing-for-whom"
        >
          <div className="landing-page__value-card">
            <h2 id="landing-for-whom" className="landing-page__value-title">
              {currentCopy.forWhomTitle}
            </h2>
            <ul className="landing-page__value-list">
              {currentCopy.forWhom.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="landing-page__value-card">
            <h2 className="landing-page__value-title">{currentCopy.howTitle}</h2>
            <ol className="landing-page__value-steps">
              {currentCopy.howSteps.map((step, i) => (
                <li key={step}>
                  <span className="landing-page__step-num">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="landing-page__value-card landing-page__value-card--wide">
            <h2 className="landing-page__value-title">
              {currentCopy.safetyTitle}
            </h2>
            <p className="landing-page__safety-body">{currentCopy.safetyBody}</p>
          </div>
        </section>
      </main>

      <footer className="landing-page__footer">
        <p>{currentCopy.footerDisclaimer}</p>
        <div className="landing-page__footer-links">
          <Link to="/login">{currentCopy.login}</Link>
          <span className="landing-page__footer-sep" aria-hidden="true">
            ·
          </span>
          <Link to="/impressum?public=1">{currentCopy.imprint}</Link>
          <Link to="/datenschutz?public=1">{currentCopy.privacy}</Link>
        </div>
      </footer>
    </div>
  );
}
