export default function VisitMedicationCard({ entry, t }) {
  return (
    <article className="vm-card">
      <h3 className="vm-card__title">{entry.drugName}</h3>
      <dl className="vm-card__dl">
        {entry.dosage ? (
          <div className="vm-card__row">
            <dt>{t.fieldDosage}</dt>
            <dd>{entry.dosage}</dd>
          </div>
        ) : null}
        <div className="vm-card__row">
          <dt>{t.fieldFrequency}</dt>
          <dd>{entry.frequency}</dd>
        </div>
        {entry.intakeInstructions ? (
          <div className="vm-card__row">
            <dt>{t.fieldIntake}</dt>
            <dd>{entry.intakeInstructions}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}
