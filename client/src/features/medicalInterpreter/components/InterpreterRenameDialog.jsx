import { useEffect, useId, useRef, useState } from "react";

/**
 * @param {{
 *   open: boolean;
 *   initialTitle: string;
 *   title: string;
 *   label: string;
 *   confirmLabel: string;
 *   cancelLabel: string;
 *   onConfirm: (title: string) => void;
 *   onCancel: () => void;
 * }} props
 */
export default function InterpreterRenameDialog({
  open,
  initialTitle,
  title,
  label,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [value, setValue] = useState(initialTitle);

  useEffect(() => {
    if (open) {
      setValue(initialTitle);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, initialTitle]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div
      className="interpreter-dialog-backdrop"
      role="presentation"
      onClick={onCancel}
    >
      <form
        className="interpreter-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="interpreter-rename-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 id="interpreter-rename-title" className="interpreter-dialog__title">
          {title}
        </h3>
        <label className="interpreter-dialog__label" htmlFor={inputId}>
          {label}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          className="interpreter-dialog__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={200}
          autoComplete="off"
        />
        <div className="interpreter-dialog__actions">
          <button
            type="button"
            className="medical-interpreter-page__nav-link interpreter-dialog__btn"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary interpreter-dialog__btn"
            disabled={!value.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
