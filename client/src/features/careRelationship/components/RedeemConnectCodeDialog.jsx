import { useEffect, useRef } from "react";
import "../../../styles/PatientDataControlPage.css";

/**
 * Accessible dialog for a practice to redeem a patient-generated connection code
 * (Phase 2). Native <dialog> gives a focus trap + ESC handling; clicking the backdrop
 * also closes. Focus returns to the trigger on close (handled by dialog.close()).
 * The code itself is never logged.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {boolean} props.busy
 * @param {string} props.code
 * @param {(value: string) => void} props.onCodeChange
 * @param {string} props.error      generic error message (no enumeration), shown via aria-live
 * @param {() => void} props.onSubmit
 * @param {() => void} props.onCancel
 * @param {object} props.t          practicePatients.connect translations
 */
export default function RedeemConnectCodeDialog({
  open,
  busy,
  code,
  onCodeChange,
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
      aria-labelledby="redeem-code-title"
      aria-describedby="redeem-code-desc"
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
        <h3 id="redeem-code-title" className="patient-data-control__dialog-title">
          {t.dialogTitle}
        </h3>
        <p id="redeem-code-desc" className="patient-data-control__dialog-body">
          {t.dialogBody}
        </p>
        <label className="patient-data-control__reason-label" htmlFor="redeem-code-input">
          <span>{t.inputLabel}</span>
          <input
            id="redeem-code-input"
            ref={inputRef}
            type="text"
            className="patient-data-control__reason-input"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder={t.inputPlaceholder}
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
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
            disabled={busy || !code.trim()}
            aria-busy={busy}
          >
            {busy ? t.submitting : t.submit}
          </button>
        </div>
      </form>
    </dialog>
  );
}
