import { useId, useState } from "react";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import {
  peekEphemeralInviteToken,
  readInterpreterInviteContext,
} from "../utils/interpreterInviteContext.js";
import { sessionToPracticeSharePayload } from "../utils/interpreterCloudPayload.js";
import {
  grantPracticeShareViaInviteToken,
} from "../api/interpreterPracticeSharingApi.js";

/**
 * Explicit opt-in sharing with practice after invite — no pre-checked box.
 * @param {{ session: import('../types.js').InterpreterSession }} props
 */
export default function InterpreterPracticeSharePanel({ session }) {
  const t = useMedicalInterpreterMessages();
  const labels = t.practiceShare;
  const checkboxId = useId();
  const [consentChecked, setConsentChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(
    /** @type {{ type: 'idle' | 'ok' | 'error'; message?: string }} */ ({ type: "idle" }),
  );

  const inviteContext = readInterpreterInviteContext();
  const inviteToken = peekEphemeralInviteToken();

  if (!inviteContext?.practiceDisplayName) return null;

  const handleGrant = async () => {
    if (!consentChecked || busy || !inviteToken) return;
    setBusy(true);
    setStatus({ type: "idle" });
    const result = await grantPracticeShareViaInviteToken(
      inviteToken,
      sessionToPracticeSharePayload(session),
    );
    setBusy(false);
    if (result.ok) {
      setStatus({ type: "ok", message: labels.grantSuccess });
    } else {
      setStatus({
        type: "error",
        message: result.message || labels.grantError,
      });
    }
  };

  return (
    <section
      className="interp-practice-share"
      aria-labelledby="interp-practice-share-heading"
    >
      <h2 id="interp-practice-share-heading" className="interpreter-live__section-title">
        {labels.heading}
      </h2>
      <p className="medical-interpreter-safety" role="note">
        {labels.communicationNotice}
      </p>
      <p>{labels.intro.replace("{practice}", inviteContext.practiceDisplayName)}</p>
      <ul className="interp-practice-share__list">
        <li>{labels.noticeNoAudio}</li>
        <li>{labels.noticeDocumentation}</li>
        <li>{labels.noticeRevoke}</li>
        <li>{labels.noticeNotMedicalRecord}</li>
      </ul>
      <div className="interp-practice-share__checkbox">
        <input
          id={checkboxId}
          type="checkbox"
          checked={consentChecked}
          onChange={(e) => setConsentChecked(e.target.checked)}
        />
        <label htmlFor={checkboxId}>{labels.consentLabel}</label>
      </div>
      {!inviteToken ? (
        <p className="interpreter-empty-state" role="alert">
          {labels.tokenMissing}
        </p>
      ) : (
        <button
          type="button"
          className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
          disabled={!consentChecked || busy}
          onClick={() => void handleGrant()}
        >
          {busy ? labels.granting : labels.grantButton}
        </button>
      )}
      {status.type === "ok" ? (
        <p className="interp-practice-share__status interp-practice-share__status--ok" role="status" aria-live="polite">
          {status.message}
        </p>
      ) : null}
      {status.type === "error" ? (
        <p className="interp-practice-share__status interp-practice-share__status--error" role="alert">
          {status.message}
        </p>
      ) : null}
    </section>
  );
}
