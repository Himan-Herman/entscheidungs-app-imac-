import React, { useCallback, useState } from "react";

/**
 * @param {object} props
 * @param {import('../symptomTypes.js').SymptomCheckSummary} props.summary
 * @param {Record<string, string>} props.labels
 */
export default function SymptomSummaryCard({ summary, labels }) {
  const [copyStatus, setCopyStatus] = useState("");

  const copySummary = useCallback(async () => {
    const lines = [
      `${labels.summaryMainComplaints}: ${summary.mainComplaints || labels.notSpecified}`,
      `${labels.summaryLocation}: ${summary.location || labels.notSpecified}`,
      `${labels.summaryTimeline}: ${summary.timeline || labels.notSpecified}`,
      `${labels.summaryFactors}: ${summary.associatedFactors || labels.notSpecified}`,
      `${labels.summaryText}: ${summary.symptomSummary || labels.notSpecified}`,
    ];
    if (summary.specialties?.length) {
      lines.push(
        `${labels.summarySpecialties}: ${summary.specialties.join(", ")}`,
      );
    }
    if (summary.visitTopics?.length) {
      lines.push(`${labels.summaryVisitTopics}:`);
      summary.visitTopics.forEach((topic) => lines.push(`- ${topic}`));
    }

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyStatus(labels.copySuccess);
      setTimeout(() => setCopyStatus(""), 2500);
    } catch {
      setCopyStatus(labels.copyError);
    }
  }, [labels, summary]);

  return (
    <section
      className="symptom-check-summary"
      aria-labelledby="symptom-summary-title"
    >
      <header className="symptom-check-summary__header">
        <h2 id="symptom-summary-title" className="symptom-check-summary__title">
          {labels.summaryTitle}
        </h2>
        <p className="symptom-check-summary__hint">{labels.summaryHint}</p>
      </header>

      <dl className="symptom-check-summary__grid">
        <div className="symptom-check-summary__row">
          <dt>{labels.summaryMainComplaints}</dt>
          <dd>{summary.mainComplaints || labels.notSpecified}</dd>
        </div>
        <div className="symptom-check-summary__row">
          <dt>{labels.summaryLocation}</dt>
          <dd>{summary.location || labels.notSpecified}</dd>
        </div>
        <div className="symptom-check-summary__row">
          <dt>{labels.summaryTimeline}</dt>
          <dd>{summary.timeline || labels.notSpecified}</dd>
        </div>
        <div className="symptom-check-summary__row">
          <dt>{labels.summaryFactors}</dt>
          <dd>{summary.associatedFactors || labels.notSpecified}</dd>
        </div>
        <div className="symptom-check-summary__row symptom-check-summary__row--full">
          <dt>{labels.summaryText}</dt>
          <dd>{summary.symptomSummary || labels.notSpecified}</dd>
        </div>
        {summary.specialties?.length ? (
          <div className="symptom-check-summary__row symptom-check-summary__row--full">
            <dt>{labels.summarySpecialties}</dt>
            <dd>
              <p className="symptom-check-summary__specialty-lead">
                {labels.specialtyLead}
              </p>
              <ul className="symptom-check-summary__list">
                {summary.specialties.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {summary.visitTopics?.length ? (
          <div className="symptom-check-summary__row symptom-check-summary__row--full">
            <dt>{labels.summaryVisitTopics}</dt>
            <dd>
              <ul className="symptom-check-summary__list">
                {summary.visitTopics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="symptom-check-summary__actions">
        <button
          type="button"
          className="symptom-check-btn symptom-check-btn--secondary"
          onClick={() => void copySummary()}
        >
          {labels.copySummary}
        </button>
        {copyStatus ? (
          <span className="symptom-check-summary__copy-status" role="status">
            {copyStatus}
          </span>
        ) : null}
      </div>
    </section>
  );
}
