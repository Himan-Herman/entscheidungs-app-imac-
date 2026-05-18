import { useEffect, useRef } from "react";
import "../styles/PracticeDocuments.css";

/**
 * Two-step accessible confirmation for document soft-delete.
 * @param {{
 *   open: boolean;
 *   step: 1 | 2;
 *   busy: boolean;
 *   t: Record<string, string>;
 *   onCancel: () => void;
 *   onConfirmStep1: () => void;
 *   onConfirmStep2: () => void;
 * }} props
 */
export default function DeleteDocumentDialog({
  open,
  step,
  busy,
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
  const title = isStep2 ? t.deleteConfirmTitle2 : t.deleteConfirmTitle1;
  const body = isStep2 ? t.deleteConfirmBody2 : t.deleteConfirmBody1;
  const confirmLabel = isStep2 ? t.deleteConfirmAction : t.deleteContinue;
  const onConfirm = isStep2 ? onConfirmStep2 : onConfirmStep1;

  return (
    <dialog
      ref={dialogRef}
      className="practice-documents__dialog"
      aria-labelledby="delete-doc-title"
      aria-describedby="delete-doc-desc"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h3 id="delete-doc-title" className="practice-documents__dialog-title">
        {title}
      </h3>
      <p id="delete-doc-desc" className="practice-documents__dialog-body">
        {body}
      </p>
      <div className="practice-documents__dialog-actions">
        <button
          type="button"
          className="patient-threads__btn patient-threads__btn--secondary"
          onClick={onCancel}
          disabled={busy}
        >
          {t.deleteCancel}
        </button>
        <button
          ref={primaryRef}
          type="button"
          className="patient-threads__btn practice-documents__btn--danger"
          onClick={onConfirm}
          disabled={busy}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
