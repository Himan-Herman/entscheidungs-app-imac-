import { Pencil, Trash2 } from "lucide-react";
import "../styles/SymptomDiary.css";

export default function SymptomCard({ entry, t, locale, onEdit, onDelete }) {
  const when = entry.occurredAt
    ? new Date(entry.occurredAt).toLocaleString(locale || undefined, {
        year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "";

  function handleDelete() {
    if (window.confirm(t.confirmDelete)) onDelete(entry.id);
  }

  const details = [
    [t.durationLabel, entry.durationText],
    [t.bodyRegionLabel, entry.bodyRegion],
    [t.triggerLabel, entry.trigger],
    [t.betterWithLabel, entry.betterWith],
    [t.worseWithLabel, entry.worseWith],
    [t.measuresLabel, entry.measuresText],
  ].filter(([, v]) => v && String(v).trim());

  return (
    <article className="sd-card" aria-label={entry.symptom}>
      <div className="sd-card__top">
        <h3 className="sd-card__title">{entry.symptom}</h3>
        <span className="sd-card__sev" aria-label={`${t.severityLabel}: ${entry.severity}/10`}>
          {entry.severity}/10
        </span>
      </div>

      {when && <p className="sd-card__time">{when}</p>}

      {details.length > 0 && (
        <div className="sd-card__details">
          {details.map(([label, value]) => (
            <p className="sd-card__detail" key={label}>
              <strong>{label}:</strong> {value}
            </p>
          ))}
        </div>
      )}

      {entry.notes && <p className="sd-card__notes">{entry.notes}</p>}

      <div className="sd-card__actions">
        <button className="sd-card__btn" onClick={() => onEdit(entry)} aria-label={`${t.edit}: ${entry.symptom}`}>
          <Pencil size={14} aria-hidden="true" />
          {t.edit}
        </button>
        <button className="sd-card__btn sd-card__btn--danger" onClick={handleDelete} aria-label={`${t.delete}: ${entry.symptom}`}>
          <Trash2 size={14} aria-hidden="true" />
          {t.delete}
        </button>
      </div>
    </article>
  );
}
