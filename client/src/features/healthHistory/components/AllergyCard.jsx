import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import "../styles/HealthHistory.css";

const SEVERITY_ORDER = ["life_threatening", "severe", "moderate", "mild"];

function severityClass(severity) {
  return `hh-badge hh-badge--${severity}`;
}

export default function AllergyCard({
  entry,
  t,
  onEdit,
  onDelete,
  readOnly = false,
  language = "en",
}) {
  const s = t.severities || {};
  const ty = t.types || {};
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
    <article className="hh-card" aria-label={entry.allergen}>
      <div className="hh-card__top">
        <h3 className="hh-card__name">{entry.allergen}</h3>
        <AlertTriangle
          size={18}
          className={`hh-severity-icon hh-severity-icon--${entry.severity}`}
          aria-hidden="true"
        />
      </div>

      <div className="hh-card__badges">
        <span className={severityClass(entry.severity)}>
          {s[entry.severity] || entry.severity}
        </span>
        <span className="hh-badge hh-badge--type">
          {ty[entry.allergyType] || entry.allergyType}
        </span>
        {entry.status !== "active" && (
          <span className={`hh-badge hh-badge--${entry.status}`}>
            {st[entry.status] || entry.status}
          </span>
        )}
      </div>

      {entry.reaction && (
        <p className="hh-card__detail">
          <strong>{t.reaction}:</strong>{" "}
          {entry.reaction.length > 160 ? entry.reaction.slice(0, 157) + "…" : entry.reaction}
        </p>
      )}

      {dateStr && (
        <p className="hh-card__detail">
          <strong>{t.diagnosedDate}:</strong> {dateStr}
        </p>
      )}

      {entry.notes && (
        <p className="hh-card__notes">{entry.notes}</p>
      )}

      {!readOnly && (
        <div className="hh-card__actions">
          <button className="hh-card__btn" onClick={() => onEdit(entry)} aria-label={`${t.edit}: ${entry.allergen}`}>
            <Pencil size={14} aria-hidden="true" />
            {t.edit}
          </button>
          <button className="hh-card__btn hh-card__btn--danger" onClick={handleDelete} aria-label={`${t.delete}: ${entry.allergen}`}>
            <Trash2 size={14} aria-hidden="true" />
            {t.delete}
          </button>
        </div>
      )}
    </article>
  );
}
