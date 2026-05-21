import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';
import {
  fetchPracticePatientActivity,
  postPracticePatientActivityAiSummary,
} from "../api/practicePatientsApi.js";

function fmt(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function activityLabel(type, t, tAct) {
  const fromActivity = tAct[`type_${type}`];
  if (fromActivity) return fromActivity;
  const map = {
    document_shared: t.activityDocumentShared,
    document_share_revoked: t.activityDocumentRevoked,
    document_archived: t.activityDocumentArchived,
    document_deleted: t.activityDocumentDeleted,
    message_sent: t.activityMessageSent,
    message_received: t.activityMessageReceived,
    profile_access_granted: t.activityProfileGranted,
    profile_access_revoked: t.activityProfileRevoked,
    profile_viewed: t.activityProfileViewed,
    medication_plan_published: t.activityMedicationPublished,
    relationship_archived: t.activityRelationshipArchived,
    relationship_status_changed: t.activityRelationshipStatus,
    data_request_submitted: t.activityDataRequest,
    data_export_requested: t.activityDataExport,
    data_request_updated: t.activityDataRequestUpdated,
    thread_created: t.activityThreadCreated,
    thread_closed: t.activityThreadClosed,
    thread_archived: t.activityThreadArchived,
  };
  return map[type] || type;
}

/**
 * @param {{ linkId: string; practiceId: string }} props
 */
export default function PracticePatientActivityTab({ linkId, practiceId }) {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practicePatients || getMessages("en").practicePatients,
    [language],
  );
  const tAct = useMemo(
    () => getMessages(language).patientActivity || getMessages("en").patientActivity,
    [language],
  );

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const load = useCallback(async () => {
    if (!linkId || !practiceId) return;
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticePatientActivity(linkId, practiceId, {
        type: typeFilter || undefined,
        q: search.trim() || undefined,
      });
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setEvents([]);
      setError(t.activityLoadError);
    } finally {
      setLoading(false);
    }
  }, [linkId, practiceId, typeFilter, search, t.activityLoadError]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadAi() {
    setAiBusy(true);
    setAiSummary("");
    try {
      const { res, data } = await postPracticePatientActivityAiSummary(
        linkId,
        practiceId,
        language,
      );
      if (res.status === 503 && data.error === "ai_not_configured") {
        setError(t.activityAiNotConfigured);
        return;
      }
      if (!res.ok || !data.ok) {
        setError(t.activityAiError);
        return;
      }
      setAiSummary(data.summary || "");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <section className="practice-dashboard__card" aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="practice-dashboard__analytics-heading">
        {t.tabActivity}
      </h2>
      <p className="practice-dashboard__muted">{t.activityIntro}</p>

      <form
        className="patient-data-control__filters"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label>
          <span>{t.activityFilterType}</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.activityFilterSearchPlaceholder}
            aria-label={t.activityFilterSearch}
          />
        </label>
        <button type="submit" className="patient-threads__btn patient-threads__btn--secondary">
          {t.activityApplyFilters}
        </button>
        <button
          type="button"
          className="patient-threads__btn patient-threads__btn--secondary"
          disabled={aiBusy}
          onClick={loadAi}
        >
          {aiBusy ? t.activityAiLoading : t.activityAiButton}
        </button>
      </form>

      {aiSummary ? (
        <aside className="patient-data-control__ai-box" style={{ marginTop: "1rem" }}>
          <h3 className="practice-dashboard__analytics-heading" style={{ fontSize: "1rem" }}>
            {t.activityAiHeading}
          </h3>
          <p className="patient-data-control__ai-hint">{t.activityAiHint}</p>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>{aiSummary}</pre>
        </aside>
      ) : null}

      {loading ? <p className="practice-dashboard__muted">{t.loading}</p> : null}
      {error ? (
        <p className="practice-dashboard__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && events.length === 0 ? (
        <p className="practice-dashboard__muted">{t.activityEmpty}</p>
      ) : null}

      {!loading && !error && events.length > 0 ? (
        <ul className="practice-record__activity-list" aria-label={t.activityListLabel}>
          {events.map((ev) => (
            <li key={ev.id} className="practice-record__activity-item">
              <span className="practice-record__activity-type">
                {activityLabel(ev.type, t, tAct)}
              </span>
              <time className="practice-record__activity-time" dateTime={ev.occurredAt}>
                {fmt(ev.occurredAt, language)}
              </time>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
