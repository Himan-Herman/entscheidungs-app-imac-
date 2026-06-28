import { useEffect, useRef } from "react";
import "../../../styles/PatientDataControlPage.css";

/**
 * Accessible dialog for a practice to send a link request by patient email (Fall A).
 * Native <dialog> gives a focus trap + ESC handling; clicking the backdrop also closes.
 * PRIVACY: the backend response is always neutral (no account enumeration); the success
 * message reflects that ("if an account exists, a request was sent").
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {boolean} props.busy
 * @param {string} props.email
 * @param {(value: string) => void} props.onEmailChange
 * @param {string} props.error
 * @param {() => void} props.onSubmit
 * @param {() => void} props.onCancel
 * @param {object} props.t   practicePatients.linkRequest translations
 */
export default function LinkRequestDialog({
  open,
  busy,
  email,
  onEmailChange,
  error,
  onSubmit,
  onCancel,
  t,
}) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    if (!dialog?.showModal) return undefined;
    if (!dialog.open) dialog.showModal();
    inputRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="patient-data-control__dialog"
      aria-labelledby="link-request-title"
      aria-describedby="link-request-desc"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onCancel();
      }}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onSubmit();
        }}
      >
        <h3 id="link-request-title" className="patient-data-control__dialog-title">
          {t.dialogTitle}
        </h3>
        <p id="link-request-desc" className="patient-data-control__dialog-body">
          {t.dialogBody}
        </p>
        <label className="patient-data-control__reason-label" htmlFor="link-request-input">
          <span>{t.inputLabel}</span>
          <input
            id="link-request-input"
            ref={inputRef}
            type="email"
            className="patient-data-control__reason-input"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder={t.inputPlaceholder}
            autoComplete="off"
            spellCheck={false}
            maxLength={160}
            disabled={busy}
          />
        </label>
        <p className="patient-data-control__ai-hint" role="note">
          {t.dialogHint}
        </p>
        <div aria-live="assertive">
          {error ? (
            <p className="practice-dashboard__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="patient-data-control__dialog-actions">
          <button
            type="button"
            className="patient-threads__btn patient-threads__btn--secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            className="patient-threads__btn patient-threads__btn--primary"
            disabled={busy || !email.trim()}
            aria-busy={busy}
          >
            {busy ? t.submitting : t.submit}
          </button>
        </div>
      </form>
    </dialog>
  );
}
