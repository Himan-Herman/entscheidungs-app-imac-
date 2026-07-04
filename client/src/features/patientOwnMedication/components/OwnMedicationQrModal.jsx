import { useEffect, useRef, useState } from "react";

/**
 * Accessible modal that renders a QR code encoding a share URL for the patient's
 * medication list. The list data lives in the URL hash fragment, so scanning the
 * QR opens a read-only view WITHOUT any MedScoutX account or login — and the
 * server never receives the health data (the fragment is never sent).
 *
 * QR codes have a payload limit; very long lists produce an over-long URL, so we
 * show a hint pointing to the PDF/email path instead of silently failing.
 *
 * @param {object} props
 * @param {string} props.url    Full share URL to encode (data in the hash).
 * @param {object} props.t      Summary i18n block.
 * @param {() => void} props.onClose
 */
export default function OwnMedicationQrModal({ url, t, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | too-long | error
  const [copied, setCopied] = useState(false);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setQrDataUrl(null);

    const payload = String(url || "");
    // Keep well within a scannable byte-mode / error-correction budget.
    if (!payload || payload.length > 1800) {
      setStatus("too-long");
      return undefined;
    }

    import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(payload, {
          width: 320,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#0f172a", light: "#ffffff" },
        }),
      )
      .then((dataUrl) => {
        if (cancelled) return;
        setQrDataUrl(dataUrl);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(url || ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable — link is still visible below */
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = "medscoutx-medikamente-qr.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    if (!qrDataUrl) return;
    const w = window.open("", "_blank", "noopener,noreferrer,width=480,height=640");
    if (!w) return;
    const safeTitle = String(t.qrTitle || "QR");
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>` +
        `<style>body{font-family:system-ui,sans-serif;text-align:center;padding:24px;color:#0f172a}` +
        `img{width:320px;height:320px}</style></head>` +
        `<body><h2>${safeTitle}</h2><img src="${qrDataUrl}" alt="">` +
        `<script>window.onload=function(){window.print();}</script></body></html>`,
    );
    w.document.close();
  };

  return (
    <div className="pmed-qr-backdrop" onMouseDown={onClose}>
      <div
        className="pmed-qr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pmed-qr-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="pmed-qr-head">
          <h2 id="pmed-qr-title" className="pmed-qr-title">
            {t.qrTitle}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="pmed-qr-close"
            onClick={onClose}
            aria-label={t.qrClose}
          >
            ✕
          </button>
        </div>

        <p className="pmed-qr-intro">{t.qrIntro}</p>

        <div className="pmed-qr-image-wrap">
          {status === "ready" && qrDataUrl ? (
            <img
              className="pmed-qr-image"
              src={qrDataUrl}
              alt={t.qrAlt}
              width={320}
              height={320}
            />
          ) : status === "too-long" ? (
            <p className="pmed-qr-error" role="alert">
              {t.qrTooLong}
            </p>
          ) : status === "error" ? (
            <p className="pmed-qr-error" role="alert">
              {t.qrError}
            </p>
          ) : (
            <div className="pmed-qr-placeholder" aria-hidden="true" />
          )}
        </div>

        {status === "ready" && url ? (
          <p className="pmed-qr-url" title={url}>
            {url}
          </p>
        ) : null}

        <div className="pmed-qr-actions">
          <button
            type="button"
            className="pmed-btn pmed-btn--secondary"
            onClick={handleCopy}
            disabled={status !== "ready"}
          >
            {copied ? t.qrCopied : t.qrCopy}
          </button>
          <button
            type="button"
            className="pmed-btn pmed-btn--secondary"
            onClick={handleDownload}
            disabled={status !== "ready"}
          >
            {t.qrDownload}
          </button>
          <button
            type="button"
            className="pmed-btn pmed-btn--secondary"
            onClick={handlePrint}
            disabled={status !== "ready"}
          >
            {t.qrPrint}
          </button>
          <button type="button" className="pmed-btn pmed-btn--primary" onClick={onClose}>
            {t.qrClose}
          </button>
        </div>
      </div>
    </div>
  );
}
