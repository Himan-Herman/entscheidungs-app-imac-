import { useId, useRef, useState } from "react";
import { Paperclip } from "lucide-react";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const TODAY = () => new Date().toISOString().slice(0, 10);

function isDateInFuture(val) {
  if (!val) return false;
  return new Date(val) > new Date();
}

export default function VaccinationEntryForm({ t, initial = null, onSave, onCancel, saving }) {
  const uid = useId();

  const empty = {
    vaccineName: "",
    disease: "",
    vaccinationDate: "",
    doseLabel: "",
    lotNumber: "",
    location: "",
    nextDueDate: "",
    notes: "",
  };

  const [fields, setFields] = useState(initial ? {
    vaccineName: initial.vaccineName ?? "",
    disease: initial.disease ?? "",
    vaccinationDate: initial.vaccinationDate?.slice(0, 10) ?? "",
    doseLabel: initial.doseLabel ?? "",
    lotNumber: initial.lotNumber ?? "",
    location: initial.location ?? "",
    nextDueDate: initial.nextDueDate?.slice(0, 10) ?? "",
    notes: initial.notes ?? "",
  } : empty);

  const [file, setFile] = useState(null);
  const [keepExistingDoc, setKeepExistingDoc] = useState(true);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const fileRef = useRef(null);

  function set(key, val) {
    setFields(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate() {
    const errs = {};
    if (!fields.vaccineName.trim()) errs.vaccineName = t.form.fieldRequired;
    if (!fields.disease.trim()) errs.disease = t.form.fieldRequired;
    if (!fields.vaccinationDate) {
      errs.vaccinationDate = t.form.fieldRequired;
    } else if (isDateInFuture(fields.vaccinationDate)) {
      errs.vaccinationDate = t.form.dateFuture;
    }
    if (!consent) errs.consent = t.form.consentRequired;
    return errs;
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setErrors(prev => ({ ...prev, file: t.form.fileTooLarge }));
      return;
    }
    if (!ALLOWED_MIME.includes(f.type)) {
      setErrors(prev => ({ ...prev, file: t.form.fileTypeInvalid }));
      return;
    }
    setFile(f);
    setErrors(prev => ({ ...prev, file: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaveError("");
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    try {
      await onSave({ fields, file, keepExistingDoc });
    } catch (err) {
      setSaveError(t.form.saveError);
    }
  }

  const hasExistingDoc = initial?.documentName;

  return (
    <form className="vacc-form" onSubmit={handleSubmit} noValidate>
      <h2 className="vacc-form__title">
        {initial ? t.form.editHeading : t.form.addHeading}
      </h2>

      <div className="vacc-form__grid">
        {/* Vaccine name */}
        <div className="vacc-form__field">
          <label className="vacc-form__label" htmlFor={`${uid}-name`}>
            {t.form.vaccineName}
          </label>
          <input
            id={`${uid}-name`}
            className={`vacc-form__input${errors.vaccineName ? " vacc-form__input--error" : ""}`}
            type="text"
            value={fields.vaccineName}
            onChange={e => set("vaccineName", e.target.value)}
            placeholder={t.form.vaccineNamePlaceholder}
            autoComplete="off"
            aria-required="true"
            aria-describedby={errors.vaccineName ? `${uid}-name-err` : undefined}
          />
          {errors.vaccineName && (
            <span id={`${uid}-name-err`} className="vacc-form__error-msg" role="alert">
              {errors.vaccineName}
            </span>
          )}
        </div>

        {/* Disease */}
        <div className="vacc-form__field">
          <label className="vacc-form__label" htmlFor={`${uid}-disease`}>
            {t.form.disease}
          </label>
          <input
            id={`${uid}-disease`}
            className={`vacc-form__input${errors.disease ? " vacc-form__input--error" : ""}`}
            type="text"
            value={fields.disease}
            onChange={e => set("disease", e.target.value)}
            placeholder={t.form.diseasePlaceholder}
            autoComplete="off"
            aria-required="true"
            aria-describedby={errors.disease ? `${uid}-disease-err` : undefined}
          />
          {errors.disease && (
            <span id={`${uid}-disease-err`} className="vacc-form__error-msg" role="alert">
              {errors.disease}
            </span>
          )}
        </div>

        {/* Vaccination date */}
        <div className="vacc-form__field">
          <label className="vacc-form__label" htmlFor={`${uid}-date`}>
            {t.form.vaccinationDate}
          </label>
          <input
            id={`${uid}-date`}
            className={`vacc-form__input${errors.vaccinationDate ? " vacc-form__input--error" : ""}`}
            type="date"
            value={fields.vaccinationDate}
            max={TODAY()}
            onChange={e => set("vaccinationDate", e.target.value)}
            aria-required="true"
            aria-describedby={errors.vaccinationDate ? `${uid}-date-err` : undefined}
          />
          {errors.vaccinationDate && (
            <span id={`${uid}-date-err`} className="vacc-form__error-msg" role="alert">
              {errors.vaccinationDate}
            </span>
          )}
        </div>

        {/* Dose label */}
        <div className="vacc-form__field">
          <label className="vacc-form__label" htmlFor={`${uid}-dose`}>
            {t.form.doseLabel}
          </label>
          <input
            id={`${uid}-dose`}
            className="vacc-form__input"
            type="text"
            value={fields.doseLabel}
            onChange={e => set("doseLabel", e.target.value)}
            placeholder={t.form.doseLabelPlaceholder}
            autoComplete="off"
          />
        </div>

        {/* Lot number */}
        <div className="vacc-form__field">
          <label className="vacc-form__label" htmlFor={`${uid}-lot`}>
            {t.form.lotNumber}
          </label>
          <input
            id={`${uid}-lot`}
            className="vacc-form__input"
            type="text"
            value={fields.lotNumber}
            onChange={e => set("lotNumber", e.target.value)}
            placeholder={t.form.lotNumberPlaceholder}
            autoComplete="off"
          />
        </div>

        {/* Location */}
        <div className="vacc-form__field">
          <label className="vacc-form__label" htmlFor={`${uid}-location`}>
            {t.form.location}
          </label>
          <input
            id={`${uid}-location`}
            className="vacc-form__input"
            type="text"
            value={fields.location}
            onChange={e => set("location", e.target.value)}
            placeholder={t.form.locationPlaceholder}
            autoComplete="off"
          />
        </div>

        {/* Next due date */}
        <div className="vacc-form__field">
          <label className="vacc-form__label" htmlFor={`${uid}-next`}>
            {t.form.nextDueDate}
          </label>
          <input
            id={`${uid}-next`}
            className="vacc-form__input"
            type="date"
            value={fields.nextDueDate}
            onChange={e => set("nextDueDate", e.target.value)}
          />
        </div>

        {/* Notes */}
        <div className="vacc-form__field vacc-form__field--full">
          <label className="vacc-form__label" htmlFor={`${uid}-notes`}>
            {t.form.notes}
          </label>
          <textarea
            id={`${uid}-notes`}
            className="vacc-form__textarea"
            value={fields.notes}
            onChange={e => set("notes", e.target.value)}
            placeholder={t.form.notesPlaceholder}
            rows={3}
          />
        </div>

        {/* File upload */}
        <div className="vacc-form__field vacc-form__field--full">
          <label className="vacc-form__label" htmlFor={`${uid}-file`}>
            {t.form.uploadDocument}
          </label>
          <div className="vacc-form__upload">
            <input
              id={`${uid}-file`}
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              style={{ display: "none" }}
              onChange={handleFileChange}
              aria-describedby={`${uid}-file-hint`}
            />
            <button
              type="button"
              className="vacc-form__upload-btn"
              onClick={() => fileRef.current?.click()}
              aria-label={t.form.uploadDocument}
            >
              <Paperclip size={16} />
              {file ? t.form.uploadChange : (hasExistingDoc && keepExistingDoc ? t.form.uploadChange : t.form.uploadDocument)}
            </button>
            <span id={`${uid}-file-hint`} className="vacc-form__hint">
              {t.form.uploadHint}
            </span>
            {file && (
              <span className="vacc-form__upload-selected">
                {t.form.uploadSelected} {file.name}{" "}
                <button
                  type="button"
                  className="vacc-form__upload-remove"
                  onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                >
                  {t.form.uploadRemove}
                </button>
              </span>
            )}
            {hasExistingDoc && !file && (
              <span className="vacc-form__upload-selected">
                {t.card.document}: {initial.documentName}{" "}
                {keepExistingDoc && (
                  <button
                    type="button"
                    className="vacc-form__upload-remove"
                    onClick={() => setKeepExistingDoc(false)}
                  >
                    {t.form.uploadRemove}
                  </button>
                )}
              </span>
            )}
            {errors.file && (
              <span className="vacc-form__error-msg" role="alert">{errors.file}</span>
            )}
          </div>
        </div>
      </div>

      {/* Consent */}
      <div className={`vacc-form__consent${errors.consent ? " vacc-form__consent--error" : ""}`}>
        <input
          type="checkbox"
          id={`${uid}-consent`}
          checked={consent}
          onChange={e => {
            setConsent(e.target.checked);
            setErrors(prev => ({ ...prev, consent: undefined }));
          }}
          aria-required="true"
          aria-describedby={errors.consent ? `${uid}-consent-err` : undefined}
        />
        <label htmlFor={`${uid}-consent`} className="vacc-form__consent-label">
          {t.form.consentLabel}
        </label>
      </div>
      {errors.consent && (
        <span id={`${uid}-consent-err`} className="vacc-form__error-msg" role="alert">
          {errors.consent}
        </span>
      )}

      <p className="vacc-form__required-note">{t.form.required}</p>

      <div className="vacc-form__actions">
        <button type="submit" className="vacc-form__save-btn" disabled={saving}>
          {saving ? t.form.saving : t.form.save}
        </button>
        <button type="button" className="vacc-form__cancel-btn" onClick={onCancel} disabled={saving}>
          {t.form.cancel}
        </button>
      </div>

      {saveError && (
        <p className="vacc-form__save-error" role="alert">{saveError}</p>
      )}
    </form>
  );
}
