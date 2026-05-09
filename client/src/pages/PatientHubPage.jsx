import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ClipboardList,
  FileText,
  HeartPulse,
  ImageIcon,
  Map as MapIcon,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import "../styles/WorkspaceHubPages.css";

const LINKS = [
  { to: "/pre-visit", key: "hubLinkPreVisit", icon: HeartPulse },
  { to: "/symptom", key: "hubLinkSymptom", icon: Activity },
  { to: "/bild", key: "hubLinkImage", icon: ImageIcon },
  { to: "/region-start", key: "hubLinkBody", icon: MapIcon },
  { to: "/pre-visit/my-preparations", key: "hubLinkMyPrep", icon: ClipboardList },
  { to: "/pre-visit/cases", key: "hubLinkCases", icon: Stethoscope },
  { to: "/settings/doctor-contacts", key: "hubLinkDoctors", icon: UserRound },
  { to: "/account/documents", key: "hubLinkDocuments", icon: FileText },
];

export default function PatientHubPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.roleEntry ?? getMessages("en").roleEntry;
  }, [language]);

  useEffect(() => {
    document.title = t.patientHub.pageTitle;
  }, [t.patientHub.pageTitle]);

  return (
    <div className="workspace-hub">
      <header className="workspace-hub__hero">
        <h1 className="workspace-hub__title">{t.patientHub.heading}</h1>
        <p className="workspace-hub__sub">{t.patientHub.sub}</p>
        <Link className="workspace-hub__classic" to="/startseite">
          {t.patientHub.classic}
        </Link>
      </header>

      <nav className="workspace-hub__grid" aria-label={t.patientHub.heading}>
        {LINKS.map((link) => {
          const TileIcon = link.icon;
          return (
            <Link key={link.to} className="workspace-hub__tile" to={link.to}>
              <span className="workspace-hub__tile-icon" aria-hidden>
                <TileIcon size={22} strokeWidth={1.75} />
              </span>
              <span className="workspace-hub__tile-label">{t[link.key]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
