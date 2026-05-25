import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";

function fmtDatetime(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

function getStatus(entry) {
  const { type, valuePrimary, valueSecondary } = entry;
  if (type === "blood_pressure") {
    const sys = valuePrimary;
    const dia = valueSecondary;
    if (sys < 90 || dia < 60) return "low";
    if (sys < 120 && dia < 80) return "normal";
    if (sys < 140 && dia < 90) return "elevated";
    return "elevated";
  }
  if (type === "heart_rate") {
    if (valuePrimary < 60) return "low";
    if (valuePrimary <= 100) return "normal";
    return "elevated";
  }
  if (type === "glucose") {
    if (valuePrimary < 70) return "low";
    if (valuePrimary <= 100) return "normal";
    return "elevated";
  }
  if (type === "oxygen") {
    if (valuePrimary < 95) return "low";
    return "normal";
  }
  if (type === "temperature") {
    if (valuePrimary < 36.1) return "low";
    if (valuePrimary <= 37.2) return "normal";
    return "elevated";
  }
  return "unknown";
}

function formatValue(entry) {
  const { type, valuePrimary, valueSecondary, unit } = entry;
  if (type === "blood_pressure") {
    return `${Math.round(valuePrimary)} / ${Math.round(valueSecondary)}`;
  }
  const val = Number.isInteger(valuePrimary) ? valuePrimary : Number(valuePrimary.toFixed(1));
  return String(val);
}

export default function VitalCard({ entry, t, lang, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const status = getStatus(entry);
  const statusClass = `vital-card__status--${status}`;

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete(entry.id);
    } catch {
      setDeleteError(t.deleteDialog.error);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="vital-card" aria-label={`${t.types[entry.type]} — ${formatValue(entry)} ${entry.unit}`}>
      <div className="vital-card__left">
        <p className="vital-card__type">{t.types[entry.type]}</p>
        <p className="vital-card__value">
          {formatValue(entry)}
          <span className="vital-card__unit"> {entry.unit}</span>
        </p>
        <span className={`vital-card__status ${statusClass}`}>
          {t.status[status]}
        </span>
        <p className="vital-card__date">
          {t.card.measuredAt}: {fmtDatetime(entry.measuredAt, lang)}
        </p>
        {entry.notes && (
          <p className="vital-card__notes">{entry.notes}</p>
        )}
      </div>

      <div className="vital-card__right">
        <button
          type="button"
          className="vital-card__btn"
          onClick={() => onEdit(entry)}
          aria-label={t.card.editAria}
          title={t.card.edit}
        >
          <Pencil size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="vital-card__btn vital-card__btn--danger"
          onClick={() => setConfirmDelete(true)}
          aria-label={t.card.deleteAria}
          title={t.card.delete}
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>

      {confirmDelete && (
        <div
          className="vitals-delete-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vitals-del-title"
        >
          <div className="vitals-delete-dialog__box">
            <h2 id="vitals-del-title" className="vitals-delete-dialog__title">
              {t.deleteDialog.heading}
            </h2>
            <p className="vitals-delete-dialog__body">{t.deleteDialog.body}</p>
            <div className="vitals-delete-dialog__actions">
              <button
                type="button"
                className="vitals-delete-dialog__confirm-btn"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? t.deleteDialog.deleting : t.deleteDialog.confirm}
              </button>
              <button
                type="button"
                className="vitals-delete-dialog__cancel-btn"
                onClick={() => { setConfirmDelete(false); setDeleteError(""); }}
                disabled={deleting}
              >
                {t.deleteDialog.cancel}
              </button>
            </div>
            {deleteError && (
              <p className="vitals-delete-dialog__error" role="alert">{deleteError}</p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
