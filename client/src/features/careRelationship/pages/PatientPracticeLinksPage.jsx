import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { formatUiDateTime } from "../../../i18n/intlLocale.js";
import {
  fetchPatientPracticeLinks,
  patchPatientProfileAccess,
  createPatientConnectCode,
  fetchPatientConnectCode,
  revokePatientConnectCode,
  acceptPatientLinkRequest,
  declinePatientLinkRequest,
} from "../api/patientPracticeLinksApi.js";
import PracticeBrandingBar from "../../../components/practice/PracticeBrandingBar.jsx";
import { practiceDisplayLabel } from "../../../utils/groupByPracticeBranding.js";
import "../../../styles/PatientInboxPage.css";
// The patient-threads__btn buttons live here. Every other page that uses them
// imports it; this one did not, so its buttons were only styled if the
// messages page happened to have been opened first in the same session.
import "../../../styles/PatientThreadsPage.css";

function statusLabel(status, t) {
  const map = {
    active: t.statusActive,
    invited: t.statusInvited,
    revoked: t.statusRevoked,
    archived: t.statusArchived,
  };
  return map[status] || t.notProvided;
}

/**
 * Consent scopes a patient can put on a connection code. The `typeKey` reuses the
 * existing consent-type labels (patientConsents.types) so wording stays consistent and
 * already exists in all five languages. Order is intentional (most common first).
 */
const CONNECT_SCOPE_OPTIONS = [
  { scope: "profile", typeKey: "profile_access" },
  { scope: "messages", typeKey: "secure_messaging" },
  { scope: "medication", typeKey: "medication_plan_access" },
  { scope: "documents", typeKey: "document_sharing" },
  { scope: "vitals", typeKey: "vitals_access" },
  { scope: "vaccinations", typeKey: "vaccinations_access" },
  { scope: "health_history", typeKey: "health_history_access" },
  { scope: "prescriptions", typeKey: "prescriptions_access" },
];

/**
 * NOTHING is pre-selected.
 *
 * A pre-ticked box is an answer the patient never gave. Even a conservative
 * default would mean the common path — accept without reading — releases areas
 * nobody actively chose. So the list starts empty and both submit buttons stay
 * disabled until the patient ticks something. There is deliberately no
 * "select all" and no silent fallback at submit time: the scopes that reach the
 * server are exactly the ones that were ticked on screen.
 */
const DEFAULT_CONNECT_SCOPES = [];

