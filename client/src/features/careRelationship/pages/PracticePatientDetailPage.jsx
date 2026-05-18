import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPracticePatientLink } from "../api/practicePatientsApi.js";
import { patientDisplayName } from "../utils/patientDisplayName.js";
import PracticePatientRecordTabs from "../components/PracticePatientRecordTabs.jsx";
import PracticePatientRecordSearch from "../components/PracticePatientRecordSearch.jsx";
import ExportsPanel from "../../exports/components/ExportsPanel.jsx";
import PracticePatientOverviewTab from "../components/PracticePatientOverviewTab.jsx";
import PracticePatientActivityTab from "../components/PracticePatientActivityTab.jsx";
import PracticePatientPreVisitsTab from "../components/PracticePatientPreVisitsTab.jsx";
import PracticePatientMessagesSection from "../../communication/components/PracticePatientMessagesSection.jsx";
import PracticePatientMedicationPlanSection from "../../medicationPlan/components/PracticePatientMedicationPlanSection.jsx";
import PracticePatientDocumentsSection from "../../practiceDocuments/components/PracticePatientDocumentsSection.jsx";
import PracticePatientProfileSection from "../components/PracticePatientProfileSection.jsx";
import "../../../styles/PracticeDashboardPage.css";
import "../../../styles/PracticePatientsPage.css";

function statusLabel(status, t) {
  const map = {
    invited: t.statusInvited,
    active: t.statusActive,
    revoked: t.statusRevoked,
    archived: t.statusArchived,
  };
  return map[status] || status;
}

const VALID_TABS = new Set([
  "overview",
  "profile",
  "previsits",
  "medication",
  "documents",
  "messages",
  "activity",
]);

export default function PracticePatientDetailPage() {
  const { linkId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const practiceId = searchParams.get("practiceId") || "";
  const fromSearch = searchParams.get("fromSearch") === "true";
  const activeTab = VALID_TABS.has(searchParams.get("tab") || "")
    ? searchParams.get("tab")
    : "overview";

  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practicePatients || getMessages("en").practicePatients,
    [language],
  );

  const [link, setLink] = useState(null);
  const [overview, setOverview] = useState(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const readOnly = role === "viewer";

  const listPath = practiceId
    ? `/practice/patients?practiceId=${encodeURIComponent(practiceId)}`
    : "/practice/patients";

  const loadDetail = useCallback(async () => {
    if (!linkId || !practiceId) {
      setLoading(false);
      setError(t.loadDetailError);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticePatientLink(linkId, practiceId);
      if (res.status === 404 && data.error === "feature_disabled") {
        setLink(null);
        setOverview(null);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok || !data.link) throw new Error("detail_load_failed");
      setLink(data.link);
      setOverview(data.overview || null);
      setRole(data.role || "");
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setLink(null);
      setOverview(null);
      setError(t.loadDetailError);
    } finally {
      setLoading(false);
    }
  }, [linkId, practiceId, fromSearch, t.featureDisabled, t.loadDetailError]);

  useEffect(() => {
    document.title = t.recordPageTitle;
  }, [t.recordPageTitle]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const setTab = (tabId) => {
    const next = new URLSearchParams(searchParams);
    if (practiceId) next.set("practiceId", practiceId);
    next.set("tab", tabId);
    setSearchParams(next, { replace: true });
  };

  if (loading) {
    return (
      <div className="practice-dashboard practice-patients">
        <div className="practice-dashboard__inner">
          <p className="practice-dashboard__muted">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="practice-dashboard practice-patients">
        <div className="practice-dashboard__inner">
          <Link className="practice-dashboard__back" to={listPath}>
            {t.backList}
          </Link>
          <p className="practice-dashboard__error" role="alert">
            {error || t.loadDetailError}
          </p>
        </div>
      </div>
    );
  }

  const name = patientDisplayName(link, t.patientFallback);
  const statusText = statusLabel(link.status, t);
  const statusAria = t.statusAria.replace("{status}", statusText);

  return (
    <div className="practice-dashboard practice-patients practice-record">
      <div className="practice-dashboard__inner">
        <Link className="practice-dashboard__back" to={listPath}>
          {t.backList}
        </Link>

        <header className="practice-dashboard__header practice-record__header">
          <div>
            <h1 className="practice-dashboard__title">{t.recordTitle}</h1>
            <p className="practice-dashboard__intro">{name}</p>
            {readOnly ? (
              <p className="practice-record__viewer-note" role="status">
                {t.viewerReadOnly}
              </p>
            ) : null}
          </div>
        </header>

        {practiceId && linkId ? (
          <PracticePatientRecordSearch
            linkId={linkId}
            practiceId={practiceId}
            t={t}
            onNavigateTab={setTab}
          />
        ) : null}

        {practiceId && linkId ? (
          <ExportsPanel
            audience="practice"
            practiceId={practiceId}
            linkId={linkId}
            compact
          />
        ) : null}

        <PracticePatientRecordTabs activeTab={activeTab} onTabChange={setTab} t={t} />

        <div
          className="practice-record__panel"
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === "overview" ? (
            <PracticePatientOverviewTab
              link={link}
              overview={overview}
              language={language}
              t={t}
              statusAria={statusAria}
              practiceId={practiceId}
              onNavigateTab={setTab}
            />
          ) : null}

          {activeTab === "profile" && practiceId && linkId ? (
            <PracticePatientProfileSection
              linkId={linkId}
              practiceId={practiceId}
              readOnly={readOnly}
            />
          ) : null}

          {activeTab === "previsits" && practiceId && linkId ? (
            <PracticePatientPreVisitsTab linkId={linkId} practiceId={practiceId} />
          ) : null}

          {activeTab === "medication" && practiceId && linkId ? (
            <PracticePatientMedicationPlanSection
              linkId={linkId}
              practiceId={practiceId}
              readOnly={readOnly}
            />
          ) : null}

          {activeTab === "documents" && practiceId && linkId ? (
            <PracticePatientDocumentsSection
              linkId={linkId}
              practiceId={practiceId}
              readOnly={readOnly}
            />
          ) : null}

          {activeTab === "messages" && practiceId && linkId ? (
            <PracticePatientMessagesSection
              linkId={linkId}
              practiceId={practiceId}
              readOnly={readOnly}
            />
          ) : null}

          {activeTab === "activity" && practiceId && linkId ? (
            <PracticePatientActivityTab linkId={linkId} practiceId={practiceId} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
