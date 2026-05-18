import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import PracticePatientMessagesSection from "../components/PracticePatientMessagesSection.jsx";
import "../../../styles/PracticeDashboardPage.css";
import "../../../styles/PracticePatientsPage.css";
import "../../../styles/PatientThreadsPage.css";

export default function PracticePatientMessagesPage() {
  const { linkId } = useParams();
  const [searchParams] = useSearchParams();
  const practiceId = searchParams.get("practiceId") || "";
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceMessages || getMessages("en").practiceMessages,
    [language],
  );
  const tPatients = useMemo(
    () => getMessages(language).practicePatients || getMessages("en").practicePatients,
    [language],
  );

  const recordHref = `/practice/patients/${encodeURIComponent(linkId || "")}?practiceId=${encodeURIComponent(practiceId)}&tab=messages`;

  return (
    <div className="practice-dashboard practice-patients">
      <Link className="patient-inbox__back" to={recordHref}>
        {t.backToRecord}
      </Link>
      <header className="practice-dashboard__header">
        <h1 className="practice-dashboard__title">{t.sectionTitle}</h1>
        <p className="practice-dashboard__muted">{tPatients.tabMessages || t.sectionTitle}</p>
      </header>
      {linkId && practiceId ? (
        <PracticePatientMessagesSection linkId={linkId} practiceId={practiceId} />
      ) : (
        <p className="practice-dashboard__error" role="alert">
          {t.loadError}
        </p>
      )}
    </div>
  );
}
