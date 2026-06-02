import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchPublicAnamnesisLink, submitPublicAnamnesis, translatePublicAnamnesisLabels } from "../api/publicAnamnesisApi.js";
import { generateAnamnesisPdf, normalizePatientSubmission } from "../pdf/anamnesisPdfBuilder.js";
import {
  ANAMNESIS_COMMUNICATION_LANGUAGES,
  ANAMNESIS_UI_LANGUAGE_CODES,
  detectAnamnesisLang,
  getAnamnesisUiLang,
  isAnamnesisRtlLang,
} from "../languages/anamnesisCommunicationLanguages.js";
import "../../practiceAnamnesis/AnamnesisPublic.css";

// Returns best static label for a question in the given language, falling back de → en → first.
function getLabel(json, lang) {
  if (!json || typeof json !== "object") return "";
  return json[lang] || json.de || json.en || Object.values(json)[0] || "";
}

// Lazy-loads anamnesisPublic.js UI strings for the given uiLang (de/en/fr/it/es).
// Falls back to English if the file is missing.
function useT(uiLang) {
  const [msgs, setMsgs] = useState(null);
  useEffect(() => {
    import(`../../../i18n/translations/${uiLang}/anamnesisPublic.js`)
      .then((m) => setMsgs(m.default))
      .catch(() =>
        import("../../../i18n/translations/en/anamnesisPublic.js").then((m) => setMsgs(m.default)),
      );
  }, [uiLang]);
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

const EMPTY_PATIENT_INFO = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  email: "",
  phone: "",
  insuranceType: "",
  insuranceName: "",
  insuranceNumber: "",
};

// ── QuestionInput ─────────────────────────────────────────────────────────────

