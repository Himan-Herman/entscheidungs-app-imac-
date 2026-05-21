import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ClipboardList,
  FileText,
  FolderOpen,
  HeartPulse,
  Heart,
  ImageIcon,
  Map as MapIcon,
  Inbox,
  MessageSquare,
  Languages,
  MapPinned,
  Pill,
  Stethoscope,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { fetchPatientInboxCount } from "../features/patientInbox/api/patientInboxApi.js";
import InboxCountBadge from "../components/InboxCountBadge.jsx";
import { usePatientInterpreterHubVisible } from "../features/medicalInterpreter/hooks/useInterpreterHubVisibility.js";
import "../styles/WorkspaceHubPages.css";

const LINKS = [
  { to: "/patient/inbox", key: "hubLinkInbox", subtitleKey: "hubLinkInboxSub", icon: Inbox },
  {
    to: "/patient/messages",
    key: "hubLinkThreads",
    subtitleKey: "hubLinkThreadsSub",
    icon: MessageSquare,
  },
  {
    to: "/patient/telemedicine",
    key: "hubLinkTelemedicine",
    subtitleKey: "hubLinkTelemedicineSub",
    icon: Video,
  },
  {
    to: "/patient/medication-plans",
    key: "hubLinkMedicationPlans",
    subtitleKey: "hubLinkMedicationPlansSub",
    icon: Pill,
  },
  {
    to: "/patient/practice-documents",
    key: "hubLinkPracticeDocuments",
    subtitleKey: "hubLinkPracticeDocumentsSub",
    icon: FolderOpen,
  },
  {
    to: "/patient/data-control",
    key: "hubLinkDataControl",
    subtitleKey: "hubLinkDataControlSub",
    icon: Users,
  },
  {
    to: "/patient/activity",
    key: "hubLinkPatientActivity",
    subtitleKey: "hubLinkPatientActivitySub",
    icon: Activity,
  },
  { to: "/patient/find-practices", key: "hubLinkFindPractices", icon: MapPinned },
  { to: "/account/health", key: "hubLinkHealthProfile", icon: Heart },
  { to: "/pre-visit", key: "hubLinkPreVisit", icon: HeartPulse },
  { to: "/symptom", key: "hubLinkSymptom", icon: Activity },
  { to: "/bild", key: "hubLinkImage", icon: ImageIcon },
  { to: "/region-start", key: "hubLinkBody", icon: MapIcon },
  { to: "/pre-visit/medications", key: "hubLinkVisitMedications", icon: Pill },
  { to: "/pre-visit/my-preparations", key: "hubLinkMyPrep", icon: ClipboardList },
  { to: "/pre-visit/cases", key: "hubLinkCases", icon: Stethoscope },
  { to: "/settings/doctor-contacts", key: "hubLinkDoctors", icon: UserRound },
  { to: "/account/documents", key: "hubLinkDocuments", icon: FileText },
];

const INTERPRETER_HUB_LINK = {
  to: "/patient/interpreter",
  key: "hubLinkInterpreter",
  subtitleKey: "hubLinkInterpreterSub",
  ariaKey: "hubLinkInterpreterAria",
  icon: Languages,
  tileClass: "workspace-hub__tile--interpreter",
};

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
  const interpreterHub = usePatientInterpreterHubVisible();

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
    if (!interpreterHub.visible) return LINKS;
    const links = [...LINKS];
    const telemedicineIndex = links.findIndex((l) => l.key === "hubLinkTelemedicine");
    const insertAt = telemedicineIndex >= 0 ? telemedicineIndex + 1 : 3;
    links.splice(insertAt, 0, INTERPRETER_HUB_LINK);
    return links;
  }, [interpreterHub.visible]);

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
        {hubLinks.map((link) => {
          const TileIcon = link.icon;
          const tileClass = [
            "workspace-hub__tile",
            link.tileClass || "",
          ]
            .filter(Boolean)
            .join(" ");
          const ariaLabel =
            link.ariaKey && t[link.ariaKey]
              ? t[link.ariaKey]
              : link.subtitleKey
                ? `${t[link.key]}. ${t[link.subtitleKey]}`
                : t[link.key];
          return (
            <Link
              key={link.to}
              className={tileClass}
              to={link.to}
              aria-label={ariaLabel}
            >
              <span className="workspace-hub__tile-icon" aria-hidden>
                <TileIcon size={22} strokeWidth={1.75} />
              </span>
              <span className="workspace-hub__tile-label">
                {t[link.key]}
                {link.key === "hubLinkInbox" ? (
                  <InboxCountBadge
                    count={inboxUnread}
                    label={tInbox.badgeAria}
                  />
                ) : null}
              </span>
              {link.subtitleKey ? (
                <span className="workspace-hub__tile-sub">{t[link.subtitleKey]}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
