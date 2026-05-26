import { useEffect, useRef, useState } from "react";
import { Check, Clock, Copy, QrCode, Pill, Trash2, X } from "lucide-react";
import QRCode from "qrcode";
import "../styles/Erezept.css";

const STATUS_ICONS = {
  issued: <Clock size={13} aria-hidden="true" />,
  at_pharmacy: <Pill size={13} aria-hidden="true" />,
  redeemed: <Check size={13} aria-hidden="true" />,
  expired: <X size={13} aria-hidden="true" />,
  cancelled: <X size={13} aria-hidden="true" />,
};

function daysLeft(validUntil) {
  const diff = Math.ceil((new Date(validUntil) - Date.now()) / 86_400_000);
  return diff;
}

export default function ErezeptCard({ entry, t, onStatusUpdate, onDelete, readOnly = false, saving = false }) {
  const s = t?.statuses || {};
  const [showQr, setShowQr] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!showQr) return;
    QRCode.toDataURL(entry.tokenCode, { width: 140, margin: 1, color: { dark: "#111827", light: "#ffffff" } })
      .then((url) => setQrUrl(url))
      .catch(() => {});
  }, [showQr, entry.tokenCode]);

  function copyToken() {
    navigator.clipboard.writeText(entry.tokenCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const days = daysLeft(entry.validUntil);
  const isFinal = ["redeemed", "expired", "cancelled"].includes(entry.status);

  const issuedDate = new Date(entry.issuedAt).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
  const validDate = new Date(entry.validUntil).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });

  return (
    <article className={`erx-card erx-card--${entry.status}`} aria-label={entry.medicationName}>
      <div className="erx-card__top">
        <h3 className="erx-card__name">{entry.medicationName}</h3>
        <span className={`erx-badge erx-badge--${entry.status}`}>
          {STATUS_ICONS[entry.status]}
          {s[entry.status] || entry.status}
        </span>
      </div>

      {entry.dosage && (
        <p className="erx-card__detail">
          <strong>{t?.dosage || "Dosierung"}:</strong> {entry.dosage}
        </p>
      )}

      {entry.icdCode && (
        <p className="erx-card__detail">
          <strong>ICD-10:</strong>
          <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{entry.icdCode}</span>
        </p>
      )}

      <p className="erx-card__detail">
        <strong>{t?.issuedAt || "Ausgestellt"}:</strong> {issuedDate}
      </p>

      <p className={`erx-validity erx-validity--${days <= 3 && !isFinal ? "warn" : isFinal ? "expired" : "ok"}`}>
        <Clock size={13} aria-hidden="true" />
        {isFinal
          ? (entry.status === "redeemed"
              ? (t?.redeemedOn || "Eingelöst am") + " " + (entry.redeemedAt ? new Date(entry.redeemedAt).toLocaleDateString() : "")
              : `${t?.validUntil || "Gültig bis"} ${validDate}`)
          : days > 0
          ? `${t?.validDays || "Noch"} ${days} ${t?.days || "Tage"} (${validDate})`
          : (t?.expired || "Abgelaufen")}
      </p>

      {entry.instructions && (
        <p className="erx-card__detail">
          <strong>{t?.instructions || "Hinweise"}:</strong> {entry.instructions}
        </p>
      )}

      {entry.notes && <p className="erx-card__notes">{entry.notes}</p>}

      {/* Token */}
      {!isFinal && (
        <div className="erx-token" aria-label={t?.tokenCode || "Rezept-Code"}>
          <span className="erx-token__code" aria-label={entry.tokenCode}>{entry.tokenCode}</span>
          <button className="erx-token__copy" onClick={copyToken} title={t?.copy || "Kopieren"} aria-label={t?.copy || "Code kopieren"}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      )}

      {/* QR toggle */}
      {!isFinal && (
        <>
          <button className="erx-qr-toggle" onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
            <QrCode size={14} aria-hidden="true" />
            {showQr ? (t?.hideQr || "QR verbergen") : (t?.showQr || "QR-Code anzeigen")}
          </button>
          {showQr && qrUrl && (
            <div className="erx-qr-panel">
              <img src={qrUrl} alt={`QR-Code: ${entry.tokenCode}`} width={140} height={140} />
              <p className="erx-qr-panel__label">{t?.qrHint || "In der Apotheke vorzeigen"}</p>
            </div>
          )}
        </>
      )}

      {/* Patient actions */}
      {!readOnly && !isFinal && (
        <div className="erx-card__actions">
          {entry.status === "issued" && (
            <button
              className="erx-card__btn erx-card__btn--warn"
              onClick={() => onStatusUpdate(entry.id, "at_pharmacy")}
              disabled={saving}
              aria-label={t?.markAtPharmacy || "In Apotheke abgeben"}
            >
              <Pill size={14} aria-hidden="true" />
              {t?.markAtPharmacy || "In Apotheke"}
            </button>
          )}
          {(entry.status === "issued" || entry.status === "at_pharmacy") && (
            <button
              className="erx-card__btn erx-card__btn--primary"
              onClick={() => onStatusUpdate(entry.id, "redeemed")}
              disabled={saving}
              aria-label={t?.markRedeemed || "Als eingelöst markieren"}
            >
              <Check size={14} aria-hidden="true" />
              {t?.markRedeemed || "Eingelöst"}
            </button>
          )}
        </div>
      )}

      {/* Practice actions */}
      {readOnly === false && onDelete && entry.status === "issued" && (
        <div style={{ marginTop: "0.25rem" }}>
          <button
            className="erx-card__btn erx-card__btn--danger"
            onClick={() => {
              if (window.confirm(t?.confirmCancel || "Rezept stornieren?")) onDelete(entry.id);
            }}
            disabled={saving}
          >
            <Trash2 size={14} aria-hidden="true" />
            {t?.cancel || "Stornieren"}
          </button>
        </div>
      )}
    </article>
  );
}
