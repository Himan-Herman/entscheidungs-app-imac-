import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPracticePatientActivity } from "../api/practicePatientsApi.js";

function fmt(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(lang === "de" ? "de-DE" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function activityLabel(type, t) {
  const map = {
    document_shared: t.activityDocumentShared,
    document_share_revoked: t.activityDocumentRevoked,
    document_archived: t.activityDocumentArchived,
    document_deleted: t.activityDocumentDeleted,
    message_sent: t.activityMessageSent,
    profile_access_granted: t.activityProfileGranted,
    profile_access_revoked: t.activityProfileRevoked,
    medication_plan_published: t.activityMedicationPublished,
    relationship_archived: t.activityRelationshipArchived,
    relationship_status_changed: t.activityRelationshipStatus,
    data_request_submitted: t.activityDataRequest,
    thread_created: t.activityThreadCreated,
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

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!linkId || !practiceId) return;
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticePatientActivity(linkId, practiceId);
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setEvents([]);
      setError(t.activityLoadError);
    } finally {
      setLoading(false);
    }
  }, [linkId, practiceId, t.activityLoadError]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="practice-dashboard__card" aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="practice-dashboard__analytics-heading">
        {t.tabActivity}
      </h2>
      <p className="practice-dashboard__muted">{t.activityIntro}</p>

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
                {activityLabel(ev.type, t)}
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
