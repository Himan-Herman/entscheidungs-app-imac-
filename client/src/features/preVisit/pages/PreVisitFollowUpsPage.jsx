import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { authFetch } from "../../../api/authFetch.js";
import PreVisitModuleChrome from "../components/PreVisitModuleChrome.jsx";
import "../styles/PreVisitFollowUpsPage.css";

function fmt(iso, lang) {
  try {
    return new Date(iso).toLocaleString(lang === "de" ? "de-DE" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export default function PreVisitFollowUpsPage() {
  const { language } = useLanguage();
  const t = useMemo(() => getMessages(language).preVisit.followUps, [language]);
  const tMeds = useMemo(
    () => getMessages(language).visitMedications || getMessages("en").visitMedications,
    [language],
  );
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const statusLabel = useCallback((v) => {
    if (v === "waiting_for_patient") return t.waitingForPatient;
    if (v === "answered") return t.answered;
    if (v === "closed") return t.closed;
    if (v === "archived") return t.archived;
    return t.openStatus;
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/previsit/follow-ups");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setRows(Array.isArray(data.threads) ? data.threads : []);
    } catch (e) {
      if (e?.message !== "SESSION_EXPIRED") setError(t.loadError);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="previsit-followups">
      <div className="previsit-followups__inner">
        <PreVisitModuleChrome />
        <h1 className="previsit-followups__title">{t.title}</h1>
        <p className="previsit-followups__lead">{t.intro}</p>
        <p className="previsit-followups__safety">{t.safetyNote}</p>
        <p className="previsit-followups__meds-link">
          <Link to="/pre-visit/medications" className="previsit-followups__meds-cta">
            {tMeds.patientHeading} →
          </Link>
        </p>
        {loading ? (
          <p className="previsit-followups__status" role="status" aria-live="polite">
            {t.loading}
          </p>
        ) : null}
        {error ? (
          <p className="previsit-followups__error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <p className="previsit-followups__lead">{t.empty}</p>
        ) : null}
        <ul className="previsit-followups__list">
          {rows.map((row) => (
            <li key={row.id} className="previsit-followups__card">
              <p><strong>{t.statusLabel}:</strong> {statusLabel(row.status)}</p>
              <p><strong>{t.practiceLabel}:</strong> {row.practice?.practiceName || "—"}</p>
              <p><strong>{t.targetLabel}:</strong> {row.target?.doctorName || row.target?.targetName || "—"}</p>
              <p><strong>{t.relatedPreparation}:</strong> {row.session?.title || "—"}</p>
              <p><strong>{t.createdAt}:</strong> {fmt(row.createdAt, language)}</p>
              <Link
                className="previsit-followups__link-btn"
                to={`/pre-visit/follow-ups/${encodeURIComponent(row.id)}`}
              >
                {t.open}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
