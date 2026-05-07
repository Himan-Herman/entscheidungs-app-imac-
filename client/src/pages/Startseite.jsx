import React, { useEffect, useMemo, useState } from "react";
import "../styles/Startseite.css";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import heroImage from "../assets/media/hero-medscoutx.png";
import demoVideo from "../assets/media/medscoutx-demo.mp4";

import {
  IconSymptomChat,
  IconBodyMap,
  IconImageAnalysis,
  IconPreVisit,
} from "../components/MedScoutIcons";

const ICON_BY_KEY = {
  previsit: IconPreVisit,
  symptom: IconSymptomChat,
  bodymap: IconBodyMap,
  image: IconImageAnalysis,
};

export default function Startseite() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const copy = useMemo(() => getMessages(language).startseite, [language]);

  const featureCards = useMemo(
    () =>
      (copy.cards || [])
        .filter((c) => ICON_BY_KEY[c.key])
        .map((c) => ({
          ...c,
          Icon: ICON_BY_KEY[c.key],
        })),
    [copy.cards]
  );
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFocusIndex((prev) => (prev + 1) % featureCards.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [featureCards.length]);

  useEffect(() => {
    document.title = copy.title;
  }, [copy.title]);

  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <>
      <a href="#main-content" className="sr-only sr-only-focusable">
        {copy.skip}
      </a>

      <div className="startseite" data-page="startseite">
        <div className="startseite-root">
          <main
            id="main-content"
            className="startseite-inner"
            aria-label={copy.title}
          >
            <section className="startseite__hero" aria-labelledby="hero-heading">
              <div className="startseite__hero-layout">
                <div className="startseite__hero-left">
                  <h1 id="hero-heading" className="startseite__hero-heading">
                    {copy.heroTitle}
                  </h1>

                  <p className="startseite__hero-text">{copy.heroText}</p>

                  <div
                    className="startseite__hero-actions"
                    aria-describedby="hero-primary-desc"
                  >
                    <button
                      type="button"
                      className="startseite__btn startseite__btn--primary"
                      onClick={() => navigate("/pre-visit")}
                    >
                      {copy.heroPrimary}
                    </button>
                    <button
                      type="button"
                      className="startseite__btn startseite__btn--secondary"
                      onClick={() => navigate("/info")}
                    >
                      {copy.heroSecondary}
                    </button>
                  </div>

                  <p id="hero-primary-desc" className="startseite__hero-helper">
                    {copy.heroHelp}
                  </p>
                </div>

                <div className="startseite__hero-visual" aria-hidden="true">
                  <img
                    src={heroImage}
                    alt=""
                    className="startseite__hero-image"
                    loading="lazy"
                  />
                </div>
              </div>
            </section>

            <section
              className="startseite__prep-strip"
              aria-labelledby="audience-heading"
            >
              <div className="startseite__prep-grid">
                <div>
                  <h2
                    id="audience-heading"
                    className="startseite__section-title"
                  >
                    {copy.audienceTitle}
                  </h2>
                  <ul className="startseite__prep-list">
                    {copy.audienceBullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="startseite__prep-eyebrow">{copy.stepsEyebrow}</p>
                  <ol className="startseite__prep-steps">
                    {copy.stepsItems.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
              <div className="startseite__safety-strip">
                <h3>{copy.safetyStripTitle}</h3>
                <p>{copy.safetyStripBody}</p>
              </div>
            </section>

            <section
              className="startseite__features"
              aria-labelledby="features-heading"
            >
              <div className="startseite__section-header">
                <h2 id="features-heading" className="startseite__section-title">
                  {copy.featuresTitle}
                </h2>
                <p className="startseite__section-subtitle">
                  {copy.featuresSubtitle}
                </p>
              </div>

              <div
                className="startseite__feature-grid"
                role="list"
                aria-label={copy.featuresAria}
              >
                {featureCards.map((card, index) => (
                  <button
                    key={card.key}
                    type="button"
                    className={`startseite__feature-card ${
                      focusIndex === index ? "focus-card" : ""
                    }`}
                    role="listitem"
                    onClick={() => handleNavigate(card.to)}
                    aria-label={`${card.title}: ${card.description}`}
                  >
                    <div className="startseite__feature-icon" aria-hidden="true">
                      <card.Icon />
                    </div>

                    <div className="startseite__feature-content">
                      <h3 className="startseite__feature-title">{card.title}</h3>
                      <p className="startseite__feature-description">
                        {card.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="startseite__trust" aria-labelledby="trust-heading">
              <h2 id="trust-heading" className="startseite__section-title">
                {copy.trustTitle}
              </h2>
              <p className="startseite__trust-text">{copy.trustText}</p>
              <ul className="startseite__trust-list">
                <li>
                  <strong>{copy.trust1}</strong> {copy.trust1Text}
                </li>
                <li>
                  <strong>{copy.trust2}</strong> {copy.trust2Text}
                </li>
                <li>
                  <strong>{copy.trust3}</strong> {copy.trust3Text}
                </li>
              </ul>
            </section>

            <section className="startseite__abo" aria-labelledby="abo-heading">
              <div
                className="startseite__abo-card"
                role="group"
                aria-describedby="abo-benefits"
              >
                <h2
                  id="abo-heading"
                  className="startseite__section-title startseite__section-title--center"
                >
                  {copy.proTitle}
                </h2>
                <p id="abo-benefits" className="startseite__abo-text">
                  {copy.proText}
                </p>
                <ul className="startseite__abo-list">
                  <li>{copy.pro1}</li>
                  <li>{copy.pro2}</li>
                  <li>{copy.pro3}</li>
                </ul>
                <button
                  type="button"
                  className="startseite__btn startseite__btn--secondary"
                  onClick={() => handleNavigate("/abo")}
                >
                  {copy.proButton}
                </button>
              </div>
            </section>

            <section className="startseite__demo" aria-labelledby="demo-heading">
              <div className="startseite__section-header startseite__section-header--center">
                <h2 id="demo-heading" className="startseite__section-title">
                  {copy.demoTitle}
                </h2>
                <p className="startseite__section-subtitle">{copy.demoText}</p>
              </div>

              <div className="startseite__demo-media">
                <video
                  className="startseite__demo-video"
                  src={demoVideo}
                  autoPlay
                  muted
                  loop
                  playsInline
                  aria-label={copy.videoAria}
                >
                  {copy.videoUnsupported}
                </video>
              </div>
            </section>
          </main>
        </div>

        <div
          className="startseite__status-region sr-only"
          aria-live="polite"
          role="status"
        >
          {copy.status}
        </div>

        <footer className="startseite__footer">
          <nav className="startseite__footer-nav" aria-label={copy.legal}>
            <button
              type="button"
              className="startseite__footer-link"
              onClick={() => handleNavigate("/impressum")}
            >
              {copy.imprint}
            </button>
            <button
              type="button"
              className="startseite__footer-link"
              onClick={() => handleNavigate("/datenschutz")}
            >
              {copy.privacy}
            </button>
            <button
              type="button"
              className="startseite__footer-link"
              onClick={() => handleNavigate("/agb")}
            >
              {copy.terms}
            </button>
            <button
              type="button"
              className="startseite__footer-link"
              onClick={() => handleNavigate("/disclaimer")}
            >
              {copy.disclaimer}
            </button>
          </nav>

          <p className="startseite__footer-note">{copy.footerNote}</p>
        </footer>
      </div>
    </>
  );
}
