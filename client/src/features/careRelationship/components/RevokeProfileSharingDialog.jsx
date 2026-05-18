import { useEffect, useRef } from "react";
import "../../../styles/PatientDataControlPage.css";

/**
 * Two-step accessible confirmation for revoking profile sharing with a practice.
 */
export default function RevokeProfileSharingDialog({
  open,
  step,
  busy,
  practiceName,
  t,
  onCancel,
  onConfirmStep1,
  onConfirmStep2,
}) {
  const dialogRef = useRef(null);
  const primaryRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog?.showModal) return;
    if (!dialog.open) dialog.showModal();
    primaryRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open, step]);

  if (!open) return null;

  const isStep2 = step === 2;
  const title = isStep2 ? t.revokeConfirmTitle2 : t.revokeConfirmTitle1;
  const body = isStep2
    ? t.revokeConfirmBody2
    : t.revokeConfirmBody1.replace("{practice}", practiceName || "—");

  return (
    <dialog
      ref={dialogRef}
      className="patient-data-control__dialog"
      aria-labelledby="profile-revoke-title"
      aria-describedby="profile-revoke-desc"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h3 id="profile-revoke-title" className="patient-data-control__dialog-title">
        {title}
      </h3>
      <p id="profile-revoke-desc" className="patient-data-control__dialog-body">
        {body}
      </p>
      <div className="patient-data-control__dialog-actions">
        <button
          type="button"
          className="patient-threads__btn patient-threads__btn--secondary"
          onClick={onCancel}
          disabled={busy}
        >
          {t.revokeCancel}
        </button>
        <button
          ref={primaryRef}
          type="button"
          className="patient-threads__btn patient-data-control__btn--muted-danger"
          onClick={isStep2 ? onConfirmStep2 : onConfirmStep1}
          disabled={busy}
        >
          {isStep2 ? t.revokeConfirmAction : t.revokeContinue}
        </button>
      </div>
    </dialog>
  );
}
