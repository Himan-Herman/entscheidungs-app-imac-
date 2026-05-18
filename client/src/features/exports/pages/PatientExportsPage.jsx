import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import ExportsPanel from "../components/ExportsPanel.jsx";
import "../../../styles/PracticeDashboardPage.css";
import "../../../styles/ExportsPage.css";

export default function PatientExportsPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).exports || getMessages("en").exports,
    [language],
  );

  useEffect(() => {
    document.title = t.pageTitlePatient;
  }, [t.pageTitlePatient]);

  return (
    <div className="practice-dashboard exports-page">
      <div className="practice-dashboard__inner">
        <nav className="practice-dashboard__header-links">
          <Link to="/patient/data-control">{t.backDataControl}</Link>
        </nav>
        <ExportsPanel audience="patient" />
      </div>
    </div>
  );
}
