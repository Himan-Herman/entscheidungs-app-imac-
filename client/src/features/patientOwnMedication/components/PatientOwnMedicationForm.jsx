import { useEffect, useId, useState } from "react";
import { structureMedicationFreeText } from "../utils/structureMedicationFreeText.js";
import { generateOwnMedicationId } from "../patientOwnMedicationStore.js";
import "../styles/PatientOwnMedication.css";

const EMPTY = {
  name: "",
  dosage: "",
  schedule: "",
  startDate: "",
  endDate: "",
  instructions: "",
  reminderEnabled: false,
};

/**
 * @param {{
 *   initial?: Record<string, unknown> | null;
 *   reminderConsent: boolean;
 *   onSave: (entry: object) => void;
 *   onCancel: () => void;
 *   labels: object;
 * }} props
 */
export default function PatientOwnMedicationForm({
  initial = null,
  reminderConsent,
  onSave,
  onCancel,
  labels: t,
}) {
  const formId = useId();
  const [fields, setFields] = useState({ ...EMPTY, ...(initial || {}) });
  const [freeText, setFreeText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setFields({ ...EMPTY, ...(initial || {}) });
    setFreeText("");
    setError("");
  }, [initial]);

  const set = (key, value) => setFields((prev) => ({ ...prev, [key]: value }));

  const applyFreeText = () => {
    const structured = structureMedicationFreeText(freeText);
    if (!structured) return;
    setFields((prev) => ({
      ...prev,
      name: structured.name || prev.name,
      dosage: structured.dosage || prev.dosage,
      schedule: structured.schedule || prev.schedule,
      instructions: structured.instructions || prev.instructions,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = String(fields.name || "").trim();
    if (!name) {
      setError(t.ownForm.nameRequired);
      return;
    }
    setError("");
    onSave({
      id: initial?.id || generateOwnMedicationId(),
      name,
      dosage: String(fields.dosage || "").trim(),
      schedule: String(fields.schedule || "").trim(),
      startDate: fields.startDate || "",
      endDate: fields.endDate || "",
      instructions: String(fields.instructions || "").trim(),
      reminderEnabled: reminderConsent && fields.reminderEnabled === true,
      createdAt: initial?.createdAt,
    });
  };

  return (
    <form
      className="patient-own-med__form"
      onSubmit={handleSubmit}
      aria-labelledby={`${formId}-title`}
      noValidate
    >
      <h2 id={`${formId}-title`} className="patient-own-med__form-title">
        {initial?.id ? t.ownForm.editTitle : t.ownForm.addTitle}
      </h2>
      <p className="patient-own-med__hint">{t.ownForm.requiredHint}</p>

      <div className="patient-own-med__free-text">
        <label className="patient-own-med__label" htmlFor={`${formId}-free`}>
          {t.ownForm.freeTextLabel}
        </label>
        <textarea
          id={`${formId}-free`}
          className="patient-own-med__textarea"
          rows={3}
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder={t.ownForm.freeTextPlaceholder}
        />
        <button
          type="button"
          className="patient-own-med__btn patient-own-med__btn--secondary"
          onClick={applyFreeText}
          disabled={!freeText.trim()}
        >
          {t.ownForm.freeTextApply}
        </button>
        <p className="patient-own-med__hint">{t.ownForm.aiAssistHint}</p>
      </div>

      <div className="patient-own-med__field">
        <label className="patient-own-med__label" htmlFor={`${formId}-name`}>
          {t.ownForm.nameLabel}
        </label>
        <input
          id={`${formId}-name`}
          className="patient-own-med__input"
          type="text"
          required
          value={fields.name}
          onChange={(e) => set("name", e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="patient-own-med__field">
        <label className="patient-own-med__label" htmlFor={`${formId}-dosage`}>
          {t.ownForm.dosageLabel}
        </label>
        <input
          id={`${formId}-dosage`}
          className="patient-own-med__input"
          type="text"
          value={fields.dosage}
          onChange={(e) => set("dosage", e.target.value)}
          placeholder={t.ownForm.dosagePlaceholder}
        />
      </div>

      <div className="patient-own-med__field">
        <label className="patient-own-med__label" htmlFor={`${formId}-schedule`}>
          {t.ownForm.scheduleLabel}
        </label>
        <input
          id={`${formId}-schedule`}
          className="patient-own-med__input"
          type="text"
          value={fields.schedule}
          onChange={(e) => set("schedule", e.target.value)}
          placeholder={t.ownForm.schedulePlaceholder}
        />
      </div>

      <div className="patient-own-med__row">
        <div className="patient-own-med__field">
          <label className="patient-own-med__label" htmlFor={`${formId}-start`}>
            {t.ownForm.startLabel}
          </label>
          <input
            id={`${formId}-start`}
            className="patient-own-med__input"
            type="date"
            value={fields.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </div>
        <div className="patient-own-med__field">
          <label className="patient-own-med__label" htmlFor={`${formId}-end`}>
            {t.ownForm.endLabel}
          </label>
          <input
            id={`${formId}-end`}
            className="patient-own-med__input"
            type="date"
            value={fields.endDate}
            onChange={(e) => set("endDate", e.target.value)}
          />
        </div>
      </div>

      <div className="patient-own-med__field">
        <label className="patient-own-med__label" htmlFor={`${formId}-notes`}>
          {t.ownForm.notesLabel}
        </label>
        <textarea
          id={`${formId}-notes`}
          className="patient-own-med__textarea"
          rows={2}
          value={fields.instructions}
          onChange={(e) => set("instructions", e.target.value)}
        />
      </div>

      <div className="patient-own-med__checkbox-row">
        <input
          id={`${formId}-reminder`}
          type="checkbox"
          checked={fields.reminderEnabled === true}
          disabled={!reminderConsent}
          onChange={(e) => set("reminderEnabled", e.target.checked)}
        />
        <label htmlFor={`${formId}-reminder`} className="patient-own-med__checkbox-label">
          {t.ownForm.reminderItemLabel}
        </label>
      </div>
      {!reminderConsent ? (
        <p className="patient-own-med__hint" role="note">
          {t.ownForm.reminderNeedsConsent}
        </p>
      ) : null}

      {error ? (
        <p className="patient-own-med__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="patient-own-med__actions">
        <button
          type="button"
          className="patient-own-med__btn patient-own-med__btn--secondary"
          onClick={onCancel}
        >
          {t.ownForm.cancel}
        </button>
        <button type="submit" className="patient-own-med__btn patient-own-med__btn--primary">
          {t.ownForm.save}
        </button>
      </div>
    </form>
  );
}
