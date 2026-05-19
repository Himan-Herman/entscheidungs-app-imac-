import React, { useCallback, useState } from "react";

/**
 * @param {object} props
 * @param {import('../bodyMapTypes.js').BodyMapSummary} props.summary
 * @param {Record<string, string>} props.labels
 */
export default function BodyMapSummaryCard({ summary, labels }) {
  const [copyStatus, setCopyStatus] = useState("");

  const copySummary = useCallback(async () => {
    const lines = [
      `${labels.summaryRegion}: ${summary.region}`,
      `${labels.summarySymptoms}: ${summary.symptomSummary || labels.notSpecified}`,
      `${labels.summaryTimeline}: ${summary.timeline || labels.notSpecified}`,
      `${labels.summaryFactors}: ${summary.associatedFactors || labels.notSpecified}`,
    ];
    if (summary.specialties?.length) {
      lines.push(
        `${labels.summarySpecialties}: ${summary.specialties.join(", ")}`,
      );
    }
    if (summary.visitTopics?.length) {
      lines.push(`${labels.summaryVisitTopics}:`);
      summary.visitTopics.forEach((t) => lines.push(`- ${t}`));
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
      className="body-map-summary"
      aria-labelledby="body-map-summary-title"
    >
      <header className="body-map-summary__header">
        <h2 id="body-map-summary-title" className="body-map-summary__title">
          {labels.summaryTitle}
        </h2>
        <p className="body-map-summary__hint">{labels.summaryHint}</p>
      </header>

      <dl className="body-map-summary__grid">
        <div className="body-map-summary__row">
          <dt>{labels.summaryRegion}</dt>
          <dd>{summary.region || labels.notSpecified}</dd>
        </div>
        <div className="body-map-summary__row">
          <dt>{labels.summarySymptoms}</dt>
          <dd>{summary.symptomSummary || labels.notSpecified}</dd>
        </div>
        <div className="body-map-summary__row">
          <dt>{labels.summaryTimeline}</dt>
          <dd>{summary.timeline || labels.notSpecified}</dd>
        </div>
        <div className="body-map-summary__row">
          <dt>{labels.summaryFactors}</dt>
          <dd>{summary.associatedFactors || labels.notSpecified}</dd>
        </div>
        {summary.specialties?.length ? (
          <div className="body-map-summary__row body-map-summary__row--full">
            <dt>{labels.summarySpecialties}</dt>
            <dd>
              <p className="body-map-summary__specialty-lead">
                {labels.specialtyLead}
              </p>
              <ul className="body-map-summary__list">
                {summary.specialties.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {summary.visitTopics?.length ? (
          <div className="body-map-summary__row body-map-summary__row--full">
            <dt>{labels.summaryVisitTopics}</dt>
            <dd>
              <ul className="body-map-summary__list">
                {summary.visitTopics.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="body-map-summary__actions">
        <button
          type="button"
          className="body-map-btn body-map-btn--secondary"
          onClick={() => void copySummary()}
        >
          {labels.copySummary}
        </button>
        {copyStatus ? (
          <span className="body-map-summary__copy-status" role="status">
            {copyStatus}
          </span>
        ) : null}
      </div>
    </section>
  );
}
