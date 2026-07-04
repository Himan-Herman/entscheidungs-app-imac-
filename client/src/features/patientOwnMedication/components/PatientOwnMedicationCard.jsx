import { daysUntilEnd } from "../patientOwnMedicationStore.js";
import { computeSupply, isRunningLow } from "../supplyCalc.js";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";

/**
 * @param {{
 *   entry: object;
 *   onEdit: () => void;
 *   onDelete: () => void;
 *   labels: object;
 *   lang?: string;
 * }} props
 */
export default function PatientOwnMedicationCard({
  entry,
  onEdit,
  onDelete,
  labels: t,
  lang = "de",
}) {
  const daysLeft = daysUntilEnd(entry.endDate);
  const showEndWarning =
    typeof daysLeft === "number" && daysLeft >= 0 && daysLeft <= 3;

  const supply = computeSupply(entry);
  const runningLow = isRunningLow(supply, 2);
  const runOutDate = supply
    ? (() => {
        try {
          return supply.runOutDate.toLocaleDateString(getPrimaryIntlLocale(lang), {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
        } catch {
          return "";
        }
      })()
    : "";

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
      {supply ? (
        <p className="patient-own-med__card-line patient-own-med__supply-info">
          <span className="patient-own-med__card-k">{t.supply.remainingLabel}:</span>{" "}
          {t.supply.remaining
            .replace("{remaining}", String(Math.round(supply.remaining)))
            .replace("{unit}", supply.unit || t.supply.unitFallback)
            .replace("{date}", runOutDate)}
        </p>
      ) : null}
      {runningLow ? (
        <p className="patient-own-med__supply-warn" role="status">
          {supply.daysLeft <= 0
            ? t.supply.today
            : t.supply.low.replace("{days}", String(supply.daysLeft))}
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
          aria-label={`${t.ownCard.edit}: ${entry.name}`}
        >
          {t.ownCard.edit}
        </button>
        <button
          type="button"
          className="patient-own-med__btn patient-own-med__btn--danger"
          onClick={onDelete}
          aria-label={`${t.ownCard.delete}: ${entry.name}`}
        >
          {t.ownCard.delete}
        </button>
      </div>
    </article>
  );
}
