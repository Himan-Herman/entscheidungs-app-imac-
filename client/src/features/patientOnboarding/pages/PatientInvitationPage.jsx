import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  claimInvitation,
  fetchFamilyProfiles,
  previewInvitation,
} from "../api/invitationClaimApi.js";
import {
  clearStashedInvitation,
  clearTokenFromHash,
  loginReturnPath,
  readStashedInvitation,
  readTokenFromHash,
  stashInvitation,
} from "../invitationLink.js";
import "../../../styles/PatientOnboarding.css";

/**
 * The patient side of an invitation.
 *
 * FOUR DELIBERATE STEPS, and none of them happens by itself:
 *   1. read the credential from the URL fragment (or let the patient type a code)
 *   2. preview — who is inviting me? public, read-only, no account needed
 *   3. sign in, if not already
 *   4. choose WHO the connection is for, then press "connect"
 *
 * Opening this page, previewing, signing in and picking a subject all change
 * nothing. Only the button in step 4 does. That separation is why an invitation
 * forwarded to the wrong phone cannot quietly bind somebody's account.
 */
export default function PatientInvitationPage() {
  const { language } = useLanguage();
  const messages = getMessages(language);
  const tx = messages.patientOnboarding.patient;

  const [credential, setCredential] = useState({ token: null, code: null });
  const [codeInput, setCodeInput] = useState("");
  const [practice, setPractice] = useState(null);
  const [state, setState] = useState("loading"); // loading | needCredential | ready | invalid | done
  const [error, setError] = useState(null);

  const [profiles, setProfiles] = useState([]);
  const [subject, setSubject] = useState("self");
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState(null);

  const isAuthed = Boolean(
    typeof window !== "undefined" && window.localStorage.getItem("medscout_token"),
  );

  /** Ask the server who is inviting. Read-only; safe to call again. */
  const runPreview = useCallback(async (cred) => {
    setError(null);
    setState("loading");
    try {
      const res = await previewInvitation(cred);
      setPractice(res.practice);
      setCredential(cred);
      // Keep it across a sign-in round trip, per tab only.
      stashInvitation(cred);
      setState("ready");
    } catch {
      // Unknown, expired, spent, revoked, replaced — one answer, as the server
      // gives it. Guessing which would be inventing information we do not have.
      setState("invalid");
    }
  }, []);

  // Step 1: fragment first, then a stashed credential from before a sign-in.
  useEffect(() => {
    function consumeHash() {
      const fromHash = readTokenFromHash();
      if (!fromHash) return false;
      // Out of the address bar immediately: it is a credential, not a location.
      clearTokenFromHash();
      runPreview({ token: fromHash, code: null });
      return true;
    }

    if (!consumeHash()) {
      const stashed = readStashedInvitation();
      if (stashed && (stashed.token || stashed.code)) {
        runPreview(stashed);
      } else {
        setState("needCredential");
      }
    }

    // Pasting the link while already on this page changes only the fragment, so
    // the browser keeps the same document and nothing would remount. Without
    // this the patient sees the empty form and no reason why.
    const onHashChange = () => { consumeHash(); };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [runPreview]);

  // The subject picker needs the account's own profiles — only once signed in.
  useEffect(() => {
    if (state !== "ready" || !isAuthed) return;
    let cancelled = false;
    fetchFamilyProfiles()
      .then((res) => { if (!cancelled) setProfiles(res.profiles || []); })
      .catch(() => { if (!cancelled) setError(tx.subject.loadError); });
    return () => { cancelled = true; };
  }, [state, isAuthed, tx.subject.loadError]);

  async function submitCode(e) {
    e.preventDefault();
    const code = codeInput.trim();
    if (!code) return;
    await runPreview({ token: null, code });
  }

  /** Step 4. The only call on this page that changes anything. */
  async function connect() {
    if (claiming) return;
    setClaiming(true);
    setError(null);
    try {
      const chosen = subject === "self"
        ? { type: "self" }
        : { type: "patient_profile", patientProfileId: subject };
      const res = await claimInvitation({ ...credential, subject: chosen });

      // Spent. Drop the credential from memory and from the tab immediately —
      // it can do nothing more, and it should not survive in either.
      clearStashedInvitation();
      setCredential({ token: null, code: null });
      setResult(res);
      setState("done");
    } catch (err) {
      const byCode = {
        claim_subject_mismatch: tx.errors.subjectMismatch,
        link_already_bound_to_entry: tx.errors.alreadyLinked,
        entry_not_claimable: tx.errors.notClaimable,
        link_already_exists: tx.errors.conflict,
        validation_subject_required: tx.errors.subjectRequired,
        validation_subject_invalid: tx.errors.subjectRequired,
        invalid_or_expired_invitation: null, // handled below as a state change
      };
      if (err?.code === "invalid_or_expired_invitation") {
        clearStashedInvitation();
        setState("invalid");
      } else {
        setError(byCode[err?.code] || tx.errors.generic);
      }
      setClaiming(false);
    }
  }

  /* ------------------------------------------------------------- rendering */

  if (state === "loading") {
    return (
      <section className="onboarding-page onboarding-page--narrow">
        <p className="onboarding-page__intro" role="status">{tx.loading}</p>
      </section>
    );
  }

  if (state === "invalid") {
    return (
      <section className="onboarding-page onboarding-page--narrow">
        <h1 className="onboarding-page__title">{tx.invalid.title}</h1>
        <p className="onboarding-page__intro">{tx.invalid.body}</p>
      </section>
    );
  }

  if (state === "done") {
    const activeAlready = result?.link?.status === "active";
    return (
      <section className="onboarding-page onboarding-page--narrow">
        <h1 className="onboarding-page__title">{tx.success.title}</h1>
        <p className="onboarding-page__intro">
          {tx.success.body.replace("{practice}", result?.practice?.displayName || "")}
        </p>

        {/* Driven by the REAL link status the server returned, never inferred. */}
        {activeAlready ? (
          <>
            <p className="onboarding-alert onboarding-alert--ok">{tx.success.alreadyActive}</p>
            <Link className="onboarding-btn" to={`/patient/practice/${result.link.id}`}>
              {tx.success.toPractice}
            </Link>
          </>
        ) : (
          <>
            <h2 className="onboarding-card__name">{tx.success.consentNext}</h2>
            <p className="onboarding-page__intro">{tx.success.consentHint}</p>
            {/* Consent is the existing flow, untouched: this only leads there. */}
            <Link className="onboarding-btn" to="/patient/practice-links">
              {tx.success.toConsent}
            </Link>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="onboarding-page onboarding-page--narrow">
      <h1 className="onboarding-page__title">{tx.title}</h1>

      {state === "needCredential" && (
        <>
          <p className="onboarding-page__intro">{tx.noCredential.body}</p>
          <form onSubmit={submitCode}>
            <label className="onboarding-field">
              <span className="onboarding-field__label">{tx.manualCode.label}</span>
              <input
                className="onboarding-field__input"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder={tx.manualCode.placeholder}
                autoComplete="off"
                aria-describedby="code-hint"
              />
              <span className="onboarding-field__hint" id="code-hint">{tx.manualCode.hint}</span>
            </label>
            <button type="submit" className="onboarding-btn" disabled={!codeInput.trim()}>
              {tx.manualCode.submit}
            </button>
          </form>
        </>
      )}

      {state === "ready" && practice && (
        <>
          <div className="onboarding-practice">
            <p className="onboarding-practice__label">{tx.invitedBy}</p>
            <p className="onboarding-practice__name">{practice.displayName}</p>
            <p className="onboarding-practice__meta">
              {[practice.specialty, practice.city].filter(Boolean).join(" · ")}
            </p>
          </div>

          {!isAuthed ? (
            <>
              <h2 className="onboarding-card__name">{tx.auth.title}</h2>
              <p className="onboarding-page__intro">{tx.auth.body}</p>
              <div className="onboarding-card__actions">
                {/* No credential in either URL — it is already stashed per tab. */}
                <Link
                  className="onboarding-btn"
                  to={`/login?next=${encodeURIComponent(loginReturnPath())}`}
                >
                  {tx.auth.login}
                </Link>
                <Link
                  className="onboarding-btn onboarding-btn--ghost"
                  to={`/register?next=${encodeURIComponent(loginReturnPath())}`}
                >
                  {tx.auth.register}
                </Link>
              </div>
            </>
          ) : (
            <>
              <fieldset className="onboarding-fieldset">
                <legend className="onboarding-card__name">{tx.subject.title}</legend>
                <p className="onboarding-field__hint">{tx.subject.hint}</p>

                <label className="onboarding-radio">
                  <input
                    type="radio" name="subject" value="self"
                    checked={subject === "self"}
                    onChange={() => setSubject("self")}
                  />
                  <span>
                    <strong>{tx.subject.self}</strong>
                    <span className="onboarding-field__hint">{tx.subject.selfHint}</span>
                  </span>
                </label>

                {profiles.length > 0 ? (
                  <>
                    <p className="onboarding-field__label">{tx.subject.profileGroup}</p>
                    {profiles.map((p) => (
                      <label className="onboarding-radio" key={p.id}>
                        <input
                          type="radio" name="subject" value={p.id}
                          checked={subject === p.id}
                          onChange={() => setSubject(p.id)}
                        />
                        <span>
                          <strong>{p.displayName}</strong>
                          <span className="onboarding-field__hint">{p.relationLabel}</span>
                        </span>
                      </label>
                    ))}
                  </>
                ) : (
                  <p className="onboarding-field__hint">{tx.subject.noProfiles}</p>
                )}
              </fieldset>

              {error && (
                <p className="onboarding-alert onboarding-alert--error" role="alert">{error}</p>
              )}

              <p className="onboarding-field__hint">{tx.connect.hint}</p>
              {/* Locked while in flight: a double click must not attempt two claims. */}
              <button
                type="button" className="onboarding-btn onboarding-btn--primary"
                onClick={connect} disabled={claiming}
              >
                {claiming ? tx.connect.working : tx.connect.button}
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
