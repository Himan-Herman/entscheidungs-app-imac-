import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { formatUiDateTime } from "../../../i18n/intlLocale.js";
import {
  fetchPatientPracticeLinks,
  patchPatientProfileAccess,
  createPatientConnectCode,
  fetchPatientConnectCode,
  revokePatientConnectCode,
} from "../api/patientPracticeLinksApi.js";
import PracticeBrandingBar from "../../../components/practice/PracticeBrandingBar.jsx";
import { practiceDisplayLabel } from "../../../utils/groupByPracticeBranding.js";
import "../../../styles/PatientInboxPage.css";

function statusLabel(status, t) {
  const map = {
    active: t.statusActive,
    invited: t.statusInvited,
    revoked: t.statusRevoked,
    archived: t.statusArchived,
  };
  return map[status] || status;
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

/** Conservative default — deliberately NOT a full release (patient stays in control). */
const DEFAULT_CONNECT_SCOPES = ["profile", "messages"];

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
      const { res, data } = await fetchPatientPracticeLinks({ status: "active" });
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

  return (
    <div className="patient-inbox">
      <Link className="patient-inbox__back" to="/patient">
        {t.backHub}
      </Link>
      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{t.heading}</h1>
        <p className="patient-inbox__intro">{t.intro}</p>
      </header>

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
          disabled={ccBusy}
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

      {!loading && !error && links.length === 0 ? (
        <p className="patient-inbox__muted">{t.empty}</p>
      ) : null}

      {!loading && !error && links.length > 0 ? (
        <ul className="patient-inbox__list" aria-label={t.listCaption}>
          {links.map((link) => {
            const practiceName = practiceDisplayLabel(link.practice) || "—";
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
