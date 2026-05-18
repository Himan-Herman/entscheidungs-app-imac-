function fmtDate(iso, lang) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", {
      dateStyle: "medium",
    });
  } catch {
    return null;
  }
}

export default function MedicationPlanItemCard({ item, t, language }) {
  const start = fmtDate(item.startDate, language);
  const end = fmtDate(item.endDate, language);

  return (
    <article className="vm-card">
      <h3 className="vm-card__title">{item.medicationName}</h3>
      <dl className="vm-card__dl">
        {item.dosage ? (
          <div className="vm-card__row">
            <dt>{t.fieldDosage}</dt>
            <dd>{item.dosage}</dd>
          </div>
        ) : null}
        {item.frequency ? (
          <div className="vm-card__row">
            <dt>{t.fieldFrequency}</dt>
            <dd>{item.frequency}</dd>
          </div>
        ) : null}
        {item.route ? (
          <div className="vm-card__row">
            <dt>{t.fieldRoute}</dt>
            <dd>{item.route}</dd>
          </div>
        ) : null}
        {item.schedule ? (
          <div className="vm-card__row">
            <dt>{t.fieldSchedule}</dt>
            <dd>{item.schedule}</dd>
          </div>
        ) : null}
        {start ? (
          <div className="vm-card__row">
            <dt>{t.fieldStart}</dt>
            <dd>{start}</dd>
          </div>
        ) : null}
        {end ? (
          <div className="vm-card__row">
            <dt>{t.fieldEnd}</dt>
            <dd>{end}</dd>
          </div>
        ) : null}
        {item.instructions ? (
          <div className="vm-card__row">
            <dt>{t.fieldInstructions}</dt>
            <dd>{item.instructions}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}
