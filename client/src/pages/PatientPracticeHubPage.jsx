import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { fetchPatientInboxCount } from "../features/patientInbox/api/patientInboxApi.js";
import PatientHubTiles from "./PatientHubTiles.jsx";
import { PATIENT_PRACTICE_HUB_LINKS } from "./patientHubLinks.js";
import "../styles/WorkspaceHubPages.css";

export default function PatientPracticeHubPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.roleEntry ?? getMessages("en").roleEntry;
  }, [language]);

  const tInbox = useMemo(
    () => getMessages(language).patientInbox || getMessages("en").patientInbox,
    [language],
  );

  const [inboxUnread, setInboxUnread] = useState(0);

  const loadInboxCount = useCallback(async () => {
    try {
      const { res, data } = await fetchPatientInboxCount();
      if (res.ok && data.ok) setInboxUnread(Number(data.unreadCount) || 0);
    } catch {
      /* optional feature */
    }
  }, []);

  useEffect(() => {
    document.title = t.patientPracticeHub.pageTitle;
  }, [t.patientPracticeHub.pageTitle]);

  useEffect(() => {
    void loadInboxCount();
  }, [loadInboxCount]);

  return (
    <div className="workspace-hub workspace-hub--practice">
      <header className="workspace-hub__hero">
        <Link className="workspace-hub__classic" to="/patient">
          {t.patientPracticeHub.back}
        </Link>
        <h1 className="workspace-hub__title">{t.patientPracticeHub.heading}</h1>
        <p className="workspace-hub__sub">{t.patientPracticeHub.sub}</p>
      </header>

      <PatientHubTiles
        links={PATIENT_PRACTICE_HUB_LINKS}
        t={t}
        navAriaLabel={t.patientPracticeHub.navAria}
        inboxUnread={inboxUnread}
        inboxBadgeLabel={tInbox.badgeAria}
      />
    </div>
  );
}
