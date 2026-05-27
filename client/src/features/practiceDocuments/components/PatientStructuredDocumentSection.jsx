import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  fetchPatientStructuredDocument,
  fetchLabExplanation,
} from "../api/documentOcrApi.js";
import "../styles/DocumentOcrSection.css";

/**
 * @param {{ documentId: string }} props
 */
export default function PatientStructuredDocumentSection({ documentId }) {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).documentOcr || getMessages("en").documentOcr,
    [language],
  );

  const [structured, setStructured] = useState(null);
  const [loading, setLoading] = useState(true);

  // Explanation state
  const [explainState, setExplainState] = useState("idle"); // idle | loading | done | error
  const [explainData, setExplainData] = useState(null); // { entries, disclaimer }
  const [explainError, setExplainError] = useState(null);
  const explainCacheRef = useRef(null);

  const load = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    const { res, data } = await fetchPatientStructuredDocument(documentId);
    if (res.ok && data.ok && data.structured) {
      setStructured(data.structured);
    } else {
      setStructured(null);
    }
    setLoading(false);
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRequestExplanation = useCallback(async () => {
    if (explainCacheRef.current) {
      setExplainData(explainCacheRef.current);
      setExplainState("done");
      return;
    }
    setExplainState("loading");
    setExplainError(null);
    try {
      const { res, data } = await fetchLabExplanation(documentId, language);
      if (res.status === 429) {
        const isDailyLimit = data?.error === "daily_limit_exceeded";
        setExplainError(isDailyLimit ? t.labExplainDailyLimit : t.labExplainRateLimit);
        setExplainState("error");
        return;
      }
      if (res.status === 409) {
        setExplainError(t.labExplainNotShared);
        setExplainState("error");
        return;
      }
      if (!res.ok || !data.ok) {
        setExplainError(t.labExplainError);
        setExplainState("error");
        return;
      }
      const result = { entries: data.entries ?? [], disclaimer: data.disclaimer ?? null };
      explainCacheRef.current = result;
      setExplainData(result);
      setExplainState("done");
    } catch {
      setExplainError(t.labExplainError);
      setExplainState("error");
    }
  }, [documentId, language, t]);

  if (loading || !structured?.entries?.length) return null;

  return (
    <section className="document-ocr" aria-labelledby="patient-structured-heading">
      <h2 id="patient-structured-heading">{t.structuredViewHeading}</h2>
      <p className="document-ocr__hint">{t.sourcePractice}</p>
      <p className="document-ocr__hint" role="note">
        {t.autoDetectedHint}
      </p>
      <p className="patient-inbox__safety">{t.patientDisclaimer}</p>

      <h3>{t.labTableHeading}</h3>
      <div className="document-ocr__table-wrap">
        <table className="document-ocr__table" aria-label={t.labTableHeading}>
          <thead>
            <tr>
              <th scope="col">{t.colLabel}</th>
              <th scope="col">{t.colValue}</th>
              <th scope="col">{t.colUnit}</th>
              <th scope="col">{t.colReference}</th>
            </tr>
          </thead>
          <tbody>
            {structured.entries.map((row, i) => (
              <tr key={row.id || i}>
                <td>{row.label}</td>
                <td>{row.valueText || t.unclear}</td>
                <td>{row.unit || t.notProvided}</td>
                <td>{row.referenceRangeText || t.notProvided}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="document-ocr__cards" aria-label={t.labTableHeading}>
        {structured.entries.map((row, i) => (
          <dl key={row.id || i} className="document-ocr__card">
            <dt>{t.colLabel}</dt>
            <dd>{row.label}</dd>
            <dt>{t.colValue}</dt>
            <dd>{row.valueText || t.unclear}</dd>
            <dt>{t.colUnit}</dt>
            <dd>{row.unit || t.notProvided}</dd>
            <dt>{t.colReference}</dt>
            <dd>{row.referenceRangeText || t.notProvided}</dd>
          </dl>
        ))}
      </div>

      {/* ── AI Explanation ── */}
      <div className="lab-explain">
        {explainState === "idle" && (
          <button
            type="button"
            className="lab-explain__request-btn"
            onClick={handleRequestExplanation}
          >
            <FlaskConical size={16} strokeWidth={2} aria-hidden="true" />
            {t.labExplainBtn}
          </button>
        )}

        {explainState === "loading" && (
          <p className="lab-explain__loading" aria-live="polite">
            {t.labExplainLoading}
          </p>
        )}

        {explainState === "error" && (
          <div className="lab-explain__error" role="alert">
            <span>{explainError}</span>
            <button
              type="button"
              className="lab-explain__error-retry"
              onClick={() => {
                setExplainState("idle");
                setExplainError(null);
              }}
            >
              {t.labExplainRetry}
            </button>
          </div>
        )}

        {explainState === "done" && explainData && (
          <>
            <div className="lab-explain__mdr-box" role="note">
              {t.labExplainMdrNote}
            </div>
            <h3 className="lab-explain__heading">{t.labExplainHeading}</h3>
            <ul className="lab-explain__list" aria-label={t.labExplainHeading}>
              {explainData.entries.map((entry, i) => {
                const rangeClass =
                  entry.inRange === true
                    ? "in-range"
                    : entry.inRange === false
                      ? "out-of-range"
                      : "unknown-range";
                const badgeClass =
                  entry.inRange === true ? "in" : entry.inRange === false ? "out" : "unknown";
                const badgeLabel =
                  entry.inRange === true
                    ? t.labExplainInRange
                    : entry.inRange === false
                      ? t.labExplainOutOfRange
                      : t.labExplainUnknownRange;
                return (
                  <li key={i} className={`lab-explain__card lab-explain__card--${rangeClass}`}>
                    <div className="lab-explain__card-header">
                      <span className="lab-explain__card-label">{entry.label}</span>
                      <span className={`lab-explain__badge lab-explain__badge--${badgeClass}`}>
                        {badgeLabel}
                      </span>
                    </div>
                    <p className="lab-explain__card-text">{entry.explanation}</p>
                  </li>
                );
              })}
            </ul>
            {explainData.disclaimer && (
              <p className="lab-explain__disclaimer">{explainData.disclaimer}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
