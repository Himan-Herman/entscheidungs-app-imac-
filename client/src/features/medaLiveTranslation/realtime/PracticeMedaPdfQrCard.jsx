import React, { useState } from 'react';

/**
 * Practice-only card in the end-of-session area: optionally provide the Meda
 * session PDF via a secure, time-limited QR link.
 *
 * The QR encodes only the backend token URL — never patient data or conversation
 * content. The PDF is uploaded ONLY after the user gives explicit consent and
 * clicks the button. The normal local PDF download and the local history are not
 * affected by this component.
 *
 * @param {object}   props
 * @param {object}   props.tx          Practice i18n messages (getPracticeChromeMessages)
 * @param {string}   props.practiceId  Practice id from the URL (may be empty)
 * @param {() => Promise<{url:string, expiresAt:string}>} props.onProvide
 *        Builds the PDF blob, uploads it, and resolves with the token link.
 *        Rejects with an Error whose `.code` may be 'feature_disabled'.
 */
export default function PracticeMedaPdfQrCard({ tx, practiceId, onProvide }) {
  const [consent,   setConsent]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(/** @type {string|null} */ (null));
  const [link,      setLink]      = useState(/** @type {{url:string, expiresAt:string}|null} */ (null));
  const [error,     setError]     = useState(/** @type {string|null} */ (null));
  const [copied,    setCopied]    = useState(false);

  const hasPractice = !!practiceId;

  async function handleProvide() {
    setError(null);
    setLoading(true);
    try {
      const result = await onProvide();
      const QRCode  = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(result.url, {
        width: 320, margin: 2, color: { dark: '#0f172a', light: '#ffffff' },
      });
      setLink(result);
      setQrDataUrl(dataUrl);
    } catch (err) {
      setError(err?.code === 'feature_disabled'
        ? tx.pdfQrErrFeatureDisabled
        : tx.pdfQrErrUpload);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!link?.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard unavailable — link stays visible */ }
  }

  function handleDownload() {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = 'medscoutx-meda-pdf-qr.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function fmtTime(iso) {
    try {
      return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  return (
    <div className="mrt-pdfqr-card">
      <h3 className="mrt-pdfqr-title">{tx.pdfQrTitle}</h3>
      <p className="mrt-pdfqr-hint">{tx.pdfQrHint}</p>

      {!hasPractice ? (
        <p className="mrt-pdfqr-msg" role="status">{tx.pdfQrErrNoPractice}</p>
      ) : !qrDataUrl ? (
        <>
          <label className="mrt-pdfqr-consent">
            <input
              type="checkbox"
              className="mrt-consent-checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              disabled={loading}
            />
            <span>{tx.pdfQrConsent}</span>
          </label>
          <button
            type="button"
            className="mrt-btn mrt-pdfqr-btn"
            onClick={handleProvide}
            disabled={!consent || loading}
            aria-disabled={!consent || loading}
          >
            {loading ? tx.pdfQrProviding : tx.pdfQrProvide}
          </button>
          <p className="mrt-pdfqr-status mrt-pdfqr-status--error" role="status" aria-live="polite">
            {error || ' '}
          </p>
        </>
      ) : (
        <div className="mrt-pdfqr-result">
          <div className="mrt-qr-image-wrap">
            {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
            <img className="mrt-qr-image" src={qrDataUrl} alt={tx.pdfQrAlt} width={240} height={240} />
          </div>
          <p className="mrt-pdfqr-expires">
            {String(tx.pdfQrExpires).replace('{time}', fmtTime(link.expiresAt))}
          </p>
          <p className="mrt-qr-link" title={link.url}>{link.url}</p>
          <div className="mrt-pdfqr-actions">
            <button type="button" className="mrt-btn mrt-qr-btn" onClick={handleCopy}>
              {tx.pdfQrCopy}
            </button>
            <button type="button" className="mrt-btn mrt-qr-btn" onClick={handleDownload}>
              {tx.pdfQrDownload}
            </button>
          </div>
          <p className="mrt-pdfqr-status" role="status" aria-live="polite">
            {copied ? tx.pdfQrCopied : ' '}
          </p>
        </div>
      )}
    </div>
  );
}
