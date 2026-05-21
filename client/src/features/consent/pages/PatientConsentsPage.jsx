import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getIntlLocaleChain } from "../../../i18n/intlLocale.js";
import { getMessages } from "../../../i18n/translations";
import RevokeConsentDialog from "../components/RevokeConsentDialog.jsx";
import {
  fetchPatientConsents,
  fetchPatientPracticeLinks,
  patchRevokePatientConsent,
  postConsentAiExplanation,
  postPatientConsent,
} from "../api/patientConsentsApi.js";
import "../../../styles/PatientDataControlPage.css";
import PracticeBrandingBar from "../../../components/practice/PracticeBrandingBar.jsx";
import { practiceDisplayLabel } from "../../../utils/groupByPracticeBranding.js";
import "../../../styles/PatientConsentsPage.css";

function fmtDate(iso, uiLanguage) {
  if (!iso) return null;
  try {
    const [primary] = getIntlLocaleChain(uiLanguage);
    return new Date(iso).toLocaleDateString(primary, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

function badgeClass(status) {
  if (status === "granted") return "patient-consents__badge patient-consents__badge--granted";
  if (status === "expired") return "patient-consents__badge patient-consents__badge--expired";
  return "patient-consents__badge patient-consents__badge--revoked";
}

function statusLabel(status, t) {
  if (status === "granted") return t.statusGranted;
  if (status === "expired") return t.statusExpired;
  return t.statusRevoked;
}

function ConsentCard({
  row,
  t,
  locale,
  onRevoke,
  typeLabel,
  purposeText,
}) {
  const [openDetails, setOpenDetails] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  async function handleAiExplain() {
    setAiBusy(true);
    setAiError("");
    try {
      const { res, data } = await postConsentAiExplanation(row.id, locale);
      if (!res.ok) {
        setAiError(t.aiExplainError);
        return;
      }
      const ex = data.explanation || {};
      setAiText([ex.label, ex.disclaimer, ex.text].filter(Boolean).join("\n\n"));
      setOpenDetails(true);
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <li className="patient-consents__card">
      {row.practice ? <PracticeBrandingBar branding={row.practice} compact /> : null}
      <div className="patient-consents__card-header">
        <strong>{typeLabel}</strong>
        <span className={badgeClass(row.status)} role="status">
          {statusLabel(row.status, t)}
        </span>
      </div>
      <dl className="patient-consents__meta">
        <div>
          <dt>{t.practiceLabel}</dt>
          <dd>{practiceDisplayLabel(row.practice) || row.practiceName || t.notProvided}</dd>
        </div>
        <div>
          <dt>{t.purposeLabel}</dt>
          <dd>{purposeText}</dd>
        </div>
        <div>
          <dt>{t.grantedAtLabel}</dt>
          <dd>{fmtDate(row.grantedAt, locale) || t.notProvided}</dd>
        </div>
        {row.revokedAt ? (
          <div>
            <dt>{t.revokedAtLabel}</dt>
            <dd>{fmtDate(row.revokedAt, locale)}</dd>
          </div>
        ) : null}
        <div>
          <dt>{t.expiresAtLabel}</dt>
          <dd>{fmtDate(row.expiresAt, locale) || t.expiresNone}</dd>
        </div>
      </dl>
      {row.status === "expired" ? (
        <p className="patient-consents__hint" role="note">
          {t.expiredNotice}
        </p>
      ) : null}
      <div className="patient-consents__actions">
        <button
          type="button"
          className="patient-threads__btn patient-threads__btn--secondary"
          onClick={() => setOpenDetails((v) => !v)}
          aria-expanded={openDetails}
        >
          {openDetails ? t.detailsHide : t.detailsAction}
        </button>
        {row.status === "granted" ? (
          <button
            type="button"
            className="patient-threads__btn patient-data-control__btn--muted-danger"
            onClick={() => onRevoke(row)}
          >
            {t.revokeAction}
          </button>
        ) : null}
        <button
          type="button"
          className="patient-threads__btn patient-threads__btn--secondary"
          onClick={handleAiExplain}
          disabled={aiBusy}
          aria-busy={aiBusy}
        >
          {aiBusy ? t.aiExplainBusy : t.aiExplain}
        </button>
      </div>
      {openDetails ? (
        <div className="patient-consents__details">
          <p className="patient-data-control__ai-hint" role="note">
            {t.aiHint}
          </p>
          {aiError ? (
            <p className="patient-inbox__error" role="alert">
              {aiError}
            </p>
          ) : null}
          {aiText ? (
            <pre className="patient-consents__hint" style={{ whiteSpace: "pre-wrap" }}>
              {aiText}
            </pre>
          ) : (
            <p className="patient-consents__hint">{purposeText}</p>
          )}
        </div>
      ) : null}
    </li>
  );
}

export default function PatientConsentsPage() {
  const { language } = useLanguage();
  const locale = getIntlLocaleChain(language)[0];
  const t = useMemo(
    () => getMessages(language).patientConsents || getMessages("en").patientConsents,
    [language],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [consents, setConsents] = useState([]);
  const [links, setLinks] = useState([]);
  const [consentTypes, setConsentTypes] = useState([]);

  const [grantLinkId, setGrantLinkId] = useState("");
  const [grantType, setGrantType] = useState("profile_access");
  const [grantExpiry, setGrantExpiry] = useState("");
  const [grantBusy, setGrantBusy] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeStep, setRevokeStep] = useState(1);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [consentRes, linksRes] = await Promise.all([
        fetchPatientConsents(),
        fetchPatientPracticeLinks(),
      ]);
      if (!consentRes.res.ok) {
        setError(t.loadError);
        return;
      }
      setConsents(consentRes.data.consents || []);
      setConsentTypes(consentRes.data.consentTypes || []);
      if (linksRes.res.ok) {
        const active = (linksRes.data.links || []).filter(
          (l) => l.status === "active" || l.status === "invited",
        );
        setLinks(active);
        if (!grantLinkId && active[0]?.id) setGrantLinkId(active[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [t.loadError, grantLinkId]);

  useEffect(() => {
    document.title = t.pageTitle;
    load();
  }, [t.pageTitle, load]);

  const typeLabel = useCallback(
    (type) => t.types?.[type] || type,
    [t],
  );

  const purposeText = useCallback(
    (type) => t.purposes?.[type] || t.notProvided,
    [t],
  );

  const latestByKey = useMemo(() => {
    const map = new Map();
    for (const row of consents) {
      const key = `${row.practicePatientLinkId}:${row.consentType}`;
      const prev = map.get(key);
      if (!prev || new Date(row.createdAt) > new Date(prev.createdAt)) {
        map.set(key, row);
      }
    }
    return [...map.values()];
  }, [consents]);

  const active = latestByKey.filter((r) => r.status === "granted");
  const revoked = latestByKey.filter((r) => r.status === "revoked");
  const expired = latestByKey.filter((r) => r.status === "expired");

  const typesForSelect =
    consentTypes.length > 0
      ? consentTypes
      : [
          "profile_access",
          "document_sharing",
          "medication_plan_access",
          "secure_messaging",
          "data_export",
          "ai_organizational_assistance",
          "optional_email_notifications",
          "optional_secure_links",
        ];

  async function handleGrant(e) {
    e.preventDefault();
    if (!grantLinkId || !grantType) return;
    setGrantBusy(true);
    setStatusMsg("");
    setError("");
    try {
      const body = {
        practicePatientLinkId: grantLinkId,
        consentType: grantType,
      };
      if (grantExpiry) body.expiresAt = grantExpiry;
      const { res } = await postPatientConsent(body);
      if (!res.ok) {
        setError(t.grantError);
        return;
      }
      setStatusMsg(t.grantSuccess);
      setGrantExpiry("");
      await load();
    } finally {
      setGrantBusy(false);
    }
  }

  function openRevoke(row) {
    setRevokeTarget(row);
    setRevokeStep(1);
  }

  function closeRevoke() {
    setRevokeTarget(null);
    setRevokeStep(1);
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevokeBusy(true);
    setStatusMsg("");
    setError("");
    try {
      const { res } = await patchRevokePatientConsent(revokeTarget.id);
      if (!res.ok) {
        setError(t.revokeError);
        return;
      }
      setStatusMsg(t.revokeSuccess);
      closeRevoke();
      await load();
    } finally {
      setRevokeBusy(false);
    }
  }

  function renderSection(title, rows) {
    if (!rows.length) return null;
    return (
      <section aria-labelledby={`section-${title}`}>
        <h2 id={`section-${title}`} className="patient-consents__section-title">
          {title}
        </h2>
        <ul className="patient-consents__list">
          {rows.map((row) => (
            <ConsentCard
              key={row.id}
              row={row}
              t={t}
              locale={locale}
              onRevoke={openRevoke}
              typeLabel={typeLabel(row.consentType)}
              purposeText={purposeText(row.consentType)}
            />
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="patient-inbox">
      <Link className="patient-inbox__back" to="/patient/data-control">
        {t.backDataControl}
      </Link>
      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{t.heading}</h1>
        <p className="patient-inbox__intro">{t.intro}</p>
      </header>

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

      <section className="patient-consents__grant-panel" aria-labelledby="grant-consent-heading">
        <h2 id="grant-consent-heading" className="patient-consents__section-title">
          {t.grantTitle}
        </h2>
        <p className="patient-consents__hint">{t.grantHint}</p>
        <form className="patient-consents__grant-form" onSubmit={handleGrant}>
          <label>
            <span>{t.grantSelectPractice}</span>
            <select
              value={grantLinkId}
              onChange={(e) => setGrantLinkId(e.target.value)}
              required
              aria-required="true"
            >
              <option value="">{t.notProvided}</option>
              {links.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.practice?.practiceName || l.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t.grantSelectType}</span>
            <select
              value={grantType}
              onChange={(e) => setGrantType(e.target.value)}
              required
              aria-required="true"
            >
              {typesForSelect.map((ct) => (
                <option key={ct} value={ct}>
                  {typeLabel(ct)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t.grantExpiryLabel}</span>
            <input
              type="date"
              value={grantExpiry}
              onChange={(e) => setGrantExpiry(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="patient-threads__btn patient-threads__btn--primary"
            disabled={grantBusy || !grantLinkId}
          >
            {t.grantSubmit}
          </button>
        </form>
      </section>

      {!loading && !active.length && !revoked.length && !expired.length ? (
        <p className="patient-inbox__muted">{t.empty}</p>
      ) : null}

      {renderSection(t.sectionActive, active)}
      {renderSection(t.sectionRevoked, revoked)}
      {renderSection(t.sectionExpired, expired)}

      <RevokeConsentDialog
        open={Boolean(revokeTarget)}
        step={revokeStep}
        busy={revokeBusy}
        consentLabel={revokeTarget ? typeLabel(revokeTarget.consentType) : ""}
        t={t}
        onCancel={closeRevoke}
        onConfirmStep1={() => setRevokeStep(2)}
        onConfirmStep2={confirmRevoke}
      />
    </div>
  );
}