function QuestionInput({ question, patientLang, labelTranslations, value, onChange, t }) {
  const isRtl = isAnamnesisRtlLang(patientLang);
  const dir = isRtl ? "rtl" : undefined;

  // Label: AI translation takes precedence over static fallback
  const label = labelTranslations.get(`label:${question.id}`) || getLabel(question.labelJson, patientLang);
  const hint = labelTranslations.get(`hint:${question.id}`) || getLabel(question.hintJson, patientLang);
  const id = `q_${question.id}`;

  if (question.type === "yes_no") {
    return (
      <div className="apub__question">
        <p className="apub__question-label" dir={dir}>
          {label}{question.isRequired && <span className="apub__required">*</span>}
        </p>
        {hint && <p className="apub__hint" dir={dir}>{hint}</p>}
        <div className="apub__yn-row">
          <button type="button" className={`apub__yn-btn${value === true ? " apub__yn-btn--active" : ""}`} onClick={() => onChange(true)}>{t?.yes || "Ja"}</button>
          <button type="button" className={`apub__yn-btn${value === false ? " apub__yn-btn--active" : ""}`} onClick={() => onChange(false)}>{t?.no || "Nein"}</button>
        </div>
      </div>
    );
  }

  if (question.type === "single_choice") {
    const options = Array.isArray(question.optionsJson) ? question.optionsJson : [];
    return (
      <div className="apub__question">
        <p className="apub__question-label" dir={dir}>{label}{question.isRequired && <span className="apub__required">*</span>}</p>
        {hint && <p className="apub__hint" dir={dir}>{hint}</p>}
        <div className="apub__options">
          {options.map((opt, i) => {
            const optLabel = getLabel(opt, patientLang);
            return (
              <button key={i} type="button" dir={dir} className={`apub__option-btn${value === optLabel ? " apub__option-btn--active" : ""}`} onClick={() => onChange(optLabel)}>
                {optLabel}
              </button>
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
        <p className="apub__question-label" dir={dir}>{label}{question.isRequired && <span className="apub__required">*</span>}</p>
        {hint && <p className="apub__hint" dir={dir}>{hint}</p>}
        <div className="apub__options">
          {options.map((opt, i) => {
            const optLabel = getLabel(opt, patientLang);
            return (
              <button key={i} type="button" dir={dir} className={`apub__option-btn${selected.includes(optLabel) ? " apub__option-btn--active" : ""}`} onClick={() => toggle(optLabel)}>
                {optLabel}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (question.type === "textarea") {
    const maxLen = question.responseMaxLength ?? 500;
    const currentLen = (value || "").length;
    const nearLimit = currentLen >= maxLen * 0.9;
    const counterId = `counter-${question.id}`;
    return (
      <div className="apub__question">
        <label className="apub__question-label" htmlFor={id} dir={dir}>{label}{question.isRequired && <span className="apub__required">*</span>}</label>
        {hint && <p className="apub__hint" dir={dir}>{hint}</p>}
        <textarea
          id={id}
          className="apub__textarea"
          rows={4}
          dir={dir}
          value={value || ""}
          maxLength={maxLen}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={counterId}
        />
        <span id={counterId} className={`apub__char-counter${nearLimit ? " apub__char-counter--warn" : ""}`} aria-live="polite">
          {t?.charCount
            ? t.charCount.replace("{{current}}", currentLen).replace("{{max}}", maxLen)
            : `${currentLen} / ${maxLen}`}
        </span>
      </div>
    );
  }

  if (question.type === "date") {
    return (
      <div className="apub__question">
        <label className="apub__question-label" htmlFor={id} dir={dir}>{label}{question.isRequired && <span className="apub__required">*</span>}</label>
        {hint && <p className="apub__hint" dir={dir}>{hint}</p>}
        <input id={id} type="date" className="apub__input" value={value || ""} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }

  if (question.type === "number") {
    return (
      <div className="apub__question">
        <label className="apub__question-label" htmlFor={id} dir={dir}>{label}{question.isRequired && <span className="apub__required">*</span>}</label>
        {hint && <p className="apub__hint" dir={dir}>{hint}</p>}
        <input id={id} type="number" className="apub__input apub__input--number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
      </div>
    );
  }

  // Default: text
  const maxLen = question.responseMaxLength ?? 500;
  const currentLen = (value || "").length;
  const nearLimit = currentLen >= maxLen * 0.9;
  const counterId = `counter-${question.id}`;
  return (
    <div className="apub__question">
      <label className="apub__question-label" htmlFor={id} dir={dir}>{label}{question.isRequired && <span className="apub__required">*</span>}</label>
      {hint && <p className="apub__hint" dir={dir}>{hint}</p>}
      <input
        id={id}
        type="text"
        className="apub__input"
        dir={dir}
        value={value || ""}
        maxLength={maxLen}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={counterId}
      />
      <span id={counterId} className={`apub__char-counter${nearLimit ? " apub__char-counter--warn" : ""}`} aria-live="polite">
        {t?.charCount
          ? t.charCount.replace("{{current}}", currentLen).replace("{{max}}", maxLen)
          : `${currentLen} / ${maxLen}`}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnamnesisPublicPage() {
  const { token } = useParams();

  // patientLang: communication language selected by the patient (25+ options)
  // uiLang:      fallback for UI strings — must have anamnesisPublic.js (de/en/fr/it/es)
  const [patientLang, setPatientLang] = useState(detectAnamnesisLang);
  const uiLang = useMemo(() => getAnamnesisUiLang(patientLang), [patientLang]);
  const t = useT(uiLang);

  const [step, setStep] = useState("patientdata");
  const [linkData, setLinkData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [patientInfo, setPatientInfo] = useState(EMPTY_PATIENT_INFO);
  const [consentChecked, setConsentChecked] = useState(false);
  const [patientErrors, setPatientErrors] = useState({});

  const sections = useMemo(() => {
    if (!linkData?.template) return [];
    return (linkData.template.sections || []).filter((s) => s.questions?.length > 0);
  }, [linkData]);

  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, dispatch] = useReducer(answersReducer, {});
  const [validationErrors, setValidationErrors] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submittedContext, setSubmittedContext] = useState(null);
  const [pdfError, setPdfError] = useState(false);

  // AI question-label translations: Map<"label:qId"|"hint:qId", translatedText>
  const labelTranslationCache = useRef(new Map()); // in-memory per lang, not persisted
  const [questionLabelTranslations, setQuestionLabelTranslations] = useState(new Map());
  const [translatingLabels, setTranslatingLabels] = useState(false);

  const topRef = useRef(null);
  const scrollTop = useCallback(() => topRef.current?.scrollIntoView({ behavior: "smooth" }), []);

  const loadLink = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { res, data } = await fetchPublicAnamnesisLink(token);
      if (!res.ok) { setLoadError(data?.error || "link_not_found"); return; }
      setLinkData(data);
    } catch {
      setLoadError("network");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadLink(); }, [loadLink]);

  // When patientLang changes to a language without static UI translations,
  // fetch AI translations of question labels (only question text, no patient data).
  useEffect(() => {
    if (!linkData || loading) return;

    // de always has translations; fr/it/es rely on static labelJson for those languages
    if (patientLang === "de" || ANAMNESIS_UI_LANGUAGE_CODES.includes(patientLang)) {
      setQuestionLabelTranslations(new Map());
      return;
    }

    // Return from cache if already translated
    if (labelTranslationCache.current.has(patientLang)) {
      setQuestionLabelTranslations(labelTranslationCache.current.get(patientLang));
      return;
    }

    // Collect de-language labels and hints to translate
    const allQuestions = sections.flatMap((s) => s.questions || []);
    const labelsToTranslate = allQuestions.flatMap((q) => {
      const items = [];
      const labelText = q.labelJson?.de || q.labelJson?.en || Object.values(q.labelJson || {})[0] || "";
      if (labelText.trim()) items.push({ id: `label:${q.id}`, text: labelText });
      const hintText = q.hintJson?.de || q.hintJson?.en || Object.values(q.hintJson || {})[0] || "";
      if (hintText.trim()) items.push({ id: `hint:${q.id}`, text: hintText });
      return items;
    });

    if (!labelsToTranslate.length) return;

    setTranslatingLabels(true);
    translatePublicAnamnesisLabels(token, { targetLang: patientLang, sourceLang: "de", labels: labelsToTranslate })
      .then(({ data }) => {
        if (!data?.ok || !Array.isArray(data.translations)) return;
        const map = new Map();
        for (const tr of data.translations) {
          if (tr.id && tr.translatedText) map.set(tr.id, tr.translatedText);
        }
        labelTranslationCache.current.set(patientLang, map);
        setQuestionLabelTranslations(map);
      })
      .catch(() => {}) // Silent fallback — form still works with de/en labels
      .finally(() => setTranslatingLabels(false));
  }, [patientLang, linkData, loading, sections, token]);

  const validatePatientData = () => {
    const errs = {};
    if (!patientInfo.firstName.trim()) errs.firstName = true;
    if (!patientInfo.lastName.trim()) errs.lastName = true;
    if (!patientInfo.dateOfBirth.trim()) errs.dateOfBirth = true;
    if (!consentChecked) errs.consent = true;
    setPatientErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePatientDataContinue = () => {
    if (!validatePatientData()) return;
    setStep("form");
    setSectionIndex(0);
    scrollTop();
  };

  const handlePatientInfoChange = (field, value) => {
    setPatientInfo((prev) => ({ ...prev, [field]: value }));
    if (patientErrors[field]) setPatientErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
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
    if (sectionIndex < sections.length - 1) { setSectionIndex((i) => i + 1); scrollTop(); }
    else { setStep("review"); scrollTop(); }
  };

  const handleBack = () => {
    if (step === "form") {
      if (sectionIndex > 0) { setSectionIndex((i) => i - 1); scrollTop(); }
      else { setStep("patientdata"); scrollTop(); }
    } else if (step === "review") {
      setStep("form");
      setSectionIndex(sections.length - 1);
      scrollTop();
    }
  };

  const buildAnswersJson = useCallback(() => {
    const result = [];
    for (const sec of sections) {
      const secLabel = getLabel(sec.titleJson, patientLang);
      for (const q of sec.questions) {
        const displayLabel = questionLabelTranslations.get(`label:${q.id}`) || getLabel(q.labelJson, patientLang);
        result.push({
          questionId: q.id,
          sectionId: sec.id,
          sectionLabel: secLabel,
          questionLabel: displayLabel,
          type: q.type,
          value: answers[q.id] ?? null,
        });
      }
    }
    return result;
  }, [sections, answers, patientLang, questionLabelTranslations]);

  const buildCleanPatientInfo = () => ({
    firstName: patientInfo.firstName.trim() || null,
    lastName: patientInfo.lastName.trim() || null,
    dateOfBirth: patientInfo.dateOfBirth.trim() || null,
    email: patientInfo.email.trim() || null,
    phone: patientInfo.phone.trim() || null,
    insuranceType: patientInfo.insuranceType || null,
    insuranceName: patientInfo.insuranceName.trim() || null,
    insuranceNumber: patientInfo.insuranceNumber.trim() || null,
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const doctorLang = linkData?.practice?.preferredDoctorLanguage || "de";
      const { res, data } = await submitPublicAnamnesis(token, {
        patientLanguage: patientLang,
        doctorLanguage: doctorLang,
        answersJson: buildAnswersJson(),
        patientInfo: buildCleanPatientInfo(),
        consentScopes: ["anamnesis_data"],
      });
      if (!res.ok) { setSubmitError(data?.error || "request_failed"); setSubmitting(false); return; }
      sessionStorage.removeItem(`anamnesis_draft_${token}`);
      setSubmittedContext({
        submissionId: data?.submissionId || "",
        patientInfo: buildCleanPatientInfo(),
        answersJson: buildAnswersJson(),
        practice: linkData?.practice || null,
        templateTitle: getLabel(linkData?.template?.titleJson, patientLang) || null,
        lang: patientLang,
      });
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

  const errorMsgMap = {
    link_not_found: t.errorInvalid,
    link_disabled: t.errorDisabled,
    link_expired: t.errorExpired,
    template_unavailable: t.errorTemplateMissing,
    network: t.errorNetwork,
  };

  if (loadError) {
    return (
      <div className="apub" ref={topRef}>
        <div className="apub__card apub__card--center">
          <p className="apub__error">{errorMsgMap[loadError] || t.errorInvalid}</p>
          <button type="button" className="apub__btn" onClick={() => { setLoadError(null); loadLink(); }}>{t.back}</button>
        </div>
      </div>
    );
  }

  // ── Step: patient data + language selection ────────────────────────────────
  if (step === "patientdata") {
    const practice = linkData?.practice;
    const doctorLangCode = practice?.preferredDoctorLanguage || "de";
    const doctorLangName = ANAMNESIS_COMMUNICATION_LANGUAGES.find((l) => l.code === doctorLangCode)?.nativeName || doctorLangCode;

    const insuranceOptions = [
      { value: "gkv", label: t.insuranceTypeGkv || "GKV" },
      { value: "pkv", label: t.insuranceTypePkv || "PKV" },
      { value: "self_pay", label: t.insuranceTypeSelfPay || "Selbstzahler" },
      { value: "other", label: t.insuranceTypeOther || "Sonstige" },
    ];

    return (
      <div className="apub" ref={topRef}>
        <div className="apub__card">
          {loading && <p className="apub__loading">{t.loading}</p>}
          {!loading && practice && (
            <div className="apub__practice-header">
              {practice.logoUrl && <img src={practice.logoUrl} alt={practice.displayNameForPatients || practice.practiceName || ""} className="apub__practice-logo" />}
              <p className="apub__practice-name">{practice.displayNameForPatients || practice.practiceName}</p>
            </div>
          )}

          <h1 className="apub__heading">{t.languageHeading}</h1>
          <p className="apub__subheading">{t.languageSubheading}</p>
          <div className="apub__lang-grid">
            {ANAMNESIS_COMMUNICATION_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                lang={l.code}
                className={`apub__lang-btn${patientLang === l.code ? " apub__lang-btn--active" : ""}`}
                onClick={() => setPatientLang(l.code)}
              >
                {l.nativeName}
              </button>
            ))}
          </div>

          {t.practiceLanguageLabel && (
            <p className="apub__practice-lang">
              <span className="apub__practice-lang-label">{t.practiceLanguageLabel}:</span>{" "}
              {doctorLangName}
            </p>
          )}

          <h2 className="apub__section-title">{t.patientDataHeading}</h2>
          {t.patientDataSubheading && <p className="apub__subheading">{t.patientDataSubheading}</p>}

          <div className="apub__patient-form">
            <div className="apub__patient-row apub__patient-row--2col">
              <div className="apub__patient-field">
                <label className="apub__question-label" htmlFor="pd_firstName">{t.firstName}<span className="apub__required">*</span></label>
                <input id="pd_firstName" type="text" className={`apub__input${patientErrors.firstName ? " apub__input--error" : ""}`} value={patientInfo.firstName} onChange={(e) => handlePatientInfoChange("firstName", e.target.value)} autoComplete="given-name" />
                {patientErrors.firstName && <p className="apub__field-error">{t.fieldRequired}</p>}
              </div>
              <div className="apub__patient-field">
                <label className="apub__question-label" htmlFor="pd_lastName">{t.lastName}<span className="apub__required">*</span></label>
                <input id="pd_lastName" type="text" className={`apub__input${patientErrors.lastName ? " apub__input--error" : ""}`} value={patientInfo.lastName} onChange={(e) => handlePatientInfoChange("lastName", e.target.value)} autoComplete="family-name" />
                {patientErrors.lastName && <p className="apub__field-error">{t.fieldRequired}</p>}
              </div>
            </div>

            <div className="apub__patient-field">
              <label className="apub__question-label" htmlFor="pd_dob">{t.dateOfBirth}<span className="apub__required">*</span></label>
              <input id="pd_dob" type="date" className={`apub__input${patientErrors.dateOfBirth ? " apub__input--error" : ""}`} value={patientInfo.dateOfBirth} onChange={(e) => handlePatientInfoChange("dateOfBirth", e.target.value)} autoComplete="bday" />
              {patientErrors.dateOfBirth && <p className="apub__field-error">{t.fieldRequired}</p>}
            </div>

            <div className="apub__patient-row apub__patient-row--2col">
              <div className="apub__patient-field">
                <label className="apub__question-label" htmlFor="pd_email">{t.email} <span className="apub__optional">({t.optional})</span></label>
                <input id="pd_email" type="email" className="apub__input" value={patientInfo.email} onChange={(e) => handlePatientInfoChange("email", e.target.value)} autoComplete="email" />
              </div>
              <div className="apub__patient-field">
                <label className="apub__question-label" htmlFor="pd_phone">{t.phone} <span className="apub__optional">({t.optional})</span></label>
                <input id="pd_phone" type="tel" className="apub__input" value={patientInfo.phone} onChange={(e) => handlePatientInfoChange("phone", e.target.value)} autoComplete="tel" />
              </div>
            </div>

            <div className="apub__patient-field">
              <label className="apub__question-label" htmlFor="pd_insuranceType">{t.insuranceType} <span className="apub__optional">({t.optional})</span></label>
              <select id="pd_insuranceType" className="apub__select" value={patientInfo.insuranceType} onChange={(e) => handlePatientInfoChange("insuranceType", e.target.value)}>
                <option value="">{t.insuranceTypePlaceholder || "—"}</option>
                {insuranceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {patientInfo.insuranceType && patientInfo.insuranceType !== "self_pay" && (
              <div className="apub__patient-row apub__patient-row--2col">
                <div className="apub__patient-field">
                  <label className="apub__question-label" htmlFor="pd_insuranceName">{t.insuranceName} <span className="apub__optional">({t.optional})</span></label>
                  <input id="pd_insuranceName" type="text" className="apub__input" value={patientInfo.insuranceName} onChange={(e) => handlePatientInfoChange("insuranceName", e.target.value)} />
                </div>
                <div className="apub__patient-field">
                  <label className="apub__question-label" htmlFor="pd_insuranceNumber">{t.insuranceNumber} <span className="apub__optional">({t.optional})</span></label>
                  <input id="pd_insuranceNumber" type="text" className="apub__input" value={patientInfo.insuranceNumber} onChange={(e) => handlePatientInfoChange("insuranceNumber", e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="apub__consent-block">
            <h3 className="apub__consent-heading">{t.consentHeading}</h3>
            <p className="apub__consent-body">{t.consentBody}</p>
            {t.consentNotice && <p className="apub__consent-notice">{t.consentNotice}</p>}
            <label className={`apub__consent-checkbox-label${patientErrors.consent ? " apub__consent-checkbox-label--error" : ""}`}>
              <input type="checkbox" className="apub__consent-checkbox" checked={consentChecked} onChange={(e) => { setConsentChecked(e.target.checked); if (patientErrors.consent) setPatientErrors((prev) => { const n = { ...prev }; delete n.consent; return n; }); }} />
              <span>{t.consentCheckboxLabel}</span>
            </label>
            {patientErrors.consent && <p className="apub__field-error">{t.consentRequired}</p>}
          </div>

          <button type="button" className="apub__btn apub__btn--primary" onClick={handlePatientDataContinue} disabled={loading}>
            {t.patientDataContinue || t.next}
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

  // ── Step: form ─────────────────────────────────────────────────────────────
  if (step === "form") {
    const currentSection = sections[sectionIndex];
    if (!currentSection) return null;
    const sectionTitle = getLabel(currentSection.titleJson, patientLang);
    const isRtl = isAnamnesisRtlLang(patientLang);

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
            <div className="apub__progress-fill" style={{ width: `${((sectionIndex + 1) / sections.length) * 100}%` }} />
          </div>
          <p className="apub__section-counter">
            {t.sectionOf.replace("{{current}}", sectionIndex + 1).replace("{{total}}", sections.length)}
          </p>
          {sectionTitle && <h2 className="apub__section-title" dir={isRtl ? "rtl" : undefined}>{sectionTitle}</h2>}

          {translatingLabels && (
            <p className="apub__translating">{t.translatingQuestions || "…"}</p>
          )}

          {currentSection.questions.map((q) => (
            <div key={q.id}>
              <QuestionInput
                question={q}
                patientLang={patientLang}
                labelTranslations={questionLabelTranslations}
                value={answers[q.id]}
                onChange={(val) => dispatch({ type: "SET", questionId: q.id, value: val })}
                t={t}
              />
              {validationErrors[q.id] && <p className="apub__field-error">{t.fieldRequired}</p>}
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

  // ── Step: review ──────────────────────────────────────────────────────────
  if (step === "review") {
    const isRtl = isAnamnesisRtlLang(patientLang);
    return (
      <div className="apub" ref={topRef}>
        <div className="apub__card">
          <h1 className="apub__heading">{t.reviewHeading}</h1>
          <p className="apub__subheading">{t.reviewSubheading}</p>

          {sections.map((sec) => (
            <section key={sec.id} className="apub__review-section">
              <h3 className="apub__review-section-title">{getLabel(sec.titleJson, patientLang)}</h3>
              <ul className="apub__review-answers">
                {sec.questions.map((q) => {
                  const label = questionLabelTranslations.get(`label:${q.id}`) || getLabel(q.labelJson, patientLang);
                  return (
                    <li key={q.id} className="apub__review-row">
                      <span className="apub__review-question">{label}</span>
                      <span className="apub__review-value" dir={isRtl ? "rtl" : undefined}>
                        {formatAnswerForReview(q.type, answers[q.id])}
                      </span>
                    </li>
                  );
                })}
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

  // ── Step: done ─────────────────────────────────────────────────────────────
  if (step === "done") {
    const handlePatientPdf = () => {
      if (!submittedContext) return;
      setPdfError(false);
      const pdfData = normalizePatientSubmission(submittedContext);
      const ok = generateAnamnesisPdf(pdfData, `anamnesis-${submittedContext.lang}-${Date.now()}.pdf`);
      if (!ok) setPdfError(true);
    };

    return (
      <div className="apub" ref={topRef}>
        <div className="apub__card apub__card--center">
          <div className="apub__done-icon" aria-hidden="true">✓</div>
          <h1 className="apub__heading">{t.doneHeading}</h1>
          <p className="apub__subheading">{t.doneCopy}</p>
          {submittedContext && (
            <div className="apub__pdf-section">
              <button type="button" className="apub__btn apub__btn--primary apub__btn--pdf" onClick={handlePatientPdf}>
                ↓ {t.pdfDownload || "PDF herunterladen"}
              </button>
              <p className="apub__pdf-hint">{t.pdfSafetyHint}</p>
              <p className="apub__pdf-hint">{t.pdfSharingHint}</p>
              {pdfError && <p className="apub__field-error">{t.pdfError}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
