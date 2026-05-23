import { useCallback, useEffect, useMemo, useId, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { getMessages } from "../../i18n/translations/index.js";
import { authFetch } from "../../api/authFetch.js";
import { computeBmi } from "../../utils/healthMetrics.js";

const INSURANCE_OPTIONS = [
  "statutory",
  "private",
  "self_pay",
  "other",
  "prefer_not_say",
];
const SMOKING_OPTIONS = [
  "never",
  "former",
  "occasional",
  "daily",
  "prefer_not_say",
];
const ALCOHOL_OPTIONS = ["never", "occasional", "regular", "prefer_not_say"];

const EMPTY = {
  firstName: "",
  lastName: "",
  insuranceType: "",
  heightCm: "",
  weightKg: "",
  allergies: "",
  chronicConditions: "",
  regularMedications: "",
  smokingStatus: "",
  alcoholUse: "",
};

export default function AccountHealthProfilePage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.accountPortal ?? getMessages("en").accountPortal;
  }, [language]);

  const bmiHintId = useId();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const bmi = useMemo(
    () => computeBmi(form.heightCm, form.weightKg),
    [form.heightCm, form.weightKg],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/account/patient-settings");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      const u = j.user || {};
      const p = j.profile || {};
      setForm({
        firstName: u.firstName || "",
        lastName: u.lastName || "",
        insuranceType: p.insuranceType || "",
        heightCm: p.heightCm != null ? String(p.heightCm) : "",
        weightKg: p.weightKg != null ? String(p.weightKg) : "",
        allergies: p.allergies || "",
        chronicConditions: p.chronicConditions || "",
        regularMedications: p.regularMedications || "",
        smokingStatus: p.smokingStatus || "",
        alcoholUse: p.alcoholUse || "",
      });
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.title = `${t.healthProfileTitle} — MedScoutX`;
  }, [t.healthProfileTitle]);

  function upd(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setOk(false);
  }

  function validateMetrics() {
    if (form.heightCm !== "") {
      const h = Number(form.heightCm);
      if (!Number.isFinite(h) || h < 50 || h > 250) return t.healthInvalidHeight;
    }
    if (form.weightKg !== "") {
      const w = Number(form.weightKg);
      if (!Number.isFinite(w) || w < 20 || w > 500) return t.healthInvalidWeight;
    }
    return "";
  }

  async function onSubmit(e) {
    e.preventDefault();
    const metricError = validateMetrics();
    if (metricError) {
      setError(metricError);
      setOk(false);
      return;
    }
    setSaving(true);
    setError("");
    setOk(false);
    try {
      const res = await authFetch("/api/account/patient-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insuranceType: form.insuranceType || null,
          heightCm: form.heightCm === "" ? null : Number(form.heightCm),
          weightKg: form.weightKg === "" ? null : Number(form.weightKg),
          allergies: form.allergies || null,
          chronicConditions: form.chronicConditions || null,
          regularMedications: form.regularMedications || null,
          smokingStatus: form.smokingStatus || null,
          alcoholUse: form.alcoholUse || null,
        }),
      });
      if (!res.ok) throw new Error();
      setOk(true);
      void load();
    } catch (e2) {
      if (e2?.message === "SESSION_EXPIRED") return;
      setError(t.saveError);
    } finally {
      setSaving(false);
    }
  }

  function optionLabel(prefix, value) {
    const part = value
      .split("_")
      .map((p, i) =>
        i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1),
      )
      .join("");
    const key = `${prefix}${part.charAt(0).toUpperCase()}${part.slice(1)}`;
    return t[key] ?? value;
  }

  if (loading) return <p className="account-portal-card__empty">{t.loading}</p>;

  const fullName = [form.firstName, form.lastName].filter(Boolean).join(" ").trim();

  return (
    <div className="account-portal-page">
      <Link className="account-portal-page__back" to="/patient">
        {t.backPatientHub}
      </Link>
      <h1 className="account-portal-page__title">{t.healthProfileTitle}</h1>
      <p className="account-portal-page__lead">{t.healthProfileIntro}</p>
      <p className="account-portal-page__notice" role="note">
        {t.healthProfileDisclaimer}
      </p>

      {error ? (
        <p className="account-portal__error" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="account-portal__ok" role="status">
          {t.save}
        </p>
      ) : null}

      <p className="account-portal-form__hint">
        {t.healthProfileNameHint}{" "}
        <Link to="/account/personal" className="account-portal-form__inline-link">
          {t.navPersonal}
        </Link>
        {fullName ? (
          <>
            {" "}
            — <strong>{fullName}</strong>
          </>
        ) : null}
      </p>

      <form
        className="account-portal-form account-portal-form--wide"
        onSubmit={onSubmit}
        noValidate
        aria-label={t.healthProfileTitle}
      >
        <fieldset className="account-portal-form__section">
          <legend>{t.healthSectionInsurance}</legend>
          <div
            className="account-portal-form__radio-group"
            role="radiogroup"
            aria-label={t.fieldInsurance}
          >
            {INSURANCE_OPTIONS.map((value) => (
              <label key={value} className="account-portal-form__radio">
                <input
                  type="radio"
                  name="insuranceType"
                  value={value}
                  checked={form.insuranceType === value}
                  onChange={() => upd("insuranceType", value)}
                />
                <span>{optionLabel("insurance", value)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="account-portal-form__section">
          <legend>{t.healthSectionBody}</legend>
          <div className="account-portal-form__row">
            <label className="account-portal-form__field">
              {t.fieldHeightCm}
              <input
                className="account-portal-form__input"
                type="number"
                inputMode="numeric"
                min={50}
                max={250}
                step={1}
                value={form.heightCm}
                onChange={(e) => upd("heightCm", e.target.value)}
                placeholder={t.placeholderHeight}
                autoComplete="off"
              />
            </label>
            <label className="account-portal-form__field">
              {t.fieldWeightKg}
              <input
                className="account-portal-form__input"
                type="number"
                inputMode="decimal"
                min={20}
                max={500}
                step={0.1}
                value={form.weightKg}
                onChange={(e) => upd("weightKg", e.target.value)}
                placeholder={t.placeholderWeight}
                autoComplete="off"
              />
            </label>
          </div>
          <p
            id={bmiHintId}
            className="account-portal-form__bmi"
            aria-live="polite"
          >
            {bmi != null
              ? t.bmiDisplay.replace("{value}", String(bmi))
              : t.bmiEmpty}
          </p>
          <p className="account-portal-form__hint">{t.bmiDisclaimer}</p>
        </fieldset>

        <fieldset className="account-portal-form__section">
          <legend>{t.healthSectionHistory}</legend>
          <label className="account-portal-form__field">
            {t.fieldAllergies}
            <textarea
              className="account-portal-form__textarea"
              rows={3}
              maxLength={4000}
              value={form.allergies}
              onChange={(e) => upd("allergies", e.target.value)}
              placeholder={t.placeholderAllergies}
              autoComplete="off"
            />
          </label>
          <label className="account-portal-form__field">
            {t.fieldChronicConditions}
            <textarea
              className="account-portal-form__textarea"
              rows={3}
              maxLength={4000}
              value={form.chronicConditions}
              onChange={(e) => upd("chronicConditions", e.target.value)}
              placeholder={t.placeholderChronic}
              autoComplete="off"
            />
          </label>
          <label className="account-portal-form__field">
            {t.fieldMedications}
            <textarea
              className="account-portal-form__textarea"
              rows={3}
              maxLength={4000}
              value={form.regularMedications}
              onChange={(e) => upd("regularMedications", e.target.value)}
              placeholder={t.placeholderMedications}
              autoComplete="off"
            />
          </label>
          <p className="account-portal-form__hint">{t.medicationsProfileHint}</p>
        </fieldset>

        <fieldset className="account-portal-form__section">
          <legend>{t.healthSectionLifestyle}</legend>
          <label className="account-portal-form__field">
            {t.fieldSmoking}
            <select
              className="account-portal-form__input"
              value={form.smokingStatus}
              onChange={(e) => upd("smokingStatus", e.target.value)}
            >
              <option value="">{t.selectOptional}</option>
              {SMOKING_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {optionLabel("smoking", value)}
                </option>
              ))}
            </select>
          </label>
          <label className="account-portal-form__field">
            {t.fieldAlcohol}
            <select
              className="account-portal-form__input"
              value={form.alcoholUse}
              onChange={(e) => upd("alcoholUse", e.target.value)}
            >
              <option value="">{t.selectOptional}</option>
              {ALCOHOL_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {optionLabel("alcohol", value)}
                </option>
              ))}
            </select>
          </label>
          <p className="account-portal-form__hint">{t.alcoholOptionalHint}</p>
        </fieldset>

        <button
          type="submit"
          className="account-portal__btn account-portal__btn--primary"
          disabled={saving}
        >
          {saving ? t.saving : t.save}
        </button>
      </form>
    </div>
  );
}
