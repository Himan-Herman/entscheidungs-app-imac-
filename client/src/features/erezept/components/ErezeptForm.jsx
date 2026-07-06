import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import "../styles/Erezept.css";

const DEFAULT_VALIDITY = 28;

export default function ErezeptForm({ t, onSave, onCancel, saving }) {
  const [medicationName, setMedicationName] = useState("");
  const [icdCode, setIcdCode] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [notes, setNotes] = useState("");
  const [validityDays, setValidityDays] = useState(DEFAULT_VALIDITY);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!medicationName.trim()) { setError(t.errorMedication); return; }
    setError("");
    onSave({
      medicationName: medicationName.trim(),
      icdCode: icdCode.trim() || null,
      dosage: dosage.trim() || null,
      instructions: instructions.trim() || null,
      notes: notes.trim() || null,
      validityDays: Number(validityDays),
    });
  }

  return (
    <div
      className="erx-form-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="erx-form-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <form className="erx-form-panel" onSubmit={handleSubmit} noValidate>
        <h2 id="erx-form-title" className="erx-form-panel__title">
          <FileText size={20} aria-hidden="true" />
          {t.issueTitle}
        </h2>

        {error && <p className="erx-form__error" role="alert">{error}</p>}

        <div className="erx-form__group">
          <label className="erx-form__label" htmlFor="erx-medication">
            {t.medicationLabel} *
          </label>
          <input
            id="erx-medication"
            ref={inputRef}
            className="erx-form__input"
            value={medicationName}
            onChange={(e) => setMedicationName(e.target.value)}
            maxLength={300}
            placeholder={t.medicationPlaceholder}
            required
          />
        </div>

        <div className="erx-form__row">
          <div className="erx-form__group">
            <label className="erx-form__label" htmlFor="erx-icd">
              {t.icdCodeLabel}
            </label>
            <input
              id="erx-icd"
              className="erx-form__input"
              value={icdCode}
              onChange={(e) => setIcdCode(e.target.value.toUpperCase())}
              maxLength={20}
              placeholder={t.icdPlaceholder}
              style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
            />
          </div>
          <div className="erx-form__group">
            <label className="erx-form__label" htmlFor="erx-validity">
              {t.validityLabel}
            </label>
            <input
              id="erx-validity"
              type="number"
              min={1}
              max={90}
              className="erx-form__input"
              value={validityDays}
              onChange={(e) => setValidityDays(Math.max(1, Math.min(90, parseInt(e.target.value) || DEFAULT_VALIDITY)))}
            />
          </div>
        </div>

        <div className="erx-form__group">
          <label className="erx-form__label" htmlFor="erx-dosage">
            {t.dosageLabel}
          </label>
          <input
            id="erx-dosage"
            className="erx-form__input"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            maxLength={200}
            placeholder={t.dosagePlaceholder}
          />
        </div>

        <div className="erx-form__group">
          <label className="erx-form__label" htmlFor="erx-instructions">
            {t.instructionsLabel}
          </label>
          <textarea
            id="erx-instructions"
            className="erx-form__textarea"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder={t.instructionsPlaceholder}
          />
        </div>

        <div className="erx-form__group">
          <label className="erx-form__label" htmlFor="erx-notes">
            {t.notesLabel}
          </label>
          <textarea
            id="erx-notes"
            className="erx-form__textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder={t.notesPlaceholder}
          />
        </div>

        <div className="erx-form__actions">
          <button type="button" className="erx-form__cancel" onClick={onCancel}>
            {t.cancelBtn}
          </button>
          <button type="submit" className="erx-form__submit" disabled={saving}>
            {saving ? t.saving : t.submitBtn}
          </button>
        </div>
      </form>
    </div>
  );
}
