import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { authFetch } from "../../../api/authFetch.js";
import { endSession } from "../../../lib/session.js";
import {
  checkInvitationEligibility,
  claimInvitation,
  fetchFamilyProfiles,
  previewInvitation,
} from "../api/invitationClaimApi.js";
import {
  INVITATION_PATH,
  clearStashedInvitation,
  clearTokenFromHash,
  readStashedInvitation,
  readTokenFromHash,
  stashInvitation,
} from "../invitationLink.js";
import "../../../styles/PatientOnboarding.css";

/**
 * The patient side of an invitation.
 *
 * AS FEW STEPS AS POSSIBLE, AND NONE THAT HAPPENS BY ITSELF.
 *   Signed in:      one tap — "Connect".
 *   Not signed in:  sign in (or create an account), come back here
 *                   automatically, then that same one tap.
 *
 * Opening this page, previewing, signing in and picking a subject all change
 * nothing. Only the connect button does. That separation is why an invitation
 * forwarded to the wrong phone cannot quietly bind somebody's account.
 *
 * WHICH ACCOUNT. The page says, before the button, exactly which account is
 * about to be connected, with a way to switch. An invitation is a bearer
 * credential by design — it is not bound to the address it was mailed to, so
 * on-site QR codes and typed codes work too — which makes the signed-in account
 * the one thing the patient must be able to see. Without it, a family laptop
 * signed in as somebody else connects that somebody else, and nobody notices.
 *
 * WHO FOR. The "for whom" question only appears when there is a real choice,
 * i.e. the account manages family profiles. With none, the answer is always
 * "yourself", and asking it anyway is a question with one possible answer.
 */
