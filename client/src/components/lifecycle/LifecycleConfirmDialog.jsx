import { useEffect, useRef } from "react";
import "../../features/practiceDocuments/styles/PracticeDocuments.css";

/**
 * Two-step accessible confirmation for archive or soft-delete.
 * @param {{
 *   open: boolean;
 *   mode: 'archive' | 'delete';
 *   step: 1 | 2;
 *   busy: boolean;
 *   t: Record<string, string>;
 *   onCancel: () => void;
 *   onConfirmStep1: () => void;
 *   onConfirmStep2: () => void;
 *   danger?: boolean;
 * }} props
 */
export default function LifecycleConfirmDialog({
  open,
  mode,
  step,
  busy,
  t,
  onCancel,
  onConfirmStep1,
  onConfirmStep2,
  danger = false,
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
  const isArchive = mode === "archive";
  const title = isStep2
    ? isArchive
      ? t.archiveConfirmTitle2
      : t.deleteConfirmTitle2
    : isArchive
      ? t.archiveConfirmTitle1
      : t.deleteConfirmTitle1;
  const body = isStep2
    ? isArchive
      ? t.archiveConfirmBody2
      : t.deleteConfirmBody2
    : isArchive
      ? t.archiveConfirmBody1
      : t.deleteConfirmBody1;
  const confirmLabel = isStep2
    ? isArchive
      ? t.archiveConfirmAction
      : t.deleteConfirmAction
    : t.continue;
  const onConfirm = isStep2 ? onConfirmStep2 : onConfirmStep1;

  return (
    <dialog
      ref={dialogRef}
      className="practice-documents__dialog"
      aria-labelledby="lifecycle-confirm-title"
      aria-describedby="lifecycle-confirm-desc"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h3 id="lifecycle-confirm-title" className="practice-documents__dialog-title">
        {title}
      </h3>
      <p id="lifecycle-confirm-desc" className="practice-documents__dialog-body">
        {body}
      </p>
      <div className="practice-documents__dialog-actions">
        <button
          type="button"
          className="patient-threads__btn patient-threads__btn--secondary"
          onClick={onCancel}
          disabled={busy}
        >
          {t.cancel}
        </button>
        <button
          ref={primaryRef}
          type="button"
          className={
            danger
              ? "patient-threads__btn practice-documents__btn--danger"
              : "patient-threads__btn patient-threads__btn--primary"
          }
          onClick={onConfirm}
          disabled={busy}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
