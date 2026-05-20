import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import {
  dismissForever,
  dismissLater,
  getManualInstallMode,
  isStandaloneDisplay,
  markInstalled,
  shouldShowInstallHint,
} from "../utils/pwaInstall.js";
import "./PwaInstallHint.css";

const MANUAL_SHOW_DELAY_MS = 2800;

/**
 * @param {object} props
 * @param {boolean} [props.hasBottomNav]
 */
export default function PwaInstallHint({ hasBottomNav }) {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.appShell ?? getMessages("en").appShell;
  }, [language]);

  const [visible, setVisible] = useState(false);
  /** @type {'native' | 'ios' | 'macos'} */
  const [mode, setMode] = useState("native");
  const deferredRef = useRef(null);
  const dialogRef = useRef(null);
  const nativeReceivedRef = useRef(false);

  const hide = useCallback(() => setVisible(false), []);

  const handleLater = useCallback(() => {
    dismissLater();
    hide();
  }, [hide]);

  const handleNever = useCallback(() => {
    dismissForever();
    hide();
  }, [hide]);

  const install = useCallback(async () => {
    const ev = deferredRef.current;
    if (!ev || typeof ev.prompt !== "function") return;
    try {
      await ev.prompt();
      const choice = await ev.userChoice;
      if (choice?.outcome === "accepted") {
        markInstalled();
      }
    } catch {
      /* user dismissed native prompt */
    } finally {
      deferredRef.current = null;
      hide();
    }
  }, [hide]);

  useEffect(() => {
    if (!shouldShowInstallHint()) return undefined;

    const onBip = (e) => {
      e.preventDefault();
      deferredRef.current = e;
      nativeReceivedRef.current = true;
      setMode("native");
      setVisible(true);
    };

    const onInstalled = () => {
      markInstalled();
      hide();
    };

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    const manualMode = getManualInstallMode();
    const timer =
      manualMode &&
      window.setTimeout(() => {
        if (nativeReceivedRef.current) return;
        if (!shouldShowInstallHint()) return;
        if (isStandaloneDisplay()) return;
        setMode(manualMode);
        setVisible(true);
      }, MANUAL_SHOW_DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, [hide]);

  useEffect(() => {
    if (!visible) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") handleLater();
    };
    window.addEventListener("keydown", onKey);
    const id = window.requestAnimationFrame(() => {
      const root = dialogRef.current;
      const focusable = root?.querySelector(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.cancelAnimationFrame(id);
    };
  }, [visible, handleLater]);

  if (!visible) return null;

  const showNativeInstall = mode === "native" && deferredRef.current;

  return (
    <div
      className={`pwa-install-hint${hasBottomNav ? " pwa-install-hint--above-nav" : ""}`}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="pwa-install-hint__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-title"
        aria-describedby="pwa-install-desc"
      >
        <button
          type="button"
          className="pwa-install-hint__close"
          onClick={handleLater}
          aria-label={t.installCloseAria}
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="pwa-install-hint__icon" aria-hidden="true">
          <img src="/pwa-192x192.png" alt="" width={40} height={40} />
        </div>

        <h2 id="pwa-install-title" className="pwa-install-hint__title">
          {t.installTitle}
        </h2>
        <p id="pwa-install-desc" className="pwa-install-hint__subtitle">
          {t.installSubtitle}
        </p>

        {mode === "ios" ? (
          <p className="pwa-install-hint__manual">{t.installIosHint}</p>
        ) : null}
        {mode === "macos" ? (
          <p className="pwa-install-hint__manual">{t.installMacSafariHint}</p>
        ) : null}

        <div className="pwa-install-hint__actions">
          {showNativeInstall ? (
            <button
              type="button"
              className="pwa-install-hint__btn pwa-install-hint__btn--primary"
              onClick={() => void install()}
            >
              {t.installAction}
            </button>
          ) : null}
          <button
            type="button"
            className="pwa-install-hint__btn pwa-install-hint__btn--secondary"
            onClick={handleLater}
          >
            {t.installLater}
          </button>
          <button
            type="button"
            className="pwa-install-hint__btn pwa-install-hint__btn--ghost"
            onClick={handleNever}
          >
            {t.installNever}
          </button>
        </div>
      </div>
    </div>
  );
}
