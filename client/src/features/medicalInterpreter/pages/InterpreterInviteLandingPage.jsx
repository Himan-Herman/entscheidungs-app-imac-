import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { isMedicalInterpreterClientEnabled } from "../config/isMedicalInterpreterEnabled.js";
import { fetchInterpreterInviteStatus } from "../api/interpreterPublicInviteApi.js";
import {
  saveInterpreterInviteContext,
  setEphemeralInviteToken,
  setPostLoginInterpreterRedirect,
} from "../utils/interpreterInviteContext.js";
import { startInterpreterInviteSession } from "../api/interpreterPublicInviteApi.js";
import "../styles/MedicalInterpreter.css";
import "../styles/InterpreterInviteLanding.css";

function isLoggedIn() {
  try {
    return (
      !!localStorage.getItem("medscout_token") &&
      !!localStorage.getItem("medscout_user_id")
    );
  } catch {
    return false;
  }
}

/**
 * @param {string} state
 * @param {ReturnType<typeof getMessages>['medicalInterpreter']['invite']} labels
 */
function statusLabel(state, labels) {
  if (state === "active") return labels.statusActive;
  if (state === "expired") return labels.statusExpired;
  if (state === "revoked") return labels.statusRevoked;
  if (state === "unavailable") return labels.statusUnavailable;
  return labels.statusInvalid;
}

export default function InterpreterInviteLandingPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useMemo(() => getMessages(language).medicalInterpreter.invite, [language]);
  const clientEnabled = isMedicalInterpreterClientEnabled();

  const [phase, setPhase] = useState(
    /** @type {'loading'|'ready'|'error'} */ ("loading"),
  );
  const [status, setStatus] = useState(
    /** @type {{ valid: boolean; state: string; practiceDisplayName?: string; message?: string; interpreterEnabled?: boolean }} */ ({
      valid: false,
      state: "invalid",
    }),
  );
  const [fetchError, setFetchError] = useState(
    /** @type {'network'|'module_disabled'|null} */ (null),
  );

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!clientEnabled) {
        setFetchError("module_disabled");
        setPhase("ready");
        return;
      }
      setPhase("loading");
      setFetchError(null);
      const result = await fetchInterpreterInviteStatus(token);
      if (cancelled) return;
      if (result.error === "network") {
        setFetchError("network");
        setStatus({ valid: false, state: "invalid" });
        setPhase("ready");
        return;
      }
      if (result.interpreterEnabled === false) {
        setFetchError("module_disabled");
      }
      setStatus({
        valid: result.valid === true,
        state: result.state || "invalid",
        practiceDisplayName: result.practiceDisplayName,
        message: result.message,
        interpreterEnabled: result.interpreterEnabled,
      });
      if (result.valid && token) {
        void startInterpreterInviteSession(token);
      }
      setPhase("ready");
    }
    if (token) void run();
    return () => {
      cancelled = true;
    };
  }, [token, clientEnabled]);

  const statusText = statusLabel(status.state, t);
  const canContinue =
    clientEnabled &&
    status.valid &&
    status.state === "active" &&
    status.interpreterEnabled !== false &&
    !fetchError;

  const handleContinue = () => {
    if (!canContinue || !status.practiceDisplayName) return;
    saveInterpreterInviteContext({
      practiceDisplayName: status.practiceDisplayName,
      validatedAt: new Date().toISOString(),
      source: "practice_invite",
    });
    if (token) setEphemeralInviteToken(token);
    navigate("/patient/interpreter/setup?fromInvite=1", { replace: true });
  };

  const handleLogin = () => {
    if (status.practiceDisplayName && status.valid) {
      saveInterpreterInviteContext({
        practiceDisplayName: status.practiceDisplayName,
        validatedAt: new Date().toISOString(),
        source: "practice_invite",
      });
      if (token) setEphemeralInviteToken(token);
    }
    setPostLoginInterpreterRedirect("/patient/interpreter/setup?fromInvite=1");
    navigate("/login");
  };

  const loggedIn = isLoggedIn();

  return (
    <main
      className="medical-interpreter-page interp-invite-landing interp-root"
      id="main-content"
    >
      <h1 className="medical-interpreter-page__title">{t.heading}</h1>

      {phase === "loading" ? (
        <p className="interpreter-empty-state" role="status" aria-live="polite">
          {t.loading}
        </p>
      ) : null}

      {phase === "ready" && fetchError === "network" ? (
        <div className="interp-invite-landing__status interp-invite-landing__status--error" role="alert">
          <p className="interp-invite-landing__status-label">{t.networkError}</p>
        </div>
      ) : null}

      {phase === "ready" && fetchError === "module_disabled" ? (
        <div className="interp-invite-landing__status interp-invite-landing__status--error" role="alert">
          <p className="interp-invite-landing__status-label">{t.moduleDisabled}</p>
        </div>
      ) : null}

      {phase === "ready" && !fetchError ? (
        <div
          className={`interp-invite-landing__status interp-invite-landing__status--${status.state}`}
          role={status.valid ? "status" : "alert"}
          aria-live="polite"
        >
          <p className="interp-invite-landing__status-label">
            <span className="visually-hidden">{t.statusAriaPrefix} </span>
            {statusText}
          </p>
          {!status.valid && status.message ? (
            <p className="interp-invite-landing__status-detail">{status.message}</p>
          ) : null}
        </div>
      ) : null}

      {phase === "ready" && status.valid && status.practiceDisplayName ? (
        <>
          <p className="interp-invite-landing__practice" id="interp-invite-practice-name">
            {t.practiceLabel}: <strong>{status.practiceDisplayName}</strong>
          </p>
          <p className="medical-interpreter-safety" role="note">
            {t.communicationNotice}
          </p>
          <ul className="interp-invite-landing__notices">
            <li>{t.noticeNoDiagnosis}</li>
            <li>{t.noticeNoTriage}</li>
            <li>{t.noticeNoTreatment}</li>
          </ul>
          <section
            className="interp-invite-landing__consent"
            aria-labelledby="interp-invite-consent-heading"
          >
            <h2 id="interp-invite-consent-heading" className="interp-invite-landing__subheading">
              {t.consentHeading}
            </h2>
            <p>{t.consentNoAutoShare}</p>
            <p>{t.consentExplicitStep}</p>
            <p>{t.consentPatientControl}</p>
          </section>
          <section
            className="interp-invite-landing__languages"
            aria-labelledby="interp-invite-lang-heading"
          >
            <h2 id="interp-invite-lang-heading" className="interp-invite-landing__subheading">
              {t.languagesHeading}
            </h2>
            <p>{t.languagesIntro}</p>
          </section>
          <div className="interp-invite-landing__actions">
            {loggedIn ? (
              <button
                type="button"
                className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
                disabled={!canContinue}
                onClick={handleContinue}
              >
                {t.continueLoggedIn}
              </button>
            ) : (
              <>
                <p className="interp-invite-landing__auth-note" role="note">
                  {t.authRequired}
                </p>
                <p className="interp-invite-landing__guest-note" role="note">
                  {t.guestUnsupported}
                </p>
                <button
                  type="button"
                  className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
                  onClick={handleLogin}
                  disabled={!canContinue}
                >
                  {t.loginToContinue}
                </button>
                <Link className="medical-interpreter-page__nav-link" to="/register">
                  {t.createAccount}
                </Link>
              </>
            )}
          </div>
        </>
      ) : null}

      {phase === "ready" && !status.valid && !fetchError ? (
        <p className="medical-interpreter-safety" role="note">
          {t.communicationNotice}
        </p>
      ) : null}
    </main>
  );
}
