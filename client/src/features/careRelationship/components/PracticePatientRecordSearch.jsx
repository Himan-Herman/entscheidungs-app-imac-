import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchPracticePatientRecordSearch } from "../api/practicePatientsApi.js";

/**
 * @param {{ linkId: string, practiceId: string, t: Record<string, string>, onNavigateTab: (tab: string) => void }} props
 */
export default function PracticePatientRecordSearch({
  linkId,
  practiceId,
  t,
  onNavigateTab,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const kindLabel = useCallback(
    (kind) => {
      const map = {
        document: t.recordSearchKindDocument,
        thread: t.recordSearchKindThread,
        medication_plan: t.recordSearchKindMedication,
        activity: t.recordSearchKindActivity,
      };
      return map[kind] || kind;
    },
    [t],
  );

  const activityLabel = useCallback(
    (activityType) => {
      const map = {
        message_received: t.activityMessageReceived,
        message_sent: t.activityMessageSent,
        document_shared: t.activityDocumentShared,
        medication_plan_published: t.activityMedicationPublished,
        profile_access_granted: t.activityProfileGranted,
        profile_access_revoked: t.activityProfileRevoked,
        data_request_submitted: t.activityDataRequest,
        relationship_archived: t.activityRelationshipArchived,
        thread_created: t.activityThreadCreated,
        thread_closed: t.activityThreadClosed,
      };
      return map[activityType] || t.recordSearchKindActivity;
    },
    [t],
  );

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError("");
      return undefined;
    }

    const timer = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          const { res, data } = await fetchPracticePatientRecordSearch(
            linkId,
            practiceId,
            query.trim(),
          );
          if (!res.ok || !data.ok) throw new Error("search_failed");
          setResults(Array.isArray(data.results) ? data.results : []);
        } catch {
          setResults([]);
          setError(t.recordSearchLoadError);
        } finally {
          setLoading(false);
        }
      })();
    }, 350);

    return () => clearTimeout(timer);
  }, [query, linkId, practiceId, t.recordSearchLoadError]);

  const listId = useMemo(() => "practice-record-search-results", []);

  return (
    <section className="practice-patients__record-search" aria-labelledby="record-search-heading">
      <h2 id="record-search-heading" className="practice-dashboard__analytics-heading">
        {t.recordSearchLabel}
      </h2>
      <label className="practice-dashboard__field">
        <span className="visually-hidden">{t.recordSearchLabel}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.recordSearchPlaceholder}
          aria-label={t.recordSearchLabel}
          aria-controls={listId}
        />
      </label>

      <p className="practice-dashboard__safety" role="note">
        {t.safetyNote}
      </p>

      {loading ? <p className="practice-dashboard__muted">{t.loading}</p> : null}
      {error ? (
        <p className="practice-dashboard__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && query.trim() && results.length === 0 ? (
        <p className="practice-dashboard__muted" role="status">
          {t.recordSearchEmpty}
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul id={listId} className="practice-patients__record-search-list">
          {results.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <button
                type="button"
                className="patient-threads__btn patient-threads__btn--secondary"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => onNavigateTab(item.tab)}
              >
                <span className="practice-patients__record-search-kind">{kindLabel(item.kind)}</span>
                <span>
                  {item.kind === "activity"
                    ? activityLabel(item.label)
                    : item.label || t.notProvided}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
