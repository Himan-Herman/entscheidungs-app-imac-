import React, { useEffect, useRef } from "react";

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.title
 * @param {string} props.body
 * @param {string} props.confirmLabel
 * @param {string} props.cancelLabel
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 */
export default function ConfirmDeleteDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
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
    <div className="pch-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="pch-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pch-dialog-title"
        aria-describedby="pch-dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="pch-dialog-title" className="pch-dialog__title">
          {title}
        </h3>
        <p id="pch-dialog-desc" className="pch-dialog__body">
          {body}
        </p>
        <div className="pch-dialog__actions">
          <button
            type="button"
            ref={cancelRef}
            className="pch-dialog__btn pch-dialog__btn--ghost"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="pch-dialog__btn pch-dialog__btn--danger"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
