import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { cloudErrorMessage } from "../utils/interpreterCloudErrors.js";

/**
 * @param {{
 *   labels: object;
 *   canUseCloud: boolean;
 *   accountConsent: boolean;
 *   busy?: boolean;
 *   onGrant: () => Promise<{ ok: boolean; error?: string }>;
 *   onRevoke?: () => Promise<{ ok: boolean; error?: string }>;
 *   onRevokeRequest?: () => void;
 *   showRevokeButton?: boolean;
 *   onStatusMessage?: (message: string) => void;
 * }} props
 */
export default function InterpreterCloudConsentPanel({
  labels: t,
  canUseCloud,
  accountConsent,
  busy = false,
  onGrant,
  onRevoke,
  onRevokeRequest,
  showRevokeButton = false,
  onStatusMessage,
}) {
  const headingId = useId();
  const [acceptChecked, setAcceptChecked] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  if (!canUseCloud) {
    return (
      <section
        className="interpreter-cloud-panel interpreter-cloud-panel--unavailable"
        aria-labelledby={headingId}
      >
        <h2 id={headingId} className="interpreter-live__section-title">
          {t.cloud.heading}
        </h2>
        <p className="interpreter-cloud-panel__body">{t.cloud.unavailable}</p>
      </section>
    );
  }

  const handleGrant = async () => {
    if (!acceptChecked) {
      setError(t.cloud.acceptRequired);
      return;
    }
    setError("");
    setWorking(true);
    const result = await onGrant();
    setWorking(false);
    if (!result.ok) {
      const msg = cloudErrorMessage(result.error, t);
      setError(msg);
      return;
    }
    setAcceptChecked(false);
    onStatusMessage?.(t.cloud.consentGranted);
  };

  const handleRevokeClick = () => {
    if (onRevokeRequest) {
      onRevokeRequest();
      return;
    }
    if (!onRevoke) return;
    setError("");
    setWorking(true);
    void onRevoke().then((result) => {
      setWorking(false);
      if (!result.ok) {
        setError(cloudErrorMessage(result.error, t));
        return;
      }
      onStatusMessage?.(t.cloud.consentRevoked);
    });
  };

  const disabled = busy || working;
  const showActiveRevoke = showRevokeButton || accountConsent;

  return (
    <section
      className="interpreter-cloud-panel"
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className="interpreter-live__section-title">
        {t.cloud.heading}
      </h2>

      <p className="interpreter-cloud-panel__lead">{t.cloud.lead}</p>

      <ul className="interpreter-cloud-panel__list">
        <li>{t.cloud.bulletLocalStill}</li>
        <li>{t.cloud.bulletWhatStored}</li>
        <li>{t.cloud.bulletNoAudio}</li>
        <li>{t.cloud.bulletDeleteAnytime}</li>
        <li>{t.cloud.bulletNotMedicalRecord}</li>
      </ul>

      {showActiveRevoke && accountConsent ? (
        <div className="interpreter-cloud-panel__active">
          <p className="interpreter-cloud-panel__status" role="status">
            {t.cloud.accountEnabled}
          </p>
          <p className="interpreter-cloud-panel__hint">{t.cloud.revokeHint}</p>
          <button
            type="button"
            className="medical-interpreter-page__nav-link"
            onClick={handleRevokeClick}
            disabled={disabled}
            aria-busy={working}
          >
            {t.cloud.revokeConsent}
          </button>
        </div>
      ) : !accountConsent ? (
        <form
          className="interpreter-cloud-panel__form"
          onSubmit={(e) => {
            e.preventDefault();
            void handleGrant();
          }}
          noValidate
        >
          <div className="interpreter-setup__checkbox-row">
            <input
              type="checkbox"
              id="interp-cloud-consent-account"
              checked={acceptChecked}
              onChange={(e) => {
                setAcceptChecked(e.target.checked);
                if (error) setError("");
              }}
              disabled={disabled}
            />
            <label htmlFor="interp-cloud-consent-account">
              {t.cloud.acceptLabel}
            </label>
          </div>

          {error ? (
            <p className="interpreter-feedback interpreter-feedback--error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
            disabled={disabled}
            aria-busy={working}
          >
            {t.cloud.enableAccount}
          </button>
        </form>
      ) : null}

      <p className="interpreter-cloud-panel__legal">
        <Link to="/patient/privacy">{t.privacy.linkPrivacy}</Link>
        {" · "}
        <Link to="/patient/disclaimer">{t.privacy.linkDisclaimer}</Link>
      </p>
    </section>
  );
}
