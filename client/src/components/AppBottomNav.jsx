import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ClipboardList, HeartPulse, Settings2, Stethoscope, UserRound } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import "./AppBottomNav.css";

export function shouldShowMobileAppNav(pathname) {
  if (!pathname) return false;
  const exactHide = new Set([
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/check-email",
    "/verified",
    "/intro",
  ]);
  if (exactHide.has(pathname)) return false;
  if (pathname.startsWith("/pre-visit/chat")) return false;
  if (pathname.startsWith("/pre-visit/document")) return false;
  if (pathname.startsWith("/pre-visit/review")) return false;
  return true;
}

export default function AppBottomNav() {
  const { pathname } = useLocation();
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.appShell ?? getMessages("en").appShell;
  }, [language]);

  if (!shouldShowMobileAppNav(pathname)) return null;

  return (
    <nav className="app-bottom-nav" aria-label={t.bottomNavAria}>
      <NavLink end to="/pre-visit" className="app-bottom-nav__link">
        <HeartPulse size={22} aria-hidden />
        <span>{t.navPrepare}</span>
      </NavLink>
      <NavLink to="/pre-visit/my-preparations" className="app-bottom-nav__link">
        <ClipboardList size={22} aria-hidden />
        <span>{t.navPreparations}</span>
      </NavLink>
      <NavLink to="/pre-visit/cases" className="app-bottom-nav__link">
        <Stethoscope size={22} aria-hidden />
        <span>{t.navTimelines}</span>
      </NavLink>
      <NavLink to="/settings/doctor-contacts" className="app-bottom-nav__link">
        <UserRound size={22} aria-hidden />
        <span>{t.navDoctors}</span>
      </NavLink>
      <NavLink to="/settings/privacy" className="app-bottom-nav__link">
        <Settings2 size={22} aria-hidden />
        <span>{t.navSettings}</span>
      </NavLink>
    </nav>
  );
}
