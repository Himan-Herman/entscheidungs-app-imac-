import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Centered info overlay for a practice-hub card. Follows the project's dialog
 * convention (cf. ConfirmDeleteDialog): backdrop click / ESC / X all close, the
 * dialog content stops propagation, focus moves into the dialog on open and is
 * returned to the trigger on close.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.titleId    unique id linking title <-> aria-labelledby
 * @param {string} props.title
 * @param {string[]} props.paragraphs
 * @param {string} props.closeLabel  aria-label for the close button
 * @param {() => void} props.onClose
 */
export default function PracticeCardInfoModal({
  open,
  titleId,
  title,
  paragraphs = [],
  closeLabel,
  onClose,
}) {
  const closeRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocusedRef.current =
      typeof document !== "undefined" ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === "function") prev.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="practice-overview__modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="practice-overview__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          ref={closeRef}
          className="practice-overview__modal-close"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <X size={18} aria-hidden />
        </button>
        <h2 id={titleId} className="practice-overview__modal-title">
          {title}
        </h2>
        <div className="practice-overview__modal-body">
          {paragraphs.filter(Boolean).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
