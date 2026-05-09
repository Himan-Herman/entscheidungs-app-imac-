import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Building2,
  ClipboardList,
  Database,
  LayoutDashboard,
  Plug,
  Shield,
  UsersRound,
} from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import "../styles/WorkspaceHubPages.css";

const TILES = [
  { to: "/settings/practices", key: "hubLinkProfiles", Icon: Building2 },
  { to: "/settings/practices", key: "hubLinkQr", Icon: Building2 },
  { to: "/practice/dashboard", key: "hubLinkDashboard", Icon: LayoutDashboard },
  { to: "/pre-visit/follow-ups", key: "hubLinkFollowUps", Icon: ClipboardList },
  { to: "/practice/dashboard", key: "hubLinkIntegrations", Icon: Plug },
  { to: "/practice/dashboard", key: "hubLinkAnalytics", Icon: BarChart3 },
  { to: "/account/profiles", key: "hubLinkProfilesTeam", Icon: UsersRound },
  { to: "/settings/privacy", key: "hubLinkPrivacySettings", Icon: Shield },
  { to: "/account/data", key: "hubLinkAccountData", Icon: Database },
];

export default function PracticeHubPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.roleEntry ?? getMessages("en").roleEntry;
  }, [language]);

  useEffect(() => {
    document.title = t.practiceHub.pageTitle;
  }, [t.practiceHub.pageTitle]);

  return (
    <div className="workspace-hub workspace-hub--practice">
      <header className="workspace-hub__hero">
        <h1 className="workspace-hub__title">{t.practiceHub.heading}</h1>
        <p className="workspace-hub__sub">{t.practiceHub.sub}</p>
      </header>

      <nav className="workspace-hub__grid" aria-label={t.practiceHub.heading}>
        {TILES.map((tile) => {
          const TileIcon = tile.Icon;
          return (
            <Link key={`${tile.to}-${tile.key}`} className="workspace-hub__tile" to={tile.to}>
              <span className="workspace-hub__tile-icon" aria-hidden>
                <TileIcon size={22} strokeWidth={1.75} />
              </span>
              <span className="workspace-hub__tile-label">{t[tile.key]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