export default function PatientInvitationPage() {
  const { language } = useLanguage();
  const messages = getMessages(language);
  const tx = messages.patientOnboarding.patient;
  const navigate = useNavigate();

  const [credential, setCredential] = useState({ token: null, code: null });
  const [codeInput, setCodeInput] = useState("");
  const [practice, setPractice] = useState(null);
  const [state, setState] = useState("loading"); // loading | needCredential | ready | invalid | done
  const [error, setError] = useState(null);

  const [account, setAccount] = useState(null); // { name, email } of the signed-in account
  // True when the signed-in account works at the inviting practice. Such an
  // account can never redeem the invitation, so the page says so BEFORE the
  // button instead of after a failed tap.
  const [isPracticeTeam, setIsPracticeTeam] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [subject, setSubject] = useState("self");
  const [claiming, setClaiming] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [result, setResult] = useState(null);

  const headingRef = useRef(null);

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

  // Signed in: who am I, and whom may I connect? Both only once there is an
  // invitation worth acting on.
  useEffect(() => {
    if (state !== "ready" || !isAuthed) return undefined;
    let cancelled = false;

    authFetch("/api/account/patient-settings")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load_failed"))))
      .then((data) => {
        if (cancelled) return;
        const user = data?.user || {};
        const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
        setAccount({ name, email: String(user.email || "").trim() });
      })
      // The account strip is orientation, not a gate: without it the page still
      // works, it just cannot name the account.
      .catch(() => { if (!cancelled) setAccount({ name: "", email: "" }); });

    fetchFamilyProfiles()
      .then((res) => { if (!cancelled) setProfiles(res.profiles || []); })
      .catch(() => { if (!cancelled) setError(tx.subject.loadError); });

    // Orientation only: the claim enforces the same rule on the server, so a
    // failed check simply leaves the button where it is.
    checkInvitationEligibility(credential)
      .then((res) => {
        if (!cancelled) setIsPracticeTeam(res?.eligible === false && res?.reason === "claimer_is_practice_team");
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [state, isAuthed, credential, tx.subject.loadError]);

  // Every state change is announced: focus moves to the new heading, so a
  // screen reader hears what happened and a keyboard user starts from the top.
  useEffect(() => {
    if (state === "loading") return;
    headingRef.current?.focus();
  }, [state]);

  async function submitCode(e) {
    e.preventDefault();
    const code = codeInput.trim();
    if (!code) return;
    await runPreview({ token: null, code });
  }

  /** Sign out, keep the invitation, and come straight back after signing in. */
  async function switchAccount() {
    if (switching) return;
    setSwitching(true);
    // The stash survives: endSession() leaves sessionStorage alone on purpose.
    if (credential.token || credential.code) stashInvitation(credential);
    await endSession();
    navigate(`/login?next=${encodeURIComponent(INVITATION_PATH)}`, { replace: true });
  }

  /** The only call on this page that changes anything. */
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
      };
      if (err?.code === "invalid_or_expired_invitation") {
        clearStashedInvitation();
        setState("invalid");
      } else if (err?.code === "claimer_is_practice_team") {
        // The invitation is still good — just not for this account. Keep it
        // stashed so switching account lands straight back here.
        setIsPracticeTeam(true);
      } else {
        setError(byCode[err?.code] || tx.errors.generic);
      }
      setClaiming(false);
    }
  }

  /* ------------------------------------------------------------- rendering */

  const practiceCard = practice ? (
    <div className="onboarding-practice onboarding-practice--hero">
      <span className="onboarding-practice__avatar" aria-hidden="true">
        {initialsOf(practice.displayName)}
      </span>
      <div className="onboarding-practice__text">
        <p className="onboarding-practice__name">{practice.displayName}</p>
        {[practice.specialty, practice.city].some(Boolean) ? (
          <p className="onboarding-practice__meta">
            {[practice.specialty, practice.city].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>
    </div>
  ) : null;

  if (state === "loading") {
    return (
      <section className="onboarding-page onboarding-page--narrow onboarding-invite">
        <p className="onboarding-invite__loading" role="status">
          <span className="onboarding-spinner" aria-hidden="true" />
          {tx.loading}
        </p>
      </section>
    );
  }

  if (state === "invalid") {
    return (
      <section className="onboarding-page onboarding-page--narrow onboarding-invite">
        <h1 className="onboarding-page__title" ref={headingRef} tabIndex={-1}>
          {tx.invalid.title}
        </h1>
        <p className="onboarding-page__intro">{tx.invalid.body}</p>
        <div className="onboarding-invite__actions">
          {isAuthed ? (
            <button
              type="button"
              className="onboarding-btn"
              onClick={switchAccount}
              disabled={switching}
            >
              {tx.account.switch}
            </button>
          ) : null}
          <Link className="onboarding-btn" to={isAuthed ? "/patient/practice" : "/"}>
            {isAuthed ? tx.success.toOverview : tx.invalid.toStart}
          </Link>
        </div>
      </section>
    );
  }

  if (state === "done") {
    const activeAlready = result?.link?.status === "active";
    const practiceName = result?.practice?.displayName || practice?.displayName || "";
    const linkId = result?.link?.id;
    return (
      <section className="onboarding-page onboarding-page--narrow onboarding-invite">
        <div className="onboarding-success">
          <span className="onboarding-success__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" focusable="false">
              <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h1 className="onboarding-page__title" ref={headingRef} tabIndex={-1}>
            {tx.success.title}
          </h1>
          <p className="onboarding-page__intro">
            {tx.success.body.replace("{practice}", practiceName)}
          </p>
        </div>

        <div className="onboarding-invite__actions onboarding-invite__actions--stack">
          <Link
            className="onboarding-btn onboarding-btn--primary onboarding-btn--block"
            to={linkId ? `/patient/practice/${linkId}` : "/patient/practice"}
          >
            {tx.success.toPractice}
          </Link>
          <Link className="onboarding-btn onboarding-btn--block" to="/patient/practice">
            {tx.success.toOverview}
          </Link>
        </div>

        {/* Driven by the REAL link status the server returned, never inferred. */}
        {activeAlready ? (
          <p className="onboarding-alert onboarding-alert--ok">{tx.success.alreadyActive}</p>
        ) : (
          <div className="onboarding-next">
            <h2 className="onboarding-next__title">{tx.success.consentNext}</h2>
            <p className="onboarding-next__body">{tx.success.consentHint}</p>
            {/* Consent is the existing flow, untouched: this only leads there. */}
            <Link
              className="onboarding-btn"
              to={linkId ? `/patient/practice-links?request=${encodeURIComponent(linkId)}` : "/patient/practice-links"}
            >
              {tx.success.toConsent}
            </Link>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="onboarding-page onboarding-page--narrow onboarding-invite">
      <p className="onboarding-invite__eyebrow">{tx.title}</p>

      {state === "needCredential" && (
        <>
          <h1 className="onboarding-page__title" ref={headingRef} tabIndex={-1}>
            {tx.noCredential.title}
          </h1>
          <p className="onboarding-page__intro">{tx.noCredential.body}</p>
          <form onSubmit={submitCode} className="onboarding-invite__code">
            <label className="onboarding-field" htmlFor="invitation-code">
              <span className="onboarding-field__label">{tx.manualCode.label}</span>
              <input
                id="invitation-code"
                className="onboarding-field__input"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder={tx.manualCode.placeholder}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby="code-hint"
              />
              <span className="onboarding-field__hint" id="code-hint">{tx.manualCode.hint}</span>
            </label>
            <button type="submit" className="onboarding-btn onboarding-btn--primary" disabled={!codeInput.trim()}>
              {tx.manualCode.submit}
            </button>
          </form>
        </>
      )}

      {state === "ready" && practice && (
        <>
          <h1 className="onboarding-page__title" ref={headingRef} tabIndex={-1}>
            {tx.heading.replace("{practice}", practice.displayName)}
          </h1>
          {practiceCard}

          {!isAuthed ? (
            <>
              <h2 className="onboarding-invite__question">{tx.auth.title}</h2>
              <div className="onboarding-choices">
                {/* No credential in either URL — it is already stashed per tab. */}
                {/* Both routes in are equal choices, so both look the same. */}
                <Link
                  className="onboarding-choice"
                  to={`/login?next=${encodeURIComponent(INVITATION_PATH)}`}
                >
                  <span className="onboarding-choice__lead">{tx.auth.loginLead}</span>
                  <span className="onboarding-choice__action">{tx.auth.login}</span>
                </Link>
                <Link
                  className="onboarding-choice"
                  to={`/register?next=${encodeURIComponent(INVITATION_PATH)}`}
                >
                  <span className="onboarding-choice__lead">{tx.auth.registerLead}</span>
                  <span className="onboarding-choice__action">{tx.auth.register}</span>
                </Link>
              </div>
              <p className="onboarding-invite__reassure">{tx.auth.body}</p>
            </>
          ) : (
            <>
              <div className="onboarding-account" data-testid="invitation-account">
                <div className="onboarding-account__who">
                  <span className="onboarding-account__label">{tx.account.label}</span>
                  {account === null ? (
                    <span className="onboarding-account__name" aria-busy="true">{tx.account.loading}</span>
                  ) : (
                    <>
                      {account.name ? <span className="onboarding-account__name">{account.name}</span> : null}
                      {account.email ? <span className="onboarding-account__email">{account.email}</span> : null}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className="onboarding-account__switch"
                  onClick={switchAccount}
                  disabled={switching || claiming}
                >
                  {tx.account.switch}
                </button>
              </div>

              {profiles.length > 0 ? (
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
                </fieldset>
              ) : null}

              {error && (
                <p className="onboarding-alert onboarding-alert--error" role="alert">{error}</p>
              )}

              {isPracticeTeam ? (
                <div className="onboarding-team" role="alert" data-testid="invitation-team-account">
                  <p className="onboarding-team__title">{tx.team.title}</p>
                  <p className="onboarding-team__body">
                    {tx.team.body.replace("{practice}", practice.displayName)}
                  </p>
                  <button
                    type="button"
                    className="onboarding-btn onboarding-btn--primary onboarding-btn--block onboarding-btn--large"
                    onClick={switchAccount}
                    disabled={switching}
                  >
                    {tx.team.action}
                  </button>
                </div>
              ) : (
                /* Locked while in flight: a double tap must not attempt two claims. */
                <button
                  type="button"
                  className="onboarding-btn onboarding-btn--primary onboarding-btn--block onboarding-btn--large"
                  onClick={connect}
                  disabled={claiming || switching}
                  aria-busy={claiming}
                >
                  {claiming ? tx.connect.working : tx.connect.button}
                </button>
              )}
              {isPracticeTeam ? null : (
                <p className="onboarding-invite__reassure">
                  <svg className="onboarding-invite__lock" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                    <path d="M7 10V8a5 5 0 0110 0v2m-11 0h12v10H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  </svg>
                  {tx.connect.hint}
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

/** Two letters for the practice badge; display only. */
function initialsOf(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] || "?").slice(0, 2);
  return letters.toUpperCase();
}
