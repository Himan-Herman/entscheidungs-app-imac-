import { useEffect, useRef } from "react";

/**
 * Renders a QR code for the public emergency URL using the canvas API.
 * Uses the lightweight `qrcode` package (already a common dep) or falls back
 * to the browser's built-in if available.
 *
 * We use dynamic import so the chunk is only loaded when QR is shown.
 */
export default function SosCardQr({ token, baseUrl }) {
  const canvasRef = useRef(null);

  const url = `${baseUrl || window.location.origin}/emergency/${token}`;

  useEffect(() => {
    if (!token || !canvasRef.current) return;
    let cancelled = false;

    import("qrcode")
      .then((QRCode) => {
        if (cancelled || !canvasRef.current) return;
        QRCode.toCanvas(canvasRef.current, url, {
          width: 240,
          margin: 2,
          color: { dark: "#111827", light: "#ffffff" },
        });
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [token, url]);

  return (
    <div className="sos-card__qr-panel">
      <canvas ref={canvasRef} className="sos-card__qr-canvas" />
      <p className="sos-card__qr-url">{url}</p>
    </div>
  );
}
