import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Building2,
  ClipboardList,
  FileText,
  HeartPulse,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Settings2,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { readUserMode, USER_MODES } from "../utils/userMode.js";
import "./AppBottomNav.css";

export function shouldShowMobileAppNav(pathname) {
  if (!pathname) return false;
  const exactHide = new Set([
    "/",
    "/landing",
    "/choose",
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

/** @returns {'practice-care' | 'patient-care' | 'practice-legacy' | 'patient-legacy'} */
export function getBottomNavVariant(pathname, mode) {
  if (pathname.startsWith("/practice")) return "practice-care";
  if (pathname.startsWith("/patient")) return "patient-care";
  if (mode === USER_MODES.PRACTICE) return "practice-legacy";
  return "patient-legacy";
}

export default function AppBottomNav() {
  const { pathname } = useLocation();
  const { language } = useLanguage();
  const [mode, setMode] = useState(() => readUserMode());

  useEffect(() => {
    setMode(readUserMode());
    const onMode = () => setMode(readUserMode());
    window.addEventListener("medscoutx_user_mode_changed", onMode);
    return () => window.removeEventListener("medscoutx_user_mode_changed", onMode);
  }, []);

  const t = useMemo(() => {
    const m = getMessages(language);
    return m.appShell ?? getMessages("en").appShell;
  }, [language]);

  if (!shouldShowMobileAppNav(pathname)) return null;

  const variant = getBottomNavVariant(pathname, mode);

  if (variant === "practice-care") {
    return (
      <nav className="app-bottom-nav" aria-label={t.bottomNavAria} dir="ltr">
        <NavLink end to="/practice" className="app-bottom-nav__link">
          <LayoutDashboard size={22} aria-hidden />
          <span>{t.navPracticeHub}</span>
        </NavLink>
        <NavLink to="/practice/patients" className="app-bottom-nav__link">
          <Users size={22} aria-hidden />
          <span>{t.navPracticePatients}</span>
        </NavLink>
        <NavLink to="/practice/inbox" className="app-bottom-nav__link">
          <Inbox size={22} aria-hidden />
          <span>{t.navPracticeInbox}</span>
        </NavLink>
        <NavLink end to="/account" className="app-bottom-nav__link">
          <UserRound size={22} aria-hidden />
          <span>{t.navAccountHome}</span>
        </NavLink>
        <NavLink to="/settings/privacy" className="app-bottom-nav__link">
          <Settings2 size={22} aria-hidden />
          <span>{t.navPracticePrivacy}</span>
        </NavLink>
      </nav>
    );
  }

  if (variant === "patient-care") {
    return (
      <nav className="app-bottom-nav" aria-label={t.bottomNavAria} dir="ltr">
        <NavLink end to="/patient" className="app-bottom-nav__link">
          <HeartPulse size={22} aria-hidden />
          <span>{t.navPatientHub}</span>
        </NavLink>
        <NavLink to="/patient/inbox" className="app-bottom-nav__link">
          <Inbox size={22} aria-hidden />
          <span>{t.navPatientInbox}</span>
        </NavLink>
        <NavLink to="/patient/messages" className="app-bottom-nav__link">
          <MessageSquare size={22} aria-hidden />
          <span>{t.navPatientMessages}</span>
        </NavLink>
        <NavLink to="/patient/practice-documents" className="app-bottom-nav__link">
          <FileText size={22} aria-hidden />
          <span>{t.navPatientDocuments}</span>
        </NavLink>
        <NavLink to="/settings/privacy" className="app-bottom-nav__link">
          <Settings2 size={22} aria-hidden />
          <span>{t.navSettings}</span>
        </NavLink>
      </nav>
    );
  }

  if (variant === "practice-legacy") {
    return (
      <nav className="app-bottom-nav" aria-label={t.bottomNavAria} dir="ltr">
        <NavLink to="/practice/dashboard" className="app-bottom-nav__link">
          <LayoutDashboard size={22} aria-hidden />
          <span>{t.navPracticeDashboard}</span>
        </NavLink>
        <NavLink to="/settings/practices" className="app-bottom-nav__link">
          <Building2 size={22} aria-hidden />
          <span>{t.navPracticeProfiles}</span>
        </NavLink>
        <NavLink to="/pre-visit/follow-ups" className="app-bottom-nav__link">
          <ClipboardList size={22} aria-hidden />
          <span>{t.navPracticeFollowUps}</span>
        </NavLink>
        <NavLink end to="/account" className="app-bottom-nav__link">
          <UserRound size={22} aria-hidden />
          <span>{t.navAccountHome}</span>
        </NavLink>
        <NavLink to="/settings/privacy" className="app-bottom-nav__link">
          <Settings2 size={22} aria-hidden />
          <span>{t.navPracticePrivacy}</span>
        </NavLink>
      </nav>
    );
  }

  return (
    <nav className="app-bottom-nav" aria-label={t.bottomNavAria} dir="ltr">
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
