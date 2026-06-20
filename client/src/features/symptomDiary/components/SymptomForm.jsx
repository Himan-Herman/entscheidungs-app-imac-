import { useEffect, useRef, useState } from "react";
import "../styles/SymptomDiary.css";

/** Convert an ISO timestamp (or now) to a value usable by <input type="datetime-local">. */
function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SymptomForm({ initial, t, onSave, onCancel, saving }) {
  const [symptom, setSymptom] = useState(initial?.symptom || "");
  const [severity, setSeverity] = useState(
    Number.isInteger(initial?.severity) ? initial.severity : 5,
  );
  const [occurredAt, setOccurredAt] = useState(toLocalInput(initial?.occurredAt));
  const [durationText, setDurationText] = useState(initial?.durationText || "");
  const [bodyRegion, setBodyRegion] = useState(initial?.bodyRegion || "");
  const [trigger, setTrigger] = useState(initial?.trigger || "");
  const [betterWith, setBetterWith] = useState(initial?.betterWith || "");
  const [worseWith, setWorseWith] = useState(initial?.worseWith || "");
  const [measuresText, setMeasuresText] = useState(initial?.measuresText || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [error, setError] = useState("");
  const symptomRef = useRef(null);

  useEffect(() => {
    symptomRef.current?.focus();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!symptom.trim()) {
      setError(t.error_symptomRequired);
      return;
    }
    if (!occurredAt) {
      setError(t.error_occurredAtRequired);
      return;
    }
    setError("");
    onSave({
      symptom: symptom.trim(),
      severity: Number(severity),
      occurredAt: new Date(occurredAt).toISOString(),
      durationText: durationText.trim() || null,
      bodyRegion: bodyRegion.trim() || null,
      trigger: trigger.trim() || null,
      betterWith: betterWith.trim() || null,
      worseWith: worseWith.trim() || null,
      measuresText: measuresText.trim() || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <div
      className="sd-form-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sd-form-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <form className="sd-form-panel" onSubmit={handleSubmit} noValidate>
        <h2 id="sd-form-title" className="sd-form__title">
          {initial ? t.editTitle : t.addTitle}
        </h2>

        {error && <p className="sd-form__error" role="alert">{error}</p>}

        <div className="sd-form__group">
          <label className="sd-form__label" htmlFor="sd-symptom">{t.symptomLabel} *</label>
          <input
            id="sd-symptom"
            ref={symptomRef}
            className="sd-form__input"
            value={symptom}
            maxLength={200}
            placeholder={t.symptomPlaceholder}
            onChange={(e) => setSymptom(e.target.value)}
            required
          />
        </div>

        <div className="sd-form__group">
          <div className="sd-sev-head">
            <label className="sd-form__label" htmlFor="sd-severity">{t.severityLabel}</label>
            <span className="sd-sev-value" aria-hidden="true">{severity}/10</span>
          </div>
          <input
            id="sd-severity"
            className="sd-sev-range"
            type="range"
            min={0}
            max={10}
            step={1}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            aria-valuetext={`${severity} / 10`}
          />
          <div className="sd-sev-scale"><span>0</span><span>10</span></div>
        </div>

        <div className="sd-form__group">
          <label className="sd-form__label" htmlFor="sd-occurredAt">{t.occurredAtLabel} *</label>
          <input
            id="sd-occurredAt"
            className="sd-form__input"
            type="datetime-local"
            value={occurredAt}
            max={toLocalInput(new Date().toISOString())}
            onChange={(e) => setOccurredAt(e.target.value)}
            required
          />
        </div>

        <div className="sd-form__row">
          <div className="sd-form__group">
            <label className="sd-form__label" htmlFor="sd-duration">{t.durationLabel}</label>
            <input id="sd-duration" className="sd-form__input" value={durationText} maxLength={120}
              placeholder={t.durationPlaceholder} onChange={(e) => setDurationText(e.target.value)} />
          </div>
          <div className="sd-form__group">
            <label className="sd-form__label" htmlFor="sd-bodyRegion">{t.bodyRegionLabel}</label>
            <input id="sd-bodyRegion" className="sd-form__input" value={bodyRegion} maxLength={120}
              placeholder={t.bodyRegionPlaceholder} onChange={(e) => setBodyRegion(e.target.value)} />
          </div>
        </div>

        <div className="sd-form__group">
          <label className="sd-form__label" htmlFor="sd-trigger">{t.triggerLabel}</label>
          <input id="sd-trigger" className="sd-form__input" value={trigger} maxLength={300}
            placeholder={t.triggerPlaceholder} onChange={(e) => setTrigger(e.target.value)} />
        </div>

        <div className="sd-form__row">
          <div className="sd-form__group">
            <label className="sd-form__label" htmlFor="sd-better">{t.betterWithLabel}</label>
            <input id="sd-better" className="sd-form__input" value={betterWith} maxLength={300}
              placeholder={t.betterWithPlaceholder} onChange={(e) => setBetterWith(e.target.value)} />
          </div>
          <div className="sd-form__group">
            <label className="sd-form__label" htmlFor="sd-worse">{t.worseWithLabel}</label>
            <input id="sd-worse" className="sd-form__input" value={worseWith} maxLength={300}
              placeholder={t.worseWithPlaceholder} onChange={(e) => setWorseWith(e.target.value)} />
          </div>
        </div>

        <div className="sd-form__group">
          <label className="sd-form__label" htmlFor="sd-measures">{t.measuresLabel}</label>
          <input id="sd-measures" className="sd-form__input" value={measuresText} maxLength={300}
            placeholder={t.measuresPlaceholder} onChange={(e) => setMeasuresText(e.target.value)} />
        </div>

        <div className="sd-form__group">
          <label className="sd-form__label" htmlFor="sd-notes">{t.notesLabel}</label>
          <textarea id="sd-notes" className="sd-form__textarea" value={notes} maxLength={2000} rows={3}
            placeholder={t.notesPlaceholder} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="sd-form__actions">
          <button type="button" className="sd-form__cancel" onClick={onCancel}>{t.cancel}</button>
          <button type="submit" className="sd-form__submit" disabled={saving}>
            {saving ? t.saving : t.save}
          </button>
        </div>
      </form>
    </div>
  );
}
