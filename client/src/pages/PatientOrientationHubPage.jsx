import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import PatientHubTiles from "./PatientHubTiles.jsx";
import { PATIENT_ORIENTATION_HUB_LINKS } from "./patientHubLinks.js";
import "../styles/WorkspaceHubPages.css";

export default function PatientOrientationHubPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.roleEntry ?? getMessages("en").roleEntry;
  }, [language]);

  useEffect(() => {
    document.title = t.patientOrientationHub.pageTitle;
  }, [t.patientOrientationHub.pageTitle]);

  return (
    <div className="workspace-hub workspace-hub--orientation">
      <header className="workspace-hub__hero">
        <Link className="workspace-hub__classic" to="/patient">
          {t.patientOrientationHub.back}
        </Link>
        <h1 className="workspace-hub__title">{t.patientOrientationHub.heading}</h1>
        <p className="workspace-hub__sub">{t.patientOrientationHub.sub}</p>
      </header>

      <PatientHubTiles
        links={PATIENT_ORIENTATION_HUB_LINKS}
        t={t}
        navAriaLabel={t.patientOrientationHub.navAria}
      />
    </div>
  );
}
