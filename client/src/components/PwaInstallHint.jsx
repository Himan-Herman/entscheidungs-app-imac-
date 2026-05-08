import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import "./PwaInstallHint.css";

const DISMISS_KEY = "medscoutx_pwa_install_dismissed";

function isStandaloneDisplay() {
  if (typeof window === "undefined") return true;
  const mq = window.matchMedia("(display-mode: standalone)");
  const mqFs = window.matchMedia("(display-mode: fullscreen)");
  // iOS Safari home-screen Web App
  const iosStandalone =
    typeof window.navigator !== "undefined" && window.navigator.standalone === true;
  return mq.matches || mqFs.matches || iosStandalone;
}

export default function PwaInstallHint({ hasBottomNav }) {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.appShell ?? getMessages("en").appShell;
  }, [language]);

  const [visible, setVisible] = useState(false);
  const deferredRef = useRef(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    if (isStandaloneDisplay()) return;

    const onBip = (e) => {
      e.preventDefault();
      deferredRef.current = e;
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  async function install() {
    const ev = deferredRef.current;
    if (!ev || typeof ev.prompt !== "function") return;
    await ev.prompt();
    deferredRef.current = null;
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className={`pwa-install-hint${hasBottomNav ? " pwa-install-hint--above-nav" : ""}`}
      role="region"
      aria-label={t.installAria}
    >
      <p className="pwa-install-hint__text">{t.installHint}</p>
      <div className="pwa-install-hint__actions">
        <button type="button" className="pwa-install-hint__btn pwa-install-hint__btn--primary" onClick={() => void install()}>
          {t.installAction}
        </button>
        <button type="button" className="pwa-install-hint__btn pwa-install-hint__btn--ghost" onClick={dismiss}>
          {t.installDismiss}
        </button>
      </div>
    </div>
  );
}
