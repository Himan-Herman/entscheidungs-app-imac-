import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { fetchPatientInboxCount } from "../features/patientInbox/api/patientInboxApi.js";
import PatientHubTiles from "./PatientHubTiles.jsx";
import { isLiveMedicalTranslationEnabled } from "../features/liveMedicalTranslation/featureFlag.js";
import {
  PATIENT_MAIN_HUB_LINKS,
  PATIENT_MY_PRACTICE_HUB_LINK,
} from "./patientHubLinks.js";
import "../styles/WorkspaceHubPages.css";

export default function PatientHubPage() {
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
    document.title = t.patientHub.pageTitle;
  }, [t.patientHub.pageTitle]);

  useEffect(() => {
    void loadInboxCount();
  }, [loadInboxCount]);

  const hubLinks = useMemo(() => {
    const links = [PATIENT_MY_PRACTICE_HUB_LINK, ...PATIENT_MAIN_HUB_LINKS];
    if (isLiveMedicalTranslationEnabled()) return links;
    return links.filter((link) => link.to !== "/patient/live-translation");
  }, []);

  return (
    <div className="workspace-hub">
      <header className="workspace-hub__hero">
        <h1 className="workspace-hub__title">{t.patientHub.heading}</h1>
        <p className="workspace-hub__sub">{t.patientHub.sub}</p>
        <Link className="workspace-hub__classic" to="/startseite">
          {t.patientHub.classic}
        </Link>
      </header>

      <PatientHubTiles
        links={hubLinks}
        t={t}
        navAriaLabel={t.patientHub.heading}
        inboxUnread={inboxUnread}
        inboxBadgeLabel={tInbox.badgeAria}
      />
    </div>
  );
}