export default function PatientPracticeLinksPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).patientPracticeLinks ||
      getMessages("en").patientPracticeLinks,
    [language],
  );
  const tConsents = useMemo(
    () => getMessages(language).patientConsents || getMessages("en").patientConsents,
    [language],
  );
  const tc = t.connectCode || {};

  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [busyId, setBusyId] = useState("");

  // --- Incoming practice requests (Fall A) ---
  // Each request has ITS OWN selection. It used to borrow the connect-code
  // checkboxes further down the page, so "accept" stayed disabled until the
  // patient ticked boxes in an unrelated section they had no reason to find.
  // Nothing is pre-selected here either, for the reason given above.
  const [requestScopes, setRequestScopes] = useState({}); // linkId -> string[]
  const [requestFeedback, setRequestFeedback] = useState(null); // { linkId, kind, text }
  const location = useLocation();
  const focusRequestId = useMemo(
    () => new URLSearchParams(location.search).get("request") || "",
    [location.search],
  );
  const focusedRef = useRef(null);

  // --- Patient-generated connection code (Phase 2) ---
  const [scopes, setScopes] = useState(DEFAULT_CONNECT_SCOPES);
  const [activeCode, setActiveCode] = useState(null); // metadata only (no plaintext)
  const [plaintextCode, setPlaintextCode] = useState(""); // shown once, after create
  const [ttlMinutes, setTtlMinutes] = useState(null);
  const [ccBusy, setCcBusy] = useState(false);
  const [ccError, setCcError] = useState("");
  const [ccStatus, setCcStatus] = useState("");
  const [copied, setCopied] = useState(false);

  const scopeLabel = useCallback(
    (option) => tConsents.types?.[option.typeKey] || option.scope,
    [tConsents],
  );

  const loadActiveCode = useCallback(async () => {
    try {
      const { res, data } = await fetchPatientConnectCode();
      if (!res.ok || !data.ok) return;
      setActiveCode(data.code || null);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      /* non-blocking — the rest of the page still works */
    }
  }, []);

  function toggleScope(scope) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function handleGenerateCode() {
    setCcError("");
    setCcStatus("");
    setCopied(false);
    if (scopes.length === 0) {
      setCcError(tc.noScopeError);
      return;
    }
    setCcBusy(true);
    try {
      const { res, data } = await createPatientConnectCode(scopes);
      if (!res.ok || !data.ok || !data.code) {
        setCcError(tc.createError);
        return;
      }
      setPlaintextCode(data.code);
      setTtlMinutes(data.ttlMinutes ?? null);
      setActiveCode({
        id: data.id,
        status: data.status,
        tokenPrefix: data.tokenPrefix,
        consentScopes: data.consentScopes,
        expiresAt: data.expiresAt,
        createdAt: data.createdAt,
        usedAt: data.usedAt ?? null,
      });
      setCcStatus(tc.created);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setCcError(tc.createError);
    } finally {
      setCcBusy(false);
    }
  }

  async function handleRevokeCode() {
    if (!activeCode?.id) return;
    setCcError("");
    setCcStatus("");
    setCcBusy(true);
    try {
      const { res, data } = await revokePatientConnectCode(activeCode.id);
      if (!res.ok || !data.ok) {
        setCcError(tc.revokeError);
        return;
      }
      setActiveCode(null);
      setPlaintextCode("");
      setTtlMinutes(null);
      setCopied(false);
      setCcStatus(tc.revoked);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setCcError(tc.revokeError);
    } finally {
      setCcBusy(false);
    }
  }

  async function handleCopyCode() {
    if (!plaintextCode) return;
    try {
      await navigator.clipboard.writeText(plaintextCode);
      setCopied(true);
    } catch {
      /* clipboard unavailable — the code stays visible for manual copy */
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // No status filter: the server honours one, and asking for "active" alone
      // hid every freshly claimed link — those arrive as "invited" and are
      // exactly what the incoming-requests section below is for. The narrowing
      // happens client-side, where both sections need their own slice.
      const { res, data } = await fetchPatientPracticeLinks();
      if (res.status === 404 && data.error === "feature_disabled") {
        setLinks([]);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      const all = Array.isArray(data.links) ? data.links : [];
      setLinks(all.filter((l) => l.status === "active" || l.status === "invited"));
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setLinks([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.featureDisabled, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadActiveCode();
  }, [loadActiveCode]);

  async function toggleProfile(link, grant) {
    setBusyId(link.id);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await patchPatientProfileAccess(link.id, grant);
      if (!res.ok || !data.ok) {
        setError(t.saveError);
        return;
      }
      setStatusMsg(grant ? t.savedGranted : t.savedRevoked);
      setLinks((prev) =>
        prev.map((l) => (l.id === link.id ? { ...l, ...data.link } : l)),
      );
    } finally {
      setBusyId("");
    }
  }

  // Fall A — incoming practice-initiated link requests (status "invited").
  function toggleRequestScope(linkId, scope) {
    setRequestScopes((prev) => {
      const current = prev[linkId] || [];
      return {
        ...prev,
        [linkId]: current.includes(scope)
          ? current.filter((s) => s !== scope)
          : [...current, scope],
      };
    });
  }

  async function handleAcceptRequest(link) {
    setError("");
    setStatusMsg("");
    setRequestFeedback(null);
    // Exactly what was ticked on THIS card reaches the server — no default, no
    // fallback. The button is disabled with nothing ticked; this is the guard
    // behind it.
    const chosen = requestScopes[link.id] || [];
    if (chosen.length === 0) {
      setRequestFeedback({ linkId: link.id, kind: "error", text: tc.noScopeError });
      return;
    }
    setBusyId(link.id);
    try {
      const { res, data } = await acceptPatientLinkRequest(link.id, chosen);
      if (!res.ok || !data.ok) {
        setRequestFeedback({ linkId: link.id, kind: "error", text: t.acceptError });
        return;
      }
      setRequestFeedback({ linkId: link.id, kind: "ok", text: t.acceptedMsg });
      setRequestScopes((prev) => {
        const next = { ...prev };
        delete next[link.id];
        return next;
      });
      await load();
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setRequestFeedback({ linkId: link.id, kind: "error", text: t.acceptError });
    } finally {
      setBusyId("");
    }
  }

  async function handleDeclineRequest(link) {
    setError("");
    setStatusMsg("");
    setBusyId(link.id);
    try {
      const { res, data } = await declinePatientLinkRequest(link.id);
      if (!res.ok || !data.ok) {
        setError(t.declineError);
        return;
      }
      setStatusMsg(t.declinedMsg);
      await load();
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.declineError);
    } finally {
      setBusyId("");
    }
  }

  const incomingRequests = links.filter((l) => l.status === "invited");
  const activeLinks = links.filter((l) => l.status === "active");

  // Arriving from "Choose permissions" for one practice: bring that request
  // into view and put focus on it, instead of leaving the patient to scroll.
  useEffect(() => {
    if (!focusRequestId || loading) return;
    const el = focusedRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    el.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
  }, [focusRequestId, loading, incomingRequests.length]);

  return (
    <div className="patient-inbox">
      <Link className="patient-inbox__back" to="/patient">
        {t.backHub}
      </Link>
      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{t.heading}</h1>
        <p className="patient-inbox__intro">{t.intro}</p>
      </header>

      {incomingRequests.length > 0 ? (
        <section
          className="patient-inbox__item"
          style={{ padding: "1rem", marginBottom: "1.5rem", borderColor: "rgba(15,118,110,0.45)" }}
          aria-labelledby="link-requests-heading"
        >
          <h2 id="link-requests-heading" className="patient-inbox__item-title" style={{ fontSize: "1.1rem" }}>
            {t.requestsHeading}
          </h2>
          <p className="patient-inbox__muted">{t.requestsIntro}</p>
          <ul className="consent-request__list">
            {incomingRequests.map((link) => {
              const practiceName = practiceDisplayLabel(link.practice) || t.notProvided;
              const chosen = requestScopes[link.id] || [];
              const busy = busyId === link.id;
              const isFocused = link.id === focusRequestId;
              const headingId = `consent-request-${link.id}`;
              return (
                <li key={link.id} className={`consent-request${isFocused ? " consent-request--focused" : ""}`}>
                  <PracticeBrandingBar branding={link.practice} compact />
                  <h3
                    id={headingId}
                    className="consent-request__title"
                    tabIndex={-1}
                    ref={isFocused ? focusedRef : undefined}
                  >
                    {t.requestFrom.replace("{practice}", practiceName)}
                  </h3>
                  <fieldset className="consent-request__scopes" aria-describedby={`${headingId}-hint`}>
                    <legend className="consent-request__legend">
                      {t.requestScopesLegend.replace("{practice}", practiceName)}
                    </legend>
                    <p className="consent-request__hint" id={`${headingId}-hint`}>{t.acceptScopesHint}</p>
                    <ul className="consent-request__options">
                      {CONNECT_SCOPE_OPTIONS.map((option) => {
                        const inputId = `${headingId}-${option.scope}`;
                        const purpose = tConsents.purposes?.[option.typeKey];
                        return (
                          <li key={option.scope}>
                            <label className="consent-request__option" htmlFor={inputId}>
                              <input
                                id={inputId}
                                type="checkbox"
                                checked={chosen.includes(option.scope)}
                                onChange={() => toggleRequestScope(link.id, option.scope)}
                                disabled={busy}
                              />
                              <span className="consent-request__option-text">
                                <span className="consent-request__option-name">{scopeLabel(option)}</span>
                                {purpose ? (
                                  <span className="consent-request__option-purpose">{purpose}</span>
                                ) : null}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </fieldset>

                  {requestFeedback?.linkId === link.id ? (
                    <p
                      className={requestFeedback.kind === "error" ? "patient-inbox__error" : "patient-inbox__muted"}
                      role={requestFeedback.kind === "error" ? "alert" : "status"}
                    >
                      {requestFeedback.text}
                    </p>
                  ) : null}

                  <div className="consent-request__actions">
                    <button
                      type="button"
                      className="patient-threads__btn patient-threads__btn--primary"
                      disabled={busy || chosen.length === 0}
                      aria-busy={busy}
                      onClick={() => void handleAcceptRequest(link)}
                    >
                      {t.acceptButton}
                    </button>
                    <button
                      type="button"
                      className="patient-threads__btn patient-threads__btn--secondary"
                      disabled={busy}
                      onClick={() => void handleDeclineRequest(link)}
                    >
                      {t.declineButton}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Accepted a moment ago: the request has moved down into the active
          list, so the confirmation stays up here where the patient's eyes are. */}
      {requestFeedback?.kind === "ok" && !incomingRequests.some((l) => l.id === requestFeedback.linkId) ? (
        <p className="consent-request__done" role="status">
          {requestFeedback.text}{" "}
          <Link to={`/patient/practice/${encodeURIComponent(requestFeedback.linkId)}`}>
            {t.openPractice}
          </Link>
        </p>
      ) : null}

      <section
        className="patient-inbox__item"
        style={{ padding: "1rem", marginBottom: "1.5rem" }}
        aria-labelledby="connect-code-heading"
      >
        <h2 id="connect-code-heading" className="patient-inbox__item-title" style={{ fontSize: "1.1rem" }}>
          {tc.sectionTitle}
        </h2>
        <p className="patient-inbox__muted">{tc.sectionIntro}</p>

        <fieldset style={{ border: "none", margin: "0.75rem 0 0", padding: 0 }}>
          <legend className="patient-inbox__item-title" style={{ fontSize: "1rem" }}>
            {tc.scopesLegend}
          </legend>
          <p className="patient-inbox__muted">{tc.scopesHint}</p>
          <ul className="patient-inbox__list" style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0" }}>
            {CONNECT_SCOPE_OPTIONS.map((option) => (
              <li key={option.scope} style={{ padding: "0.25rem 0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="checkbox"
                    checked={scopes.includes(option.scope)}
                    onChange={() => toggleScope(option.scope)}
                    disabled={ccBusy}
                  />
                  <span>{scopeLabel(option)}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <button
          type="button"
          className="patient-threads__btn patient-threads__btn--primary"
          style={{ marginTop: "0.75rem" }}
          onClick={() => void handleGenerateCode()}
          disabled={ccBusy || scopes.length === 0}
          aria-busy={ccBusy}
        >
          {activeCode ? tc.regenerateButton : tc.generateButton}
        </button>

        {ccError ? (
          <p className="patient-inbox__error" role="alert" style={{ marginTop: "0.75rem" }}>
            {ccError}
          </p>
        ) : null}
        {ccStatus ? (
          <p className="patient-inbox__muted" role="status" aria-live="polite" style={{ marginTop: "0.75rem" }}>
            {ccStatus}
          </p>
        ) : null}

        {plaintextCode ? (
          <div
            className="patient-inbox__item"
            style={{ padding: "0.75rem", marginTop: "0.75rem" }}
            role="group"
            aria-label={tc.activeCodeLabel}
          >
            <p className="patient-inbox__muted">{tc.plaintextNotice}</p>
            <p
              className="patient-inbox__item-title"
              style={{ fontFamily: "monospace", fontSize: "1.4rem", letterSpacing: "0.15em", margin: "0.5rem 0" }}
            >
              {plaintextCode}
            </p>
            <button
              type="button"
              className="patient-threads__btn patient-threads__btn--secondary"
              onClick={() => void handleCopyCode()}
            >
              {copied ? tc.copied : tc.copyButton}
            </button>
            {ttlMinutes != null ? (
              <p className="patient-inbox__item-meta">
                {tc.expiresIn.replace("{minutes}", String(ttlMinutes))}
              </p>
            ) : null}
          </div>
        ) : null}

        {activeCode ? (
          <div className="patient-inbox__item" style={{ padding: "0.75rem", marginTop: "0.75rem" }}>
            <p className="patient-inbox__item-meta">
              {tc.codeReferenceLabel}: <span style={{ fontFamily: "monospace" }}>{activeCode.tokenPrefix}…</span>
            </p>
            {activeCode.expiresAt ? (
              <p className="patient-inbox__item-meta">
                {tc.expiresAt.replace("{datetime}", formatUiDateTime(activeCode.expiresAt, language))}
              </p>
            ) : null}
            <button
              type="button"
              className="patient-threads__btn patient-threads__btn--secondary"
              style={{ marginTop: "0.5rem" }}
              onClick={() => void handleRevokeCode()}
              disabled={ccBusy}
            >
              {tc.revokeButton}
            </button>
          </div>
        ) : (
          <p className="patient-inbox__muted" style={{ marginTop: "0.5rem" }}>
            {tc.noActiveCode}
          </p>
        )}

        <p className="patient-inbox__safety" style={{ marginTop: "0.75rem" }} role="note">
          {tc.shareHint}
        </p>
      </section>

      {loading ? <p className="patient-inbox__muted">{t.loading}</p> : null}
      {error ? (
        <p className="patient-inbox__error" role="alert">
          {error}
        </p>
      ) : null}
      {statusMsg ? (
        <p className="patient-inbox__muted" role="status">
          {statusMsg}
        </p>
      ) : null}

      {!loading && !error && activeLinks.length === 0 ? (
        <p className="patient-inbox__muted">{t.empty}</p>
      ) : null}

      {!loading && !error && activeLinks.length > 0 ? (
        <ul className="patient-inbox__list" aria-label={t.listCaption}>
          {activeLinks.map((link) => {
            const practiceName = practiceDisplayLabel(link.practice) || t.notProvided;
            const granted = Boolean(link.profileAccessGranted);
            const st = statusLabel(link.status, t);

            return (
              <li key={link.id} className="patient-inbox__item" style={{ padding: "1rem" }}>
                <PracticeBrandingBar branding={link.practice} compact />
                <p className="patient-inbox__item-title">{practiceName}</p>
                <p className="patient-inbox__item-meta">{st}</p>
                <fieldset style={{ border: "none", margin: "0.75rem 0 0", padding: 0 }}>
                  <legend className="patient-inbox__item-title" style={{ fontSize: "1rem" }}>
                    {t.shareProfileTitle}
                  </legend>
                  <p className="patient-inbox__muted">{t.shareProfileHint}</p>
                  <p className="patient-inbox__item-meta" role="status">
                    {granted ? t.profileAccessOn : t.profileAccessOff}
                  </p>
                  <button
                    type="button"
                    className="patient-threads__btn patient-threads__btn--secondary"
                    style={{ marginTop: "0.5rem" }}
                    disabled={busyId === link.id}
                    aria-pressed={granted}
                    onClick={() => toggleProfile(link, !granted)}
                  >
                    {granted ? t.disableProfile : t.enableProfile}
                  </button>
                </fieldset>
                {link.status === "active" && link.practice?.id ? (
                  <Link
                    to={`/patient/appointments?practiceId=${encodeURIComponent(link.practice.id)}`}
                    className="patient-threads__btn patient-threads__btn--primary"
                    style={{ display: "inline-block", marginTop: "0.5rem", textDecoration: "none" }}
                  >
                    {t.requestAppointment}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
