import { daysUntilEnd } from "../patientOwnMedicationStore.js";

/**
 * @param {{
 *   entry: object;
 *   onEdit: () => void;
 *   onDelete: () => void;
 *   labels: object;
 * }} props
 */
export default function PatientOwnMedicationCard({ entry, onEdit, onDelete, labels: t }) {
  const daysLeft = daysUntilEnd(entry.endDate);
  const showEndWarning =
    typeof daysLeft === "number" && daysLeft >= 0 && daysLeft <= 3;

  return (
    <article className="patient-own-med__card">
      <header className="patient-own-med__card-head">
        <h3 className="patient-own-med__card-title">{entry.name}</h3>
        {entry.reminderEnabled ? (
          <span className="patient-own-med__badge">{t.ownCard.reminderOn}</span>
        ) : null}
      </header>
      {entry.dosage ? (
        <p className="patient-own-med__card-line">
          <span className="patient-own-med__card-k">{t.fieldDosage}:</span> {entry.dosage}
        </p>
      ) : null}
      {entry.schedule ? (
        <p className="patient-own-med__card-line">
          <span className="patient-own-med__card-k">{t.fieldSchedule}:</span>{" "}
          {entry.schedule}
        </p>
      ) : null}
      {entry.endDate ? (
        <p className="patient-own-med__card-line">
          <span className="patient-own-med__card-k">{t.fieldEnd}:</span> {entry.endDate}
        </p>
      ) : null}
      {showEndWarning ? (
        <p className="patient-own-med__warn" role="status">
          {t.ownCard.endWarning.replace("{days}", String(daysLeft))}
        </p>
      ) : null}
      <div className="patient-own-med__card-actions">
        <button
          type="button"
          className="patient-own-med__btn patient-own-med__btn--secondary"
          onClick={onEdit}
        >
          {t.ownCard.edit}
        </button>
        <button
          type="button"
          className="patient-own-med__btn patient-own-med__btn--danger"
          onClick={onDelete}
        >
          {t.ownCard.delete}
        </button>
      </div>
    </article>
  );
}
