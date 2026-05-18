import { useEffect, useRef } from "react";
import "../../../styles/PatientDataControlPage.css";

/**
 * Two-step confirmation for patient data export requests.
 */
export default function ExportRequestDialog({
  open,
  step,
  busy,
  practiceName,
  reason,
  onReasonChange,
  aiBusy,
  onAiDraft,
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
  const title = isStep2 ? t.exportConfirmTitle2 : t.exportConfirmTitle1;
  const body = isStep2
    ? t.exportConfirmBody2
    : t.exportConfirmBody1.replace("{practice}", practiceName || "—");

  return (
    <dialog
      ref={dialogRef}
      className="patient-data-control__dialog"
      aria-labelledby="export-req-title"
      aria-describedby="export-req-desc"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h3 id="export-req-title" className="patient-data-control__dialog-title">
        {title}
      </h3>
      <p id="export-req-desc" className="patient-data-control__dialog-body">
        {body}
      </p>
      {isStep2 ? (
        <>
          <p className="patient-data-control__ai-hint" role="note">
            {t.aiHint}
          </p>
          <label className="patient-data-control__reason-label">
            <span>{t.optionalNoteLabel}</span>
            <textarea
              className="patient-data-control__reason-input"
              rows={3}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={t.optionalNotePlaceholder}
              maxLength={1000}
              aria-describedby="export-req-desc"
            />
          </label>
          <button
            type="button"
            className="patient-threads__btn patient-threads__btn--secondary"
            style={{ marginTop: "0.5rem" }}
            disabled={aiBusy || busy}
            onClick={onAiDraft}
          >
            {aiBusy ? t.aiDraftLoading : t.aiDraftButton}
          </button>
        </>
      ) : null}
      <div className="patient-data-control__dialog-actions">
        <button
          type="button"
          className="patient-threads__btn patient-threads__btn--secondary"
          onClick={onCancel}
          disabled={busy}
        >
          {t.exportCancel}
        </button>
        <button
          ref={primaryRef}
          type="button"
          className="patient-threads__btn patient-threads__btn--secondary"
          onClick={isStep2 ? onConfirmStep2 : onConfirmStep1}
          disabled={busy}
        >
          {isStep2 ? t.exportConfirmAction : t.exportContinue}
        </button>
      </div>
    </dialog>
  );
}
