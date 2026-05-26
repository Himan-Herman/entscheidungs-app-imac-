import { useState } from "react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";

function fmtDate(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(getPrimaryIntlLocale(lang), { dateStyle: "medium" });
  } catch {
    return iso.slice(0, 10);
  }
}

function statusKey(entry) {
  if (!entry.nextDueDate) return "noReminder";
  const due = new Date(entry.nextDueDate);
  const now = new Date();
  const diff = (due - now) / 86400000;
  if (diff < 0) return "overdue";
  if (diff <= 30) return "dueSoon";
  return "upToDate";
}

export default function VaccinationEntryCard({ entry, t, lang, onEdit, onDelete, readOnly = false }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const sk = statusKey(entry);
  const statusClass = {
    upToDate: "vacc-card__status--up-to-date",
    dueSoon: "vacc-card__status--due-soon",
    overdue: "vacc-card__status--overdue",
    noReminder: "vacc-card__status--no-reminder",
  }[sk];

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete(entry.id);
      setConfirmDelete(false);
    } catch {
      setDeleteError(t.deleteDialog.error);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="vacc-card" aria-label={entry.vaccineName}>
      <div className="vacc-card__top">
        <h3 className="vacc-card__name">{entry.vaccineName}</h3>
        <span className={`vacc-card__status ${statusClass}`}>
          {t.status[sk]}
        </span>
      </div>

      <p className="vacc-card__date">
        {fmtDate(entry.vaccinationDate, lang)}
      </p>

      <div className="vacc-card__meta">
        {entry.doseLabel && (
          <div className="vacc-card__meta-item">
            <span className="vacc-card__meta-label">{t.card.dose}</span>
            <span className="vacc-card__meta-value">{entry.doseLabel}</span>
          </div>
        )}
        {entry.lotNumber && (
          <div className="vacc-card__meta-item">
            <span className="vacc-card__meta-label">{t.card.lot}</span>
            <span className="vacc-card__meta-value">{entry.lotNumber}</span>
          </div>
        )}
        {entry.location && (
          <div className="vacc-card__meta-item">
            <span className="vacc-card__meta-label">{t.card.location}</span>
            <span className="vacc-card__meta-value">{entry.location}</span>
          </div>
        )}
        {entry.nextDueDate && (
          <div className="vacc-card__meta-item">
            <span className="vacc-card__meta-label">{t.card.nextDue}</span>
            <span className="vacc-card__meta-value">{fmtDate(entry.nextDueDate, lang)}</span>
          </div>
        )}
        {entry.createdAt && (
          <div className="vacc-card__meta-item">
            <span className="vacc-card__meta-label">{t.card.createdAt}</span>
            <span className="vacc-card__meta-value">{fmtDate(entry.createdAt, lang)}</span>
          </div>
        )}
      </div>

      {entry.notes && (
        <p className="vacc-card__notes">{entry.notes}</p>
      )}

      {entry.documentUrl && (
        <a
          className="vacc-card__doc-link"
          href={entry.documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.card.viewDocument}
        >
          <ExternalLink size={14} />
          {t.card.viewDocument}
        </a>
      )}

      {!readOnly && (
        <div className="vacc-card__actions">
          <button
            type="button"
            className="vacc-card__btn"
            onClick={() => onEdit(entry)}
            aria-label={t.card.editAria}
          >
            <Pencil size={14} />
            {t.card.edit}
          </button>
          <button
            type="button"
            className="vacc-card__btn vacc-card__btn--danger"
            onClick={() => setConfirmDelete(true)}
            aria-label={t.card.deleteAria}
          >
            <Trash2 size={14} />
            {t.card.delete}
          </button>
        </div>
      )}

      {confirmDelete && (
        <div className="vacc-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="vacc-del-title">
          <div className="vacc-delete-dialog__box">
            <h2 id="vacc-del-title" className="vacc-delete-dialog__title">
              {t.deleteDialog.heading}
            </h2>
            <p className="vacc-delete-dialog__body">{t.deleteDialog.body}</p>
            <div className="vacc-delete-dialog__actions">
              <button
                type="button"
                className="vacc-delete-dialog__confirm-btn"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? t.deleteDialog.deleting : t.deleteDialog.confirm}
              </button>
              <button
                type="button"
                className="vacc-delete-dialog__cancel-btn"
                onClick={() => { setConfirmDelete(false); setDeleteError(""); }}
                disabled={deleting}
              >
                {t.deleteDialog.cancel}
              </button>
            </div>
            {deleteError && (
              <p className="vacc-delete-dialog__error" role="alert">{deleteError}</p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
