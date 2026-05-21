import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import { setInterpreterAck } from "../utils/interpreterAck.js";
import {
  getCurrentSession,
  updateSessionMetadata,
} from "../store/interpreterSessionStore.js";

/**
 * @param {{ onAccepted: () => void }} props
 */
export default function InterpreterPrivacyGate({ onAccepted }) {
  const t = useMedicalInterpreterMessages();
  const errorId = useId();
  const errorRef = useRef(null);

  const [accepted, setAccepted] = useState(false);
  const [storageOnDevice, setStorageOnDevice] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = t.privacy.heading;
  }, [t.privacy.heading]);

  const session = getCurrentSession();
  useEffect(() => {
    if (session?.storageConsent) {
      setStorageOnDevice(true);
    }
  }, [session?.storageConsent]);

  const handleContinue = (e) => {
    e.preventDefault();
    if (!accepted) {
      setError(t.privacy.acceptRequired);
      queueMicrotask(() => errorRef.current?.focus());
      return;
    }

    setError("");
    setInterpreterAck();

    if (session?.sessionId) {
      updateSessionMetadata(session.sessionId, {
        storageConsent: storageOnDevice === true,
      });
    }

    onAccepted();
  };

  return (
    <main
      className="medical-interpreter-page medical-interpreter-page--privacy interp-root"
      id="main-content"
    >
      <h1 className="medical-interpreter-page__title">{t.privacy.heading}</h1>

      <div className="interpreter-privacy__notice" role="region" aria-labelledby="interp-privacy-notice">
        <p id="interp-privacy-notice" className="interpreter-privacy__body">
          {t.safety.communicationOnly}
        </p>
        <ul className="interpreter-privacy__list">
          <li>{t.safety.noDiagnosis}</li>
          <li>{t.safety.noTriage}</li>
          <li>{t.safety.noTreatment}</li>
        </ul>
        <p className="interpreter-privacy__body">{t.privacy.body1}</p>
        <p className="interpreter-privacy__body">{t.privacy.body2}</p>
        <p className="interpreter-privacy__body">{t.safety.verifyTranslation}</p>
        <p className="interpreter-privacy__body">{t.privacy.body3}</p>
        <p className="interpreter-privacy__body">{t.privacy.body4}</p>
      </div>

      <form className="interpreter-privacy__form" onSubmit={handleContinue} noValidate>
        <div className="interpreter-setup__checkbox-row">
          <input
            type="checkbox"
            id="interp-storage-consent"
            className="interpreter-setup__checkbox"
            checked={storageOnDevice}
            onChange={(e) => setStorageOnDevice(e.target.checked)}
            aria-describedby="interp-storage-hint"
            aria-label={t.aria.privacyStorage}
          />
          <label htmlFor="interp-storage-consent" className="interpreter-setup__checkbox-label">
            {t.privacy.storageLabel}
          </label>
        </div>
        <p id="interp-storage-hint" className="interpreter-setup__hint">
          {storageOnDevice ? t.privacy.storageHint : t.privacy.noStorageWarning}
        </p>

        <div className="interpreter-setup__checkbox-row">
          <input
            type="checkbox"
            id="interp-privacy-accept"
            className="interpreter-setup__checkbox"
            checked={accepted}
            onChange={(e) => {
              setAccepted(e.target.checked);
              if (e.target.checked) setError("");
            }}
            aria-required="true"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `interp-privacy-accept-hint ${errorId}` : "interp-privacy-accept-hint"}
            aria-label={t.aria.privacyAccept}
          />
          <label htmlFor="interp-privacy-accept" className="interpreter-setup__checkbox-label">
            {t.privacy.acceptLabel}
          </label>
        </div>
        <p id="interp-privacy-accept-hint" className="interpreter-setup__hint">
          {t.privacy.legalLinks}
        </p>
        <p className="interpreter-privacy__legal-links">
          <Link to="/datenschutz">{t.privacy.linkPrivacy}</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/disclaimer">{t.privacy.linkDisclaimer}</Link>
        </p>

        {error ? (
          <p
            id={errorId}
            ref={errorRef}
            className="interpreter-setup__error"
            role="alert"
            tabIndex={-1}
          >
            {error}
          </p>
        ) : null}

        <div className="interpreter-setup__actions">
          <Link
            className="medical-interpreter-page__nav-link"
            to="/patient/interpreter/setup"
          >
            {t.chrome.backToSetup}
          </Link>
          <button
            type="submit"
            className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary interpreter-setup__submit"
          >
            {t.privacy.beginCta}
          </button>
        </div>
      </form>
    </main>
  );
}
