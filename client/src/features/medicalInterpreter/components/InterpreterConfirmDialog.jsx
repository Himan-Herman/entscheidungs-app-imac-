import { useEffect, useRef } from "react";

/**
 * Accessible confirmation dialog for interpreter destructive / leave actions.
 *
 * @param {{
 *   open: boolean;
 *   title: string;
 *   body: string;
 *   confirmLabel: string;
 *   cancelLabel: string;
 *   onConfirm: () => void;
 *   onCancel: () => void;
 *   danger?: boolean;
 * }} props
 */
export default function InterpreterConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="interpreter-dialog-backdrop"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="interpreter-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="interpreter-dialog-title"
        aria-describedby="interpreter-dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="interpreter-dialog-title" className="interpreter-dialog__title">
          {title}
        </h3>
        <p id="interpreter-dialog-desc" className="interpreter-dialog__body">
          {body}
        </p>
        <div className="interpreter-dialog__actions">
          <button
            type="button"
            ref={cancelRef}
            className="medical-interpreter-page__nav-link interpreter-dialog__btn"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`medical-interpreter-page__nav-link interpreter-dialog__btn${
              danger ? " interpreter-dialog__btn--danger" : " medical-interpreter-page__nav-link--primary"
            }`}
            onClick={onConfirm}
            aria-label={confirmLabel}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
