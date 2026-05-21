import { Link } from "react-router-dom";

/**
 * @param {{
 *   visible: boolean;
 *   checked: boolean;
 * onCheckedChange: (v: boolean) => void;
 *   loadError: string;
 *   labels: object;
 * }} props
 */
export default function InterpreterSetupProfileConsent({
  visible,
  checked,
  onCheckedChange,
  loadError,
  labels: t,
}) {
  if (!visible) return null;

  return (
    <section
      className="interpreter-setup__section interpreter-setup__section--profile"
      aria-labelledby="interp-setup-profile-heading"
    >
      <h2 id="interp-setup-profile-heading" className="interpreter-setup__subheading">
        {t.profile.heading}
      </h2>
      <p className="interpreter-setup__hint">{t.profile.intro}</p>
      {loadError ? (
        <p className="interpreter-setup__hint" role="status">
          {loadError}
        </p>
      ) : null}
      <div className="interpreter-setup__checkbox-row">
        <input
          type="checkbox"
          id="interp-profile-consent"
          className="interpreter-setup__checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          aria-describedby="interp-profile-consent-hint"
          aria-label={t.aria.profileConsent}
        />
        <label htmlFor="interp-profile-consent" className="interpreter-setup__checkbox-label">
          {t.profile.consentLabel}
        </label>
      </div>
      <p id="interp-profile-consent-hint" className="interpreter-setup__hint">
        {t.profile.consentHint}
      </p>
      <Link className="interpreter-setup__text-link" to="/account/personal">
        {t.profile.accountLink}
      </Link>
    </section>
  );
}
