import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { authFetch } from "../../../api/authFetch.js";
import ExportsPanel from "../components/ExportsPanel.jsx";
import "../../../styles/PracticeDashboardPage.css";
import "../../../styles/ExportsPage.css";

export default function PracticeExportsPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).exports || getMessages("en").exports,
    [language],
  );

  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState("");

  const loadPractices = useCallback(async () => {
    const res = await authFetch("/api/practices");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    const rows = Array.isArray(data.practices) ? data.practices : [];
    setPractices(rows);
    if (!practiceId && rows[0]?.id) setPracticeId(rows[0].id);
  }, [practiceId]);

  useEffect(() => {
    document.title = t.pageTitlePractice;
  }, [t.pageTitlePractice]);

  useEffect(() => {
    void loadPractices();
  }, [loadPractices]);

  return (
    <div className="practice-dashboard exports-page">
      <div className="practice-dashboard__inner">
        <nav className="practice-dashboard__header-links">
          <Link to="/practice">{t.backPatients}</Link>
          <Link to={`/practice/patients?practiceId=${encodeURIComponent(practiceId)}`}>
            {t.backPatients}
          </Link>
        </nav>
        <h1 className="practice-dashboard__title">{t.headingPractice}</h1>
        <label className="practice-dashboard__field">
          <span>{t.selectPractice}</span>
          <select
            value={practiceId}
            onChange={(e) => setPracticeId(e.target.value)}
            aria-label={t.selectPractice}
          >
            <option value="">—</option>
            {practices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.practiceName}
              </option>
            ))}
          </select>
        </label>
        {practiceId ? <ExportsPanel audience="practice" practiceId={practiceId} /> : null}
      </div>
    </div>
  );
}
