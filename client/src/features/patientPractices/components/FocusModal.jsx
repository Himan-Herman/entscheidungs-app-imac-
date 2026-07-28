import { useEffect, useRef } from "react";
import "./FocusModal.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog with a real focus trap and focus restoration.
 *
 * On open, focus moves into the dialog. Tab and Shift+Tab cycle inside it, so a
 * keyboard or screen reader user cannot land on the page behind. On close,
 * focus returns to whatever element opened the dialog — a decision about
 * sharing medical data should never leave the user stranded at the top of the
 * page.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   titleId: string,
 *   title: string,
 *   children: React.ReactNode,
 * }} props
 */
export default function FocusModal({ open, onClose, titleId, title, children }) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement;

    const node = dialogRef.current;
    const first = node?.querySelector(FOCUSABLE);
    (first ?? node)?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const target = returnFocusRef.current;
      if (target && typeof target.focus === "function") target.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="focus-modal__backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="focus-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="focus-modal__title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
