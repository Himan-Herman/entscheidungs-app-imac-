import React, { useEffect, useRef, useState } from 'react';
import { buildPracticeMedaUrl, practiceMedaQrFileName } from './practiceMedaQr.js';

/**
 * Accessible modal that shows a QR code for the protected practice Meda start page.
 *
 * This QR code opens the protected practice Meda start page only. It must not
 * contain patient data, transcript data, PDF content, or medical content.
 * The encoded value is purely `buildPracticeMedaUrl(practiceId)`.
 *
 * @param {object}   props
 * @param {string}   props.practiceId    Practice id (may be empty → no-practice hint)
 * @param {string}   [props.practiceName] Optional, used only for the download filename
 * @param {object}   props.tx            Practice i18n messages (getPracticeChromeMessages)
 * @param {() => void} props.onClose
 */
export default function PracticeMedaQrModal({ practiceId, practiceName, tx, onClose }) {
  const hasPractice = !!practiceId;
  const medaUrl     = hasPractice ? buildPracticeMedaUrl(practiceId) : '';

  const [qrDataUrl, setQrDataUrl] = useState(/** @type {string|null} */ (null));
  const [qrFailed,  setQrFailed]  = useState(false);
  const [copied,    setCopied]    = useState(false);

  const closeBtnRef = useRef(/** @type {HTMLButtonElement|null} */ (null));

  // Generate the QR data URL (only when a practiceId is present).
  useEffect(() => {
    if (!hasPractice) return;
    let cancelled = false;
    setQrFailed(false);
    setQrDataUrl(null);

    import('qrcode')
      .then((QRCode) => QRCode.toDataURL(medaUrl, {
        width: 320,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      }))
      .then((dataUrl) => { if (!cancelled) setQrDataUrl(dataUrl); })
      .catch(() => { if (!cancelled) setQrFailed(true); });

    return () => { cancelled = true; };
  }, [hasPractice, medaUrl]);

  // Close on Escape; focus the close button on mount.
  useEffect(() => {
    closeBtnRef.current?.focus();
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(medaUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable — silently ignore, link is still visible */
    }
  }

  function handleDownload() {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = practiceMedaQrFileName(practiceId, practiceName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handlePrint() {
    if (!qrDataUrl) return;
    const w = window.open('', '_blank', 'noopener,noreferrer,width=480,height=640');
    if (!w) return; // popup blocked — ignore silently
    const safeTitle = String(tx.qrTitle || 'QR');
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>` +
      `<style>body{font-family:system-ui,sans-serif;text-align:center;padding:24px;color:#0f172a}` +
      `img{width:320px;height:320px}p{font-size:12px;color:#475569;word-break:break-all}</style></head>` +
      `<body><h2>${safeTitle}</h2><img src="${qrDataUrl}" alt=""><p>${medaUrl}</p>` +
      `<script>window.onload=function(){window.print();}<\/script></body></html>`
    );
    w.document.close();
  }

  // Backdrop click closes; inner clicks do not propagate.
  return (
    <div
      className="mrt-qr-backdrop"
      onMouseDown={onClose}
    >
      <div
        className="mrt-qr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mrt-qr-title"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="mrt-qr-modal-head">
          <h2 id="mrt-qr-title" className="mrt-qr-modal-title">{tx.qrTitle}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="mrt-qr-close"
            onClick={onClose}
            aria-label={tx.qrClose}
          >
            ✕
          </button>
        </div>

        {!hasPractice ? (
          <p className="mrt-qr-no-practice" role="status">{tx.qrNoPractice}</p>
        ) : (
          <>
            <p className="mrt-qr-intro">{tx.qrIntro}</p>

            <div className="mrt-qr-image-wrap">
              {qrFailed ? (
                <p className="mrt-qr-error" role="alert">{tx.qrError}</p>
              ) : qrDataUrl ? (
                // eslint-disable-next-line jsx-a11y/img-redundant-alt
                <img className="mrt-qr-image" src={qrDataUrl} alt={tx.qrAlt} width={320} height={320} />
              ) : (
                <div className="mrt-qr-image-placeholder" aria-hidden="true" />
              )}
            </div>

            <p className="mrt-qr-link" title={medaUrl}>{medaUrl}</p>

            <div className="mrt-qr-actions">
              <button type="button" className="mrt-btn mrt-qr-btn" onClick={handleCopy}>
                {tx.qrCopy}
              </button>
              <button
                type="button"
                className="mrt-btn mrt-qr-btn"
                onClick={handleDownload}
                disabled={!qrDataUrl}
              >
                {tx.qrDownload}
              </button>
              <button
                type="button"
                className="mrt-btn mrt-qr-btn"
                onClick={handlePrint}
                disabled={!qrDataUrl}
              >
                {tx.qrPrint}
              </button>
              <button type="button" className="mrt-btn mrt-qr-btn mrt-qr-btn--close" onClick={onClose}>
                {tx.qrClose}
              </button>
            </div>

            <p className="mrt-qr-status" role="status" aria-live="polite">
              {copied ? tx.qrCopied : ' '}
            </p>

            <div className="mrt-qr-notes">
              <p className="mrt-qr-note">{tx.qrNoData}</p>
              <p className="mrt-qr-note">{tx.qrAuthOnly}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
