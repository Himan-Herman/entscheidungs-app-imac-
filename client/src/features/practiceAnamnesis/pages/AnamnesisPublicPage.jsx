import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchPublicAnamnesisLink, submitPublicAnamnesis } from "../api/publicAnamnesisApi.js";
import "../../practiceAnamnesis/AnamnesisPublic.css";

const SUPPORTED_LANGS = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "es", label: "Español" },
];

const STEPS = ["language", "consent", "form", "review", "done"];

function getLabel(json, lang) {
  if (!json || typeof json !== "object") return "";
  return json[lang] || json.de || json.en || Object.values(json)[0] || "";
}

function detectBrowserLang() {
  const nav = navigator.language || navigator.languages?.[0] || "de";
  const code = nav.split("-")[0].toLowerCase();
  return SUPPORTED_LANGS.find((l) => l.code === code)?.code || "de";
}

function useT(lang) {
  const [msgs, setMsgs] = useState(null);
  useEffect(() => {
    import(`../../../i18n/translations/${lang}/anamnesisPublic.js`)
      .then((m) => setMsgs(m.default))
      .catch(() =>
        import("../../../i18n/translations/en/anamnesisPublic.js").then((m) => setMsgs(m.default))
      );
  }, [lang]);
  return msgs;
}

function answersReducer(state, action) {
  switch (action.type) {
    case "SET":
      return { ...state, [action.questionId]: action.value };
    default:
      return state;
  }
}

