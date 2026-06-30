import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import "./PublicDemoNoticeModal.css";

/** sessionStorage flag so the notice shows at most once per browser session. */
const DISMISS_KEY = "medscoutx_public_demo_notice_dismissed";

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* private mode / storage disabled — modal simply reappears next load */
  }
}

/**
 * Friendly Messe/DemoDay welcome notice shown on the landing page.
 *
 * Frontend-only and additive: no API call, no token, no auth change. The parent
 * (LandingPage) already gates rendering behind VITE_ENABLE_PUBLIC_DEMO_MODE, so
 * when the flag is off this component never mounts. Actions use the router's
 * navigate() (plain buttons) so they don't inherit the global anchor color.
 */
export default function PublicDemoNoticeModal() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const t = useMemo(
    () => getMessages(language).publicDemo || getMessages("en").publicDemo,
    [language],
  );
  const copy = t.notice;

  const [open, setOpen] = useState(() => !readDismissed());
  const dialogRef = useRef(null);

  const dismiss = useCallback(() => {
    writeDismissed();
    setOpen(false);
  }, []);

  const goTo = useCallback(
    (path) => {
      writeDismissed();
      setOpen(false);
      navigate(path);
    },
    [navigate],
  );

  // Escape closes; focus moves into the dialog when it opens.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open || !copy) return null;

  return (
    <div
      className="public-demo-notice__backdrop"
      role="presentation"
      onClick={dismiss}
    >
      <div
        ref={dialogRef}
        className="public-demo-notice__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-demo-notice-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="public-demo-notice__close"
          onClick={dismiss}
          aria-label={t.modalClose}
        >
          <X size={18} aria-hidden />
        </button>

        <span className="public-demo-notice__badge">{copy.badge}</span>

        <h2 id="public-demo-notice-title" className="public-demo-notice__title">
          {copy.title}
        </h2>

        <p className="public-demo-notice__body">{copy.body}</p>
        <p className="public-demo-notice__body public-demo-notice__body--muted">
          {copy.body2}
        </p>

        <div className="public-demo-notice__actions">
          <button
            type="button"
            className="public-demo-notice__btn public-demo-notice__btn--primary"
            onClick={() => goTo("/demo")}
          >
            {copy.primary}
          </button>
          <button
            type="button"
            className="public-demo-notice__btn public-demo-notice__btn--secondary"
            onClick={() => goTo("/login")}
          >
            {copy.secondary}
          </button>
        </div>

        <button
          type="button"
          className="public-demo-notice__dismiss"
          onClick={dismiss}
        >
          {copy.dismiss}
        </button>
      </div>
    </div>
  );
}
