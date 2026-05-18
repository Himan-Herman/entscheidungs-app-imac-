import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPracticePatientPreVisits } from "../api/practicePatientsApi.js";

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

/**
 * @param {{ linkId: string; practiceId: string }} props
 */
export default function PracticePatientPreVisitsTab({ linkId, practiceId }) {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practicePatients || getMessages("en").practicePatients,
    [language],
  );

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!linkId || !practiceId) return;
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticePatientPreVisits(linkId, practiceId);
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setSessions([]);
      setError(t.preVisitsLoadError);
    } finally {
      setLoading(false);
    }
  }, [linkId, practiceId, t.preVisitsLoadError]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="practice-dashboard__card" aria-labelledby="previsits-heading">
      <h2 id="previsits-heading" className="practice-dashboard__analytics-heading">
        {t.tabPreVisits}
      </h2>
      <p className="practice-dashboard__muted">{t.preVisitsIntro}</p>

      {loading ? <p className="practice-dashboard__muted">{t.loading}</p> : null}
      {error ? (
        <p className="practice-dashboard__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && sessions.length === 0 ? (
        <p className="practice-dashboard__muted">{t.preVisitsEmpty}</p>
      ) : null}

      {!loading && !error && sessions.length > 0 ? (
        <ul className="practice-record__activity-list" aria-label={t.preVisitsListLabel}>
          {sessions.map((s) => (
            <li key={s.id} className="practice-record__activity-item">
              <div>
                <strong>{s.title?.trim() || t.preVisitUntitled}</strong>
                <p className="practice-dashboard__muted" style={{ margin: "0.25rem 0 0" }}>
                  {t.preVisitStatus}: {s.practiceStatus || s.status}
                </p>
              </div>
              <div style={{ textAlign: "end" }}>
                <time dateTime={s.updatedAt}>{fmt(s.updatedAt, language)}</time>
                <br />
                <Link
                  className="practice-dashboard__link-btn"
                  to={`/practice/dashboard/preparations/${encodeURIComponent(s.id)}?practiceId=${encodeURIComponent(practiceId)}`}
                  style={{ marginTop: "0.35rem", display: "inline-block" }}
                >
                  {t.openPreVisitDetail}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
