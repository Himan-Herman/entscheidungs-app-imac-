import { Stethoscope, Pencil, Trash2 } from "lucide-react";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import "../styles/HealthHistory.css";

export default function DiagnosisCard({
  entry,
  t,
  onEdit,
  onDelete,
  readOnly = false,
  language = "en",
}) {
  const st = t.statuses || {};

  const dateStr = entry.diagnosedDate
    ? new Date(entry.diagnosedDate).toLocaleDateString(getPrimaryIntlLocale(language), {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  function handleDelete() {
    if (window.confirm(t.confirmDelete)) {
      onDelete(entry.id);
    }
  }

  return (
    <article className="hh-card" aria-label={entry.conditionName}>
      <div className="hh-card__top">
        <h3 className="hh-card__name">{entry.conditionName}</h3>
        <Stethoscope size={18} aria-hidden="true" style={{ color: "var(--ms-text-secondary, #6b7280)", flexShrink: 0 }} />
      </div>

      <div className="hh-card__badges">
        <span className={`hh-badge hh-badge--${entry.status}`}>
          {st[entry.status] || entry.status}
        </span>
        {entry.icdCode && (
          <span className="hh-badge hh-badge--icd">
            {entry.icdCode}
          </span>
        )}
      </div>

      {entry.treatingDoctor && (
        <p className="hh-card__detail">
          <strong>{t.treatingDoctorLabel}:</strong> {entry.treatingDoctor}
        </p>
      )}

      {dateStr && (
        <p className="hh-card__detail">
          <strong>{t.diagnosedDateLabel}:</strong> {dateStr}
        </p>
      )}

      {entry.notes && (
        <p className="hh-card__notes">{entry.notes}</p>
      )}

      {!readOnly && (
        <div className="hh-card__actions">
          <button className="hh-card__btn" onClick={() => onEdit(entry)} aria-label={`${t.edit}: ${entry.conditionName}`}>
            <Pencil size={14} aria-hidden="true" />
            {t.edit}
          </button>
          <button className="hh-card__btn hh-card__btn--danger" onClick={handleDelete} aria-label={`${t.delete}: ${entry.conditionName}`}>
            <Trash2 size={14} aria-hidden="true" />
            {t.delete}
          </button>
        </div>
      )}
    </article>
  );
}
