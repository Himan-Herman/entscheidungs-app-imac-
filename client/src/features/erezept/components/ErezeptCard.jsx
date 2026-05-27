import { useEffect, useRef, useState } from "react";
import { Check, Clock, Copy, Download, QrCode, Pill, Trash2, X } from "lucide-react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import "../styles/Erezept.css";

const STATUS_ICONS = {
  issued: <Clock size={13} aria-hidden="true" />,
  at_pharmacy: <Pill size={13} aria-hidden="true" />,
  redeemed: <Check size={13} aria-hidden="true" />,
  expired: <X size={13} aria-hidden="true" />,
  cancelled: <X size={13} aria-hidden="true" />,
};

function daysLeft(validUntil) {
  return Math.ceil((new Date(validUntil) - Date.now()) / 86_400_000);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("de-DE", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

async function generatePrescriptionPdf(entry, t) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentW = pageW - margin * 2;

  // Header bar
  doc.setFillColor(13, 148, 136);
  doc.rect(0, 0, pageW, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("MedScoutX", margin, 13);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Rezept & Verordnung", margin + 42, 13);

  // Title
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(entry.medicationName, margin, 38);

  // Status badge
  const statusColors = {
    issued: [219, 234, 254],
    at_pharmacy: [254, 243, 199],
    redeemed: [209, 250, 229],
    expired: [241, 245, 249],
    cancelled: [254, 226, 226],
  };
  const [sr, sg, sb] = statusColors[entry.status] || [241, 245, 249];
  const statusLabel = t?.statuses?.[entry.status] || entry.status;
  doc.setFillColor(sr, sg, sb);
  doc.roundedRect(margin, 42, 45, 8, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(55, 65, 81);
  doc.text(statusLabel.toUpperCase(), margin + 2, 47.5);

  // Divider
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(margin, 56, pageW - margin, 56);

  // QR Code
  let qrY = 60;
  try {
    const qrDataUrl = await QRCode.toDataURL(entry.tokenCode, {
      width: 220,
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" },
    });
    doc.addImage(qrDataUrl, "PNG", margin, qrY, 50, 50);
  } catch {
    // QR generation failed — skip silently
  }

  // Token code box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(margin, qrY + 53, contentW, 12, 3, 3, "FD");
  doc.setFont("courier", "bold");
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text(entry.tokenCode, pageW / 2, qrY + 61, { align: "center" });

  // Details section
  const detailX = margin + 58;
  const detailY = qrY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);

  const details = [];
  if (entry.dosage) details.push([t?.dosage || "Dosierung", entry.dosage]);
  if (entry.icdCode) details.push(["ICD-10", entry.icdCode]);
  details.push([t?.issuedAt || "Ausgestellt", formatDate(entry.issuedAt)]);
  details.push([t?.validUntil || "Gültig bis", formatDate(entry.validUntil)]);
  if (entry.instructions) details.push([t?.instructions || "Hinweise", entry.instructions]);

  let dy = detailY;
  for (const [label, value] of details) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(label, detailX, dy + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(17, 24, 39);
    const lines = doc.splitTextToSize(String(value), contentW - (detailX - margin));
    doc.text(lines, detailX, dy + 10);
    dy += 8 + lines.length * 5.5;
    if (dy > qrY + 50) break;
  }

  // Disclaimer footer
  const footerY = 272;
  doc.setFillColor(243, 244, 246);
  doc.rect(0, footerY, pageW, 25, "F");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  const disclaimer = t?.disclaimer ||
    "Simuliertes e-Rezept — kein offizieller TI-Nachweis. Zeige den QR-Code oder Token in der Apotheke vor.";
  const dLines = doc.splitTextToSize(disclaimer, contentW);
  doc.text(dLines, margin, footerY + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Erstellt: ${new Date().toLocaleDateString("de-DE")}`, pageW - margin, footerY + 6, { align: "right" });

  doc.save(`rezept-${entry.tokenCode}.pdf`);
}

export default function ErezeptCard({ entry, t, onStatusUpdate, onDelete, readOnly = false, saving = false }) {
  const s = t?.statuses || {};
  const [showQr, setShowQr] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!showQr) return;
    QRCode.toDataURL(entry.tokenCode, {
      width: 180,
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" },
    })
      .then((url) => setQrUrl(url))
      .catch(() => {});
  }, [showQr, entry.tokenCode]);

  function copyToken() {
    navigator.clipboard.writeText(entry.tokenCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function handlePdfDownload() {
    setPdfLoading(true);
    try {
      await generatePrescriptionPdf(entry, t);
    } finally {
      setPdfLoading(false);
    }
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
          <span className="erx-icd-code">{entry.icdCode}</span>
        </p>
      )}

      <p className="erx-card__detail">
        <strong>{t?.issuedAt || "Ausgestellt"}:</strong> {issuedDate}
      </p>

      <p className={`erx-validity erx-validity--${days <= 3 && !isFinal ? "warn" : isFinal ? "expired" : "ok"}`}>
        <Clock size={13} aria-hidden="true" />
        {isFinal
          ? entry.status === "redeemed"
            ? `${t?.redeemedOn || "Eingelöst am"} ${entry.redeemedAt ? new Date(entry.redeemedAt).toLocaleDateString() : ""}`
            : `${t?.validUntil || "Gültig bis"} ${validDate}`
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

      {/* Token code */}
      {!isFinal && (
        <div className="erx-token" aria-label={t?.tokenCode || "Rezept-Code"}>
          <span className="erx-token__code" aria-label={entry.tokenCode}>{entry.tokenCode}</span>
          <button
            className="erx-token__copy"
            onClick={copyToken}
            title={t?.copy || "Kopieren"}
            aria-label={t?.copy || "Code kopieren"}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      )}

      {/* QR code toggle */}
      {!isFinal && (
        <>
          <button
            className="erx-qr-toggle"
            onClick={() => setShowQr((v) => !v)}
            aria-expanded={showQr}
          >
            <QrCode size={14} aria-hidden="true" />
            {showQr ? (t?.hideQr || "QR verbergen") : (t?.showQr || "QR-Code anzeigen")}
          </button>
          {showQr && qrUrl && (
            <div className="erx-qr-panel">
              <img
                src={qrUrl}
                alt={`QR-Code: ${entry.tokenCode}`}
                width={180}
                height={180}
                className="erx-qr-panel__img"
              />
              <p className="erx-qr-panel__label">{t?.qrHint || "In der Apotheke vorzeigen"}</p>
            </div>
          )}
        </>
      )}

      {/* PDF download — always available */}
      <div className="erx-card__footer">
        <button
          className="erx-card__btn erx-card__btn--pdf"
          onClick={handlePdfDownload}
          disabled={pdfLoading}
          aria-label={t?.pdfDownload || "PDF herunterladen"}
        >
          <Download size={14} aria-hidden="true" />
          {pdfLoading ? (t?.pdfGenerating || "PDF wird erstellt…") : (t?.pdfDownload || "PDF herunterladen")}
        </button>
      </div>

      {/* Patient status actions */}
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

      {/* Practice cancel action */}
      {readOnly === false && onDelete && entry.status === "issued" && (
        <div className="erx-card__footer">
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
