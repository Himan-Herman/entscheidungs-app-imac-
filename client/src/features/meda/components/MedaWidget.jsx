import React, { useEffect, useMemo } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import medscoutLogo from "../../../assets/img/medscout-logo.png";
import { useMedaChat } from "../hooks/useMedaChat.js";
import MedaChatPanel from "./MedaChatPanel.jsx";
import "../styles/MedaWidget.css";

/**
 * Floating Meda assistant — show on logged-in patient routes.
 */
export default function MedaWidget() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.meda ?? getMessages("en").meda;
  }, [language]);

  const chat = useMedaChat(language === "en" ? "en" : "de", t);

  useEffect(() => {
    if (!chat.open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") chat.setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chat.open, chat.setOpen]);

  return (
    <div className="meda-widget" data-open={chat.open ? "true" : "false"}>
      {chat.open ? (
        <MedaChatPanel
          chat={chat}
          t={t}
          suggestions={t.suggestions}
          onClose={() => chat.setOpen(false)}
        />
      ) : null}

      <button
        type="button"
        className="meda-widget__fab"
        aria-label={t.fabLabel}
        title={t.fabTitle}
        aria-expanded={chat.open}
        onClick={() => chat.setOpen((v) => !v)}
      >
        <img
          className="meda-widget__fab-logo"
          src={medscoutLogo}
          alt=""
          width={28}
          height={28}
          aria-hidden
        />
      </button>
    </div>
  );
}

export function shouldShowMedaWidget(pathname, isLoggedIn) {
  if (!isLoggedIn) return false;
  if (pathname.startsWith("/practice")) return false;
  if (pathname === "/register" || pathname === "/login") return false;
  if (pathname === "/" || pathname === "/landing") return false;
  return true;
}
