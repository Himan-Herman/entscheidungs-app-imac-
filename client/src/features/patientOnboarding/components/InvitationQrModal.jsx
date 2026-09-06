import { useEffect, useRef, useState } from "react";

/**
 * QR code for one invitation link.
 *
 * The encoded value is ONLY the fragment link — `/patient-invitation#token=...`.
 * No patient name, no record number, no identifier of any kind: whoever
 * photographs the screen over somebody's shoulder gets a credential, not a
 * person's data, and that credential is already the thing being handed over.
 *
 * The QR is never the only route. The same dialog shows the link as text,
 * because a scanner is not always available and a code on a screen is useless
 * to someone using a screen reader.
 */
export default function InvitationQrModal({ link, tx, onClose }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setDataUrl(null);
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(link, {
        width: 320,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      }))
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [link]);

  // Focus moves into the dialog and returns where it came from, so keyboard and
  // screen-reader users are not dropped at the top of the page on close.
  useEffect(() => {
    openerRef.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [onClose]);

  return (
    <div className="onboarding-modal__backdrop" onMouseDown={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div
        className="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invitation-qr-title"
        ref={dialogRef}
      >
        <h2 id="invitation-qr-title" className="onboarding-modal__title">{tx.qr.title}</h2>
        <p className="onboarding-modal__hint">{tx.qr.description}</p>

        {dataUrl && (
          <img className="onboarding-qr__image" src={dataUrl} alt={tx.qr.alt} width={320} height={320} />
        )}
        {failed && <p className="onboarding-alert onboarding-alert--error">{tx.qr.failed}</p>}
        {!dataUrl && !failed && <p className="onboarding-modal__hint">{tx.loading}</p>}

        {/* The link in plain text: the QR is a convenience, never the only way. */}
        <label className="onboarding-field">
          <span className="onboarding-field__label">{tx.invitation.linkLabel}</span>
          <textarea className="onboarding-field__input" readOnly rows={3} value={link} />
        </label>

        <div className="onboarding-modal__actions">
          {dataUrl && (
            <a className="onboarding-btn onboarding-btn--ghost" href={dataUrl} download="einladung-qr.png">
              {tx.qr.download}
            </a>
          )}
          <button type="button" className="onboarding-btn" onClick={onClose} ref={closeRef}>
            {tx.actions.close}
          </button>
        </div>
      </div>
    </div>
  );
}