function QuestionInput({ question, lang, value, onChange, t }) {
  const label = getLabel(question.labelJson, lang);
  const hint = getLabel(question.hintJson, lang);
  const id = `q_${question.id}`;

  if (question.type === "yes_no") {
    return (
      <div className="apub__question">
        <p className="apub__question-label">{label}{question.isRequired && <span className="apub__required">*</span>}</p>
        {hint && <p className="apub__hint">{hint}</p>}
        <div className="apub__yn-row">
          <button
            type="button"
            className={`apub__yn-btn${value === true ? " apub__yn-btn--active" : ""}`}
            onClick={() => onChange(true)}
          >{t?.yes || "Ja"}</button>
          <button
            type="button"
            className={`apub__yn-btn${value === false ? " apub__yn-btn--active" : ""}`}
            onClick={() => onChange(false)}
          >{t?.no || "Nein"}</button>
        </div>
      </div>
    );
  }

  if (question.type === "single_choice") {
    const options = Array.isArray(question.optionsJson) ? question.optionsJson : [];
    return (
      <div className="apub__question">
        <p className="apub__question-label">{label}{question.isRequired && <span className="apub__required">*</span>}</p>
        {hint && <p className="apub__hint">{hint}</p>}
        <div className="apub__options">
          {options.map((opt, i) => {
            const optLabel = getLabel(opt, lang);
            return (
              <button
                key={i}
                type="button"
                className={`apub__option-btn${value === optLabel ? " apub__option-btn--active" : ""}`}
                onClick={() => onChange(optLabel)}
              >{optLabel}</button>
            );
          })}
        </div>
      </div>
    );
  }

  if (question.type === "multi_choice") {
    const options = Array.isArray(question.optionsJson) ? question.optionsJson : [];
    const selected = Array.isArray(value) ? value : [];
    const toggle = (optLabel) => {
      if (selected.includes(optLabel)) onChange(selected.filter((v) => v !== optLabel));
      else onChange([...selected, optLabel]);
    };
    return (
      <div className="apub__question">
        <p className="apub__question-label">{label}{question.isRequired && <span className="apub__required">*</span>}</p>
        {hint && <p className="apub__hint">{hint}</p>}
        <div className="apub__options">
          {options.map((opt, i) => {
            const optLabel = getLabel(opt, lang);
            return (
              <button
                key={i}
                type="button"
                className={`apub__option-btn${selected.includes(optLabel) ? " apub__option-btn--active" : ""}`}
                onClick={() => toggle(optLabel)}
              >{optLabel}</button>
            );
          })}
        </div>
      </div>
    );
  }

  if (question.type === "textarea") {
    return (
      <div className="apub__question">
        <label className="apub__question-label" htmlFor={id}>{label}{question.isRequired && <span className="apub__required">*</span>}</label>
        {hint && <p className="apub__hint">{hint}</p>}
        <textarea id={id} className="apub__textarea" rows={4} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }

  if (question.type === "date") {
    return (
      <div className="apub__question">
        <label className="apub__question-label" htmlFor={id}>{label}{question.isRequired && <span className="apub__required">*</span>}</label>
        {hint && <p className="apub__hint">{hint}</p>}
        <input id={id} type="date" className="apub__input" value={value || ""} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }

  if (question.type === "number") {
    return (
      <div className="apub__question">
        <label className="apub__question-label" htmlFor={id}>{label}{question.isRequired && <span className="apub__required">*</span>}</label>
        {hint && <p className="apub__hint">{hint}</p>}
        <input id={id} type="number" className="apub__input apub__input--number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
      </div>
    );
  }

  return (
    <div className="apub__question">
      <label className="apub__question-label" htmlFor={id}>{label}{question.isRequired && <span className="apub__required">*</span>}</label>
      {hint && <p className="apub__hint">{hint}</p>}
      <input id={id} type="text" className="apub__input" value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function AnamnesisPublicPage() {
  const { token } = useParams();

  const [step, setStep] = useState("language");
  const [lang, setLang] = useState(detectBrowserLang);
  const t = useT(lang);

  const [linkData, setLinkData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(false);


  const sections = useMemo(() => {
    if (!linkData?.template) return [];
    return (linkData.template.sections || []).filter((s) => s.questions?.length > 0);
  }, [linkData]);

  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, dispatch] = useReducer(answersReducer, {});
  const [validationErrors, setValidationErrors] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const topRef = useRef(null);

  const scrollTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadLink = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { res, data } = await fetchPublicAnamnesisLink(token);
      if (!res.ok) {
        const code = data?.error || "link_not_found";
        setLoadError(code);
        return;
      }
      setLinkData(data);
    } catch {
      setLoadError("network");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (step === "consent" && !linkData) loadLink();
  }, [step, linkData, loadLink]);

  const handleLangContinue = () => {
    setStep("consent");
    scrollTop();
  };

  const handleConsentAccept = () => {
    setStep("form");
    setSectionIndex(0);
    scrollTop();
  };

  const handleConsentDecline = () => {
    setStep("language");
  };

  const validateSection = (secIndex) => {
    const sec = sections[secIndex];
    if (!sec) return true;
    const errors = {};
    for (const q of sec.questions) {
      if (!q.isRequired) continue;
      const val = answers[q.id];
      if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
        errors[q.id] = true;
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (!validateSection(sectionIndex)) return;
    setValidationErrors({});
    if (sectionIndex < sections.length - 1) {
      setSectionIndex((i) => i + 1);
      scrollTop();
    } else {
      setStep("review");
      scrollTop();
    }
  };

  const handleBack = () => {
    if (step === "form") {
      if (sectionIndex > 0) {
        setSectionIndex((i) => i - 1);
        scrollTop();
      } else {
        setStep("consent");
        scrollTop();
      }
    } else if (step === "review") {
      setStep("form");
      setSectionIndex(sections.length - 1);
      scrollTop();
    }
  };

  const buildAnswersJson = useCallback(() => {
    const result = [];
    for (const sec of sections) {
      const secLabel = getLabel(sec.titleJson, lang);
      for (const q of sec.questions) {
        result.push({
          questionId: q.id,
          sectionId: sec.id,
          sectionLabel: secLabel,
          questionLabel: getLabel(q.labelJson, lang),
          type: q.type,
          value: answers[q.id] ?? null,
        });
      }
    }
    return result;
  }, [sections, answers, lang]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { res, data } = await submitPublicAnamnesis(token, {
        patientLanguage: lang,
        answersJson: buildAnswersJson(),
      });
      if (!res.ok) {
        setSubmitError(data?.error || "request_failed");
        setSubmitting(false);
        return;
      }
      sessionStorage.removeItem(`anamnesis_draft_${token}`);
      setStep("done");
      scrollTop();
    } catch {
      setSubmitError("network");
      setSubmitting(false);
    }
  };

  const formatAnswerForReview = (type, value) => {
    if (value === null || value === undefined || value === "") return t?.noAnswer || "—";
    if (type === "yes_no") {
      if (value === true) return t?.yes || "Ja";
      if (value === false) return t?.no || "Nein";
    }
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  };

  if (!t) return <div className="apub__loading">…</div>;

  if (step === "language") {
    return (
      <div className="apub" ref={topRef}>
        <div className="apub__card">
          <h1 className="apub__heading">{t.languageHeading}</h1>
          <p className="apub__subheading">{t.languageSubheading}</p>
          <div className="apub__lang-grid">
            {SUPPORTED_LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                className={`apub__lang-btn${lang === l.code ? " apub__lang-btn--active" : ""}`}
                onClick={() => setLang(l.code)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button type="button" className="apub__btn apub__btn--primary" onClick={handleLangContinue}>
            {t.languageContinue}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="apub" ref={topRef}>
        <div className="apub__card apub__card--center">
          <p className="apub__loading">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    const msgMap = {
      link_not_found: t.errorInvalid,
      link_disabled: t.errorDisabled,
      link_expired: t.errorExpired,
      template_unavailable: t.errorTemplateMissing,
      network: t.errorNetwork,
    };
    return (
      <div className="apub" ref={topRef}>
        <div className="apub__card apub__card--center">
          <p className="apub__error">{msgMap[loadError] || t.errorInvalid}</p>
          <button type="button" className="apub__btn" onClick={() => { setLoadError(null); setStep("language"); }}>
            ← {t.back}
          </button>
        </div>
      </div>
    );
  }

  if (step === "consent") {
    const practice = linkData?.practice;
    return (
      <div className="apub" ref={topRef}>
        <div className="apub__card">
          {practice && (
            <div className="apub__practice-header">
              {practice.logoUrl && <img src={practice.logoUrl} alt={practice.displayNameForPatients || practice.practiceName || ""} className="apub__practice-logo" />}
              <p className="apub__practice-name">{practice.displayNameForPatients || practice.practiceName}</p>
            </div>
          )}
          <h1 className="apub__heading">{t.consentHeading}</h1>
          <p className="apub__consent-body">{t.consentBody}</p>
          {t.consentNotice && <p className="apub__consent-notice">{t.consentNotice}</p>}
          <div className="apub__consent-actions">
            <button type="button" className="apub__btn apub__btn--primary" onClick={handleConsentAccept}>
              {t.consentAccept}
            </button>
            <button type="button" className="apub__btn apub__btn--ghost" onClick={handleConsentDecline}>
              {t.consentDecline}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "form") {
    const currentSection = sections[sectionIndex];
    if (!currentSection) return null;
    const sectionTitle = getLabel(currentSection.titleJson, lang);
    return (
      <div className="apub" ref={topRef}>
        <div className="apub__card">
          <div
            className="apub__progress-bar"
            role="progressbar"
            aria-valuenow={sectionIndex + 1}
            aria-valuemin={1}
            aria-valuemax={sections.length}
            aria-label={t?.sectionOf?.replace("{{current}}", sectionIndex + 1).replace("{{total}}", sections.length)}
          >
            <div
              className="apub__progress-fill"
              style={{ width: `${((sectionIndex + 1) / sections.length) * 100}%` }}
            />
          </div>
          <p className="apub__section-counter">
            {t.sectionOf.replace("{{current}}", sectionIndex + 1).replace("{{total}}", sections.length)}
          </p>
          {sectionTitle && <h2 className="apub__section-title">{sectionTitle}</h2>}

          {currentSection.questions.map((q) => (
            <div key={q.id}>
              <QuestionInput
                question={q}
                lang={lang}
                value={answers[q.id]}
                onChange={(val) => dispatch({ type: "SET", questionId: q.id, value: val })}
                t={t}
              />
              {validationErrors[q.id] && (
                <p className="apub__field-error">{t.fieldRequired}</p>
              )}
            </div>
          ))}

          <div className="apub__nav-row">
            <button type="button" className="apub__btn" onClick={handleBack}>← {t.back}</button>
            <button type="button" className="apub__btn apub__btn--primary" onClick={handleNext}>
              {sectionIndex < sections.length - 1 ? t.next : t.reviewHeading} →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="apub" ref={topRef}>
        <div className="apub__card">
          <h1 className="apub__heading">{t.reviewHeading}</h1>
          <p className="apub__subheading">{t.reviewSubheading}</p>

          {sections.map((sec) => (
            <section key={sec.id} className="apub__review-section">
              <h3 className="apub__review-section-title">{getLabel(sec.titleJson, lang)}</h3>
              <ul className="apub__review-answers">
                {sec.questions.map((q) => (
                  <li key={q.id} className="apub__review-row">
                    <span className="apub__review-question">{getLabel(q.labelJson, lang)}</span>
                    <span className="apub__review-value">{formatAnswerForReview(q.type, answers[q.id])}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {submitError && <p className="apub__field-error">{t.errorNetwork}</p>}

          <div className="apub__nav-row">
            <button type="button" className="apub__btn" onClick={handleBack}>← {t.back}</button>
            <button type="button" className="apub__btn apub__btn--primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? t.submitting : t.submit}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="apub" ref={topRef}>
        <div className="apub__card apub__card--center">
          <div className="apub__done-icon" aria-hidden="true">✓</div>
          <h1 className="apub__heading">{t.doneHeading}</h1>
          <p className="apub__subheading">{t.doneCopy}</p>
        </div>
      </div>
    );
  }

  return null;
}
