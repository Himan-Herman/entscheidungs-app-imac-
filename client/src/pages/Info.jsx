import React, { useEffect, useMemo } from "react";
import "../styles/Info.css";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations/index.js";
import heroPrepImg from "../assets/media/hero-medscoutx.png";
import symptomDemoImg from "../assets/media/symptom-demo.jpg";
import bodymapDemoImg from "../assets/media/bodymap-demo.jpg";
import imageDemoImg from "../assets/media/image-demo.jpg";

import {
  IconSymptomChat,
  IconBodyMap,
  IconImageAnalysis,
  IconPreVisit,
} from "../components/MedScoutIcons";

export default function Info() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const copy = useMemo(() => getMessages(language).info, [language]);

  useEffect(() => {
    document.title = copy.pageTitle;
  }, [copy.pageTitle]);

  return (
    <>
      <a href="#info-main" className="sr-only sr-only-focusable">
        {copy.skip}
      </a>
      <div className="info-page" data-page="info">
        <header className="startseite__header info-header-merged" role="banner">
          <div className="startseite__header-left">
            <button
              type="button"
              className="back-btn"
              onClick={() => navigate(-1)}
              aria-label={copy.backAria}
            >
              <span aria-hidden="true">←</span>
              {copy.back}
            </button>

            <div className="startseite__branding">
              <span className="startseite__app-name">MedScoutX</span>
              <span className="startseite__app-tagline">{copy.tagline}</span>
            </div>
          </div>

          <div className="startseite__header-right">
            <button
              type="button"
              className="info-header__cta"
              onClick={() => navigate("/pre-visit")}
            >
              {copy.ctaTop}
            </button>
          </div>
        </header>

        <main id="info-main" className="info-main" aria-label={copy.mainAria}>
          <section
            className="info-section info-section--intro"
            aria-labelledby="info-intro-heading"
          >
            <h1 id="info-intro-heading" className="info-heading-main">
              {copy.introTitle}
            </h1>
            <p className="info-lead">{copy.lead}</p>
            <p className="info-note">{copy.note}</p>
          </section>

          <section className="info-section" aria-labelledby="info-steps-heading">
            <h2 id="info-steps-heading" className="info-heading-section">
              {copy.stepsTitle}
            </h2>

            <ol className="info-steps" aria-label={copy.stepsTitle}>
              <li className="info-step">
                <div className="info-step__badge" aria-hidden="true">
                  <span>1</span>
                </div>
                <div className="info-step__content">
                  <h3 className="info-step__title">{copy.step1Title}</h3>
                  <p className="info-step__text">{copy.step1Text}</p>
                </div>
              </li>

              <li className="info-step">
                <div className="info-step__badge" aria-hidden="true">
                  <span>2</span>
                </div>
                <div className="info-step__content">
                  <h3 className="info-step__title">{copy.step2Title}</h3>
                  <p className="info-step__text">{copy.step2Text}</p>
                </div>
              </li>

              <li className="info-step">
                <div className="info-step__badge" aria-hidden="true">
                  <span>3</span>
                </div>
                <div className="info-step__content">
                  <h3 className="info-step__title">{copy.step3Title}</h3>
                  <p className="info-step__text">{copy.step3Text}</p>
                </div>
              </li>

              <li className="info-step">
                <div className="info-step__badge" aria-hidden="true">
                  <span>4</span>
                </div>
                <div className="info-step__content">
                  <h3 className="info-step__title">{copy.step4Title}</h3>
                  <p className="info-step__text">{copy.step4Text}</p>
                </div>
              </li>
            </ol>
          </section>

          <section className="info-section" aria-labelledby="info-features-heading">
            <h2 id="info-features-heading" className="info-heading-section">
              {copy.featuresTitle}
            </h2>

            <div className="info-feature-grid" role="list">
              <article className="info-feature-card" role="listitem" aria-label={copy.previsitTitle}>
                <div className="info-feature-card__icon" aria-hidden="true">
                  <IconPreVisit />
                </div>
                <h3 className="info-feature-card__title">{copy.previsitTitle}</h3>
                <p className="info-feature-card__text">{copy.previsitText}</p>
                <figure className="info-feature-media">
                  <img
                    src={heroPrepImg}
                    alt={copy.previsitAlt}
                    className="info-feature-image"
                    loading="lazy"
                  />
                </figure>
              </article>

              <article className="info-feature-card" role="listitem" aria-label={copy.symptomTitle}>
                <div className="info-feature-card__icon" aria-hidden="true">
                  <IconSymptomChat />
                </div>
                <h3 className="info-feature-card__title">{copy.symptomTitle}</h3>
                <p className="info-feature-card__text">{copy.symptomText}</p>
                <figure className="info-feature-media">
                  <img
                    src={symptomDemoImg}
                    alt={copy.symptomAlt}
                    className="info-feature-image"
                    loading="lazy"
                  />
                </figure>
              </article>

              <article className="info-feature-card" role="listitem" aria-label={copy.bodyTitle}>
                <div className="info-feature-card__icon" aria-hidden="true">
                  <IconBodyMap />
                </div>
                <h3 className="info-feature-card__title">{copy.bodyTitle}</h3>
                <p className="info-feature-card__text">{copy.bodyText}</p>
                <figure className="info-feature-media">
                  <img
                    src={bodymapDemoImg}
                    alt={copy.bodyAlt}
                    className="info-feature-image"
                    loading="lazy"
                  />
                </figure>
              </article>

              <article className="info-feature-card" role="listitem" aria-label={copy.imageTitle}>
                <div className="info-feature-card__icon" aria-hidden="true">
                  <IconImageAnalysis />
                </div>
                <h3 className="info-feature-card__title">{copy.imageTitle}</h3>
                <p className="info-feature-card__text">{copy.imageText}</p>
                <figure className="info-feature-media">
                  <img
                    src={imageDemoImg}
                    alt={copy.imageAlt}
                    className="info-feature-image"
                    loading="lazy"
                  />
                </figure>
              </article>
            </div>
          </section>

          <section
            className="info-section info-section--safety"
            aria-labelledby="info-safety-heading"
          >
            <h2 id="info-safety-heading" className="info-heading-section">
              {copy.safetyTitle}
            </h2>

            <div className="info-safety-grid">
              <div className="info-safety-card">
                <h3 className="info-safety-card__title">{copy.safety1Title}</h3>
                <p className="info-safety-card__text">{copy.safety1Text}</p>
              </div>

              <div className="info-safety-card">
                <h3 className="info-safety-card__title">{copy.safety2Title}</h3>
                <p className="info-safety-card__text">{copy.safety2Text}</p>
              </div>

              <div className="info-safety-card">
                <h3 className="info-safety-card__title">{copy.safety3Title}</h3>
                <p className="info-safety-card__text">{copy.safety3Text}</p>
              </div>
            </div>
          </section>

          <section
            className="info-section info-section--cta"
            aria-labelledby="info-cta-heading"
          >
            <h2
              id="info-cta-heading"
              className="info-heading-section info-heading-section--center"
            >
              {copy.ctaTitle}
            </h2>
            <p className="info-cta-text">{copy.ctaText}</p>
            <button
              type="button"
              className="info-cta-button"
              onClick={() => navigate("/pre-visit")}
            >
              {copy.ctaButton}
            </button>
          </section>
        </main>
      </div>
    </>
  );
}
