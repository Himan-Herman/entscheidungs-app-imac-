import { useCallback, useEffect, useMemo, useState } from "react";
import FocusModal from "../../patientPractices/components/FocusModal.jsx";
import { authFetch } from "../../../api/authFetch.js";
import {
  fetchPracticeLifecycle,
  postPracticeLifecycleAction,
} from "../api/lifecycleExitApi.js";
import { buildDeletionMail } from "../lib/deletionMail.js";
import "../../../styles/LifecycleExit.css";

/**
 * "Mitgliedschaft und Praxisstatus" — owner-only lifecycle administration.
 *
 * Renders nothing for non-owners (the status endpoint answers 403/404 for
 * them). The two reversible alternatives (pause, close) always appear BEFORE
 * the deletion request, nothing is pre-selected, and every mutation demands
 * the owner's password. A deletion request only ever creates a written case —
 * the panel afterwards says explicitly that opening the mail client is not a
 * proof of sending.
 *
 * @param {{ practiceId: string, practiceName: string, t: Record<string, any> }} props
 *   t = lifecycleExit.practice bundle
 */
export default function PracticeLifecycleSection({ practiceId, practiceName, t }) {
  const [state, setState] = useState(null); // { status, cases, supportEmail, ownerEmail }
  const [hidden, setHidden] = useState(false);
  const [dialogAction, setDialogAction] = useState(null); // suspend|reactivate|close|request-reactivation|request-deletion
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestResult, setRequestResult] = useState(null); // { caseNumber }
  const [ownerName, setOwnerName] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try {
      const { res, data } = await fetchPracticeLifecycle(practiceId);
      if (res.status === 403 || res.status === 404) {
        setHidden(true);
        return;
      }
      if (res.ok && data?.ok) {
        setState({
          status: data.status,
          practiceName: data.practiceName || "",
          cases: Array.isArray(data.cases) ? data.cases : [],
          supportEmail: data.supportEmail || "contact@medscoutx.com",
          ownerEmail: data.ownerEmail || "",
        });
      }
    } catch {
      /* section stays in loading state; no destructive control is shown */
    }
  }, [practiceId]);

  useEffect(() => {
    setState(null);
    setHidden(false);
    setRequestResult(null);
    setNotice("");
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/api/account/patient-settings");
        const j = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        const user = j?.user || {};
        const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
        setOwnerName(name);
      } catch {
        /* the mail template simply keeps an empty signature name */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const supportEmail = state?.supportEmail || "contact@medscoutx.com";
  // Prefer the lifecycle endpoint's name: the settings form above cannot load
  // it once the practice is no longer active.
  const effectivePracticeName = state?.practiceName || practiceName || "";
  const status = state?.status || null;

  const openDeletionCase = useMemo(() => {
    if (requestResult?.caseNumber) return requestResult.caseNumber;
    const kase = (state?.cases || []).find(
      (c) => c.action === "practice_deletion_requested" &&
        ["recorded", "awaiting_email_confirmation", "in_review"].includes(c.status),
    );
    return kase?.caseNumber ?? null;
  }, [state, requestResult]);

  const { subject: mailSubject, href: mailtoHref } = useMemo(
    () =>
      buildDeletionMail({
        t,
        supportEmail,
        practiceName: effectivePracticeName,
        caseNumber: openDeletionCase,
        ownerEmail: state?.ownerEmail || "",
        ownerName,
      }),
    [t, supportEmail, effectivePracticeName, openDeletionCase, state, ownerName],
  );

  async function copyText(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2500);
    } catch {
      window.prompt(t.copyFailed, text);
    }
  }

  function openDialog(action) {
    setDialogAction(action);
    setPassword("");
    setReason("");
    setError("");
    setNotice("");
  }

  function closeDialog() {
    if (working) return;
    setDialogAction(null);
    setPassword("");
    setReason("");
    setError("");
  }

  async function handleConfirm() {
    if (!dialogAction || !password) return;
    setWorking(true);
    setError("");
    try {
      const body = { password };
      if (dialogAction === "request-deletion" && reason.trim()) {
        body.reason = reason.trim();
      }
      const { res, data } = await postPracticeLifecycleAction(practiceId, dialogAction, body);
      if (res.ok && data?.ok) {
        if (dialogAction === "request-deletion") {
          setRequestResult({ caseNumber: data.caseNumber ?? null });
        }
        setNotice(t.receiptHint);
        setDialogAction(null);
        setPassword("");
        setReason("");
        await load();
        return;
      }
      const code = data?.error;
      setError(t.errors[code] ?? t.errors.generic);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.errors.generic);
    } finally {
      setWorking(false);
    }
  }

  if (hidden) return null;
  if (!state) return null;

  const DIALOG_COPY = {
    suspend: { title: t.pauseConfirmTitle, body: t.pauseConfirmBody, danger: false },
    reactivate: { title: t.reactivateConfirmTitle, body: t.reactivateConfirmBody, danger: false },
    close: { title: t.closeConfirmTitle, body: t.closeConfirmBody, danger: false },
    "request-reactivation": {
      title: t.requestReactivateConfirmTitle,
      body: t.requestReactivateConfirmBody,
      danger: false,
    },
    "request-deletion": {
      title: t.deleteConfirmTitle,
      body: t.deleteConfirmBody,
      danger: true,
    },
  };
  const dialogCopy = dialogAction ? DIALOG_COPY[dialogAction] : null;

  const showPause = status === "active";
  const showClose = status === "active" || status === "suspended";
  const showReactivate = status === "suspended";
  const showRequestReactivation = status === "closed";
  const showDeleteRequest = ["active", "suspended", "closed"].includes(status);

  return (
    <section
      className="practice-settings__section"
      aria-labelledby="practice-lifecycle-title"
    >
      <h2 id="practice-lifecycle-title" className="practice-settings__section-title">
        {t.sectionTitle}
      </h2>
      <p className="lifecycle-exit__note">{t.sectionIntro}</p>

      <p className="lifecycle-exit__status-line">
        <span>{t.statusLabel}:</span>
        <strong className="lifecycle-exit__status-value">
          {t.status[status] ?? status}
        </strong>
      </p>

      {t.statusBanner[status] ? (
        <div
          className={`lifecycle-exit__status-banner${status === "deletion_requested" ? " lifecycle-exit__status-banner--danger" : ""}`}
          role="status"
        >
          {t.statusBanner[status]}
        </div>
      ) : null}

      {notice ? (
        <p className="lifecycle-exit__ok" role="status">
          {notice}
        </p>
      ) : null}

      {/* Reversible alternatives ALWAYS come before the deletion request. */}
      <div className="lifecycle-exit__cards">
        {showPause ? (
          <article className="lifecycle-exit__card">
            <h3 className="lifecycle-exit__card-title">{t.pauseTitle}</h3>
            <p className="lifecycle-exit__card-body">{t.pauseBody}</p>
            <p className="lifecycle-exit__note">{t.pauseRecommendedTitle}</p>
            <ul className="lifecycle-exit__list">
              {t.pauseRecommended.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button
              type="button"
              className="lifecycle-exit__btn lifecycle-exit__btn--outline"
              onClick={() => openDialog("suspend")}
            >
              {t.pauseButton}
            </button>
          </article>
        ) : null}

        {showClose ? (
          <article className="lifecycle-exit__card">
            <h3 className="lifecycle-exit__card-title">{t.closeTitle}</h3>
            <p className="lifecycle-exit__card-body">{t.closeBody}</p>
            <p className="lifecycle-exit__note">{t.closeRecommendedNote}</p>
            <button
              type="button"
              className="lifecycle-exit__btn lifecycle-exit__btn--outline"
              onClick={() => openDialog("close")}
            >
              {t.closeButton}
            </button>
          </article>
        ) : null}

        {showReactivate ? (
          <article className="lifecycle-exit__card">
            <h3 className="lifecycle-exit__card-title">{t.reactivateTitle}</h3>
            <p className="lifecycle-exit__card-body">{t.reactivateBody}</p>
            <button
              type="button"
              className="lifecycle-exit__btn lifecycle-exit__btn--primary"
              onClick={() => openDialog("reactivate")}
            >
              {t.reactivateButton}
            </button>
          </article>
        ) : null}

        {showRequestReactivation ? (
          <article className="lifecycle-exit__card">
            <h3 className="lifecycle-exit__card-title">{t.requestReactivateTitle}</h3>
            <p className="lifecycle-exit__card-body">{t.requestReactivateBody}</p>
            <button
              type="button"
              className="lifecycle-exit__btn lifecycle-exit__btn--primary"
              onClick={() => openDialog("request-reactivation")}
            >
              {t.requestReactivateButton}
            </button>
          </article>
        ) : null}

        {showDeleteRequest ? (
          <article className="lifecycle-exit__card lifecycle-exit__card--danger">
            <h3 className="lifecycle-exit__card-title">{t.deleteTitle}</h3>
            <div className="lifecycle-exit__warning-card" role="note">
              <p className="lifecycle-exit__warning-title">
                <span aria-hidden="true">⚠️</span> {t.deleteWarning}
              </p>
            </div>
            <p className="lifecycle-exit__card-body">{t.deleteBody}</p>
            <button
              type="button"
              className="lifecycle-exit__btn lifecycle-exit__btn--outline-danger"
              onClick={() => openDialog("request-deletion")}
            >
              {t.deleteButton}
            </button>
          </article>
        ) : null}
      </div>

      {status === "deletion_requested" && openDeletionCase ? (
        <div className="lifecycle-exit__request-panel" role="region" aria-label={t.afterRequestTitle}>
          <h3 className="lifecycle-exit__card-title">{t.afterRequestTitle}</h3>
          <p className="lifecycle-exit__note">
            {t.afterRequestBody.replace("{caseNumber}", openDeletionCase)}
          </p>
          <p className="lifecycle-exit__note">
            <span className="lifecycle-exit__case-number">{openDeletionCase}</span>
          </p>
          <p className="lifecycle-exit__note">
            {t.emailConfirmHint.replace("{supportEmail}", supportEmail)}
          </p>
          <div className="lifecycle-exit__panel-actions">
            <a className="lifecycle-exit__btn lifecycle-exit__btn--primary" href={mailtoHref}>
              {t.openMailButton}
            </a>
            <button
              type="button"
              className="lifecycle-exit__btn lifecycle-exit__btn--outline"
              onClick={() => void copyText(openDeletionCase, "case")}
            >
              {copied === "case" ? t.copied : t.copyCaseButton}
            </button>
            <button
              type="button"
              className="lifecycle-exit__btn lifecycle-exit__btn--outline"
              onClick={() => void copyText(mailSubject, "subject")}
            >
              {copied === "subject" ? t.copied : t.copySubjectButton}
            </button>
          </div>
          <p className="lifecycle-exit__note">{t.mailNotSentNote}</p>
        </div>
      ) : null}

      {(state.cases || []).length > 0 ? (
        <>
          <h3 className="lifecycle-exit__label">{t.caseListTitle}</h3>
          <ul className="lifecycle-exit__case-list">
            {state.cases.map((c) => (
              <li key={c.caseNumber}>
                <span className="lifecycle-exit__case-number">{c.caseNumber}</span>{" "}
                — {t.caseStatus[c.status] ?? c.status}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="lifecycle-exit__support">
        {t.supportLabel} <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
      </p>

      {dialogCopy ? (
        <FocusModal
          open
          onClose={closeDialog}
          titleId="practice-lifecycle-dialog-title"
          title={dialogCopy.title}
        >
          {dialogCopy.danger ? (
            <div className="lifecycle-exit__warning-card" role="alert">
              <p className="lifecycle-exit__warning-title">
                <span aria-hidden="true">⚠️</span> {t.deleteWarning}
              </p>
            </div>
          ) : null}
          <p className="lifecycle-exit__note">{dialogCopy.body}</p>

          {dialogAction === "request-deletion" ? (
            <div className="lifecycle-exit__field">
              <label className="lifecycle-exit__label" htmlFor="practice-lifecycle-reason">
                {t.reasonLabel}
              </label>
              <input
                id="practice-lifecycle-reason"
                className="lifecycle-exit__input"
                type="text"
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          ) : null}

          <div className="lifecycle-exit__field">
            <label className="lifecycle-exit__label" htmlFor="practice-lifecycle-password">
              {t.passwordLabel}
            </label>
            <p className="lifecycle-exit__note">{t.passwordHelp}</p>
            <input
              id="practice-lifecycle-password"
              className="lifecycle-exit__input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error ? (
            <p className="lifecycle-exit__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="lifecycle-exit__dialog-actions">
            <button
              type="button"
              className="lifecycle-exit__btn lifecycle-exit__btn--outline"
              onClick={closeDialog}
              disabled={working}
            >
              {t.dialogCancel}
            </button>
            <button
              type="button"
              className={`lifecycle-exit__btn ${dialogCopy.danger ? "lifecycle-exit__btn--danger" : "lifecycle-exit__btn--primary"}`}
              onClick={() => void handleConfirm()}
              disabled={!password || working}
            >
              {working ? t.working : t.dialogConfirm}
            </button>
          </div>
        </FocusModal>
      ) : null}
    </section>
  );
}
