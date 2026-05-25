import { useId, useState } from "react";

const TYPES = ["blood_pressure", "heart_rate", "glucose", "weight", "oxygen", "temperature"];
const DEFAULT_UNITS = {
  blood_pressure: "mmHg",
  heart_rate: "bpm",
  glucose: "mg/dL",
  weight: "kg",
  oxygen: "%",
  temperature: "°C",
};
const VALUE_RANGES = {
  blood_pressure: { primary: [40, 300], secondary: [20, 200] },
  heart_rate: { primary: [20, 300] },
  glucose: { primary: [20, 1000] },
  weight: { primary: [10, 700] },
  oxygen: { primary: [50, 100] },
  temperature: { primary: [25, 45] },
};

function nowLocal() {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

function toLocalDatetimeValue(isoStr) {
  if (!isoStr) return nowLocal();
  try {
    const d = new Date(isoStr);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d - offset).toISOString().slice(0, 16);
  } catch {
    return nowLocal();
  }
}

export default function VitalForm({ t, initial = null, onSave, onCancel, saving }) {
  const uid = useId();

  const [type, setType] = useState(initial?.type || "");
  const [valuePrimary, setValuePrimary] = useState(
    initial?.valuePrimary != null ? String(initial.valuePrimary) : ""
  );
  const [valueSecondary, setValueSecondary] = useState(
    initial?.valueSecondary != null ? String(initial.valueSecondary) : ""
  );
  const [unit, setUnit] = useState(initial?.unit || "");
  const [measuredAt, setMeasuredAt] = useState(toLocalDatetimeValue(initial?.measuredAt));
  const [notes, setNotes] = useState(initial?.notes || "");
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");

  function clearErr(k) {
    setErrors(prev => ({ ...prev, [k]: undefined }));
  }

  function handleTypeChange(val) {
    setType(val);
    setUnit(DEFAULT_UNITS[val] || "");
    setValuePrimary("");
    setValueSecondary("");
    setErrors({});
  }

  function validate() {
    const errs = {};
    if (!type) { errs.type = t.form.fieldRequired; return errs; }
    const ranges = VALUE_RANGES[type];
    const p = parseFloat(valuePrimary.replace(",", "."));
    if (!valuePrimary.trim()) {
      errs.valuePrimary = t.form.fieldRequired;
    } else if (!Number.isFinite(p)) {
      errs.valuePrimary = t.form.valueInvalid;
    } else if (ranges?.primary && (p < ranges.primary[0] || p > ranges.primary[1])) {
      errs.valuePrimary = t.form.valueOutOfRange;
    }
    if (type === "blood_pressure") {
      const s = parseFloat(valueSecondary.replace(",", "."));
      if (!valueSecondary.trim()) {
        errs.valueSecondary = t.form.fieldRequired;
      } else if (!Number.isFinite(s)) {
        errs.valueSecondary = t.form.valueInvalid;
      } else if (s < 20 || s > 200) {
        errs.valueSecondary = t.form.valueOutOfRange;
      }
    }
    if (!measuredAt) {
      errs.measuredAt = t.form.fieldRequired;
    } else if (new Date(measuredAt) > new Date()) {
      errs.measuredAt = t.form.dateFuture;
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaveError("");
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    try {
      await onSave({
        type,
        valuePrimary: parseFloat(valuePrimary.replace(",", ".")),
        valueSecondary: type === "blood_pressure" ? parseFloat(valueSecondary.replace(",", ".")) : undefined,
        unit: unit || DEFAULT_UNITS[type] || "",
        measuredAt: new Date(measuredAt).toISOString(),
        notes: notes.trim() || null,
      });
    } catch {
      setSaveError(t.form.saveError);
    }
  }

  const isBP = type === "blood_pressure";

  return (
    <form className="vitals-form" onSubmit={handleSubmit} noValidate>
      <h2 className="vitals-form__title">
        {initial ? t.form.editHeading : t.form.addHeading}
      </h2>

      <div className="vitals-form__grid">
        {/* Type selector */}
        <div className="vitals-form__field vitals-form__field--full">
          <label className="vitals-form__label" htmlFor={`${uid}-type`}>
            {t.form.typeLabel}
          </label>
          <select
            id={`${uid}-type`}
            className={`vitals-form__select${errors.type ? " vitals-form__select--error" : ""}`}
            value={type}
            onChange={e => { handleTypeChange(e.target.value); clearErr("type"); }}
            aria-required="true"
            disabled={!!initial}
          >
            <option value="">{t.form.typePlaceholder}</option>
            {TYPES.map(tp => (
              <option key={tp} value={tp}>{t.types[tp]}</option>
            ))}
          </select>
          {errors.type && <span className="vitals-form__error-msg" role="alert">{errors.type}</span>}
        </div>

        {/* Blood pressure: two fields */}
        {isBP ? (
          <>
            <div className="vitals-form__field">
              <label className="vitals-form__label" htmlFor={`${uid}-sys`}>
                {t.form.systolic}
              </label>
              <input
                id={`${uid}-sys`}
                className={`vitals-form__input${errors.valuePrimary ? " vitals-form__input--error" : ""}`}
                type="number"
                inputMode="numeric"
                value={valuePrimary}
                onChange={e => { setValuePrimary(e.target.value); clearErr("valuePrimary"); }}
                placeholder={t.form.systolicPlaceholder}
                min={40} max={300}
                aria-required="true"
              />
              {errors.valuePrimary && <span className="vitals-form__error-msg" role="alert">{errors.valuePrimary}</span>}
            </div>
            <div className="vitals-form__field">
              <label className="vitals-form__label" htmlFor={`${uid}-dia`}>
                {t.form.diastolic}
              </label>
              <input
                id={`${uid}-dia`}
                className={`vitals-form__input${errors.valueSecondary ? " vitals-form__input--error" : ""}`}
                type="number"
                inputMode="numeric"
                value={valueSecondary}
                onChange={e => { setValueSecondary(e.target.value); clearErr("valueSecondary"); }}
                placeholder={t.form.diastolicPlaceholder}
                min={20} max={200}
                aria-required="true"
              />
              {errors.valueSecondary && <span className="vitals-form__error-msg" role="alert">{errors.valueSecondary}</span>}
            </div>
          </>
        ) : type ? (
          <div className="vitals-form__field">
            <label className="vitals-form__label" htmlFor={`${uid}-val`}>
              {t.form.value} ({unit || DEFAULT_UNITS[type]})
            </label>
            <input
              id={`${uid}-val`}
              className={`vitals-form__input${errors.valuePrimary ? " vitals-form__input--error" : ""}`}
              type="number"
              inputMode="decimal"
              step="any"
              value={valuePrimary}
              onChange={e => { setValuePrimary(e.target.value); clearErr("valuePrimary"); }}
              aria-required="true"
            />
            {errors.valuePrimary && <span className="vitals-form__error-msg" role="alert">{errors.valuePrimary}</span>}
          </div>
        ) : null}

        {/* Date/time */}
        {type && (
          <div className="vitals-form__field">
            <label className="vitals-form__label" htmlFor={`${uid}-date`}>
              {t.form.measuredAt}
            </label>
            <input
              id={`${uid}-date`}
              className={`vitals-form__input${errors.measuredAt ? " vitals-form__input--error" : ""}`}
              type="datetime-local"
              value={measuredAt}
              max={nowLocal()}
              onChange={e => { setMeasuredAt(e.target.value); clearErr("measuredAt"); }}
              aria-required="true"
            />
            {errors.measuredAt && <span className="vitals-form__error-msg" role="alert">{errors.measuredAt}</span>}
          </div>
        )}

        {/* Notes */}
        {type && (
          <div className="vitals-form__field vitals-form__field--full">
            <label className="vitals-form__label" htmlFor={`${uid}-notes`}>
              {t.form.notes}
            </label>
            <textarea
              id={`${uid}-notes`}
              className="vitals-form__textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t.form.notesPlaceholder}
              rows={2}
            />
          </div>
        )}
      </div>

      <p className="vitals-form__required-note">{t.form.required}</p>

      <div className="vitals-form__actions">
        <button type="submit" className="vitals-form__save-btn" disabled={saving || !type}>
          {saving ? t.form.saving : t.form.save}
        </button>
        <button type="button" className="vitals-form__cancel-btn" onClick={onCancel} disabled={saving}>
          {t.form.cancel}
        </button>
      </div>

      {saveError && <p className="vitals-form__save-error" role="alert">{saveError}</p>}
    </form>
  );
}
