import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import { fetchPracticePatientConsents } from "../api/practicePatientsApi.js";
import { fetchPracticeDataRequests } from "../api/patientDataControlApi.js";
import RequestStatus from "./RequestStatus.jsx";
import PracticeDataRequestActions from "./PracticeDataRequestActions.jsx";
import { statusLabel as dataRequestStatusLabel } from "../lib/dataRequestStatus.js";

function fmt(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(getPrimaryIntlLocale(lang), { dateStyle: "medium" });
  } catch {
    return "—";
  }
}

/**
 * "Daten & Freigaben" — the practice's side of one patient relationship.
 *
 * TWO THINGS, EACH IN ONE DIRECTION:
 *   Freigaben     — what the PATIENT has granted this practice. Read-only here:
 *                   only the patient grants or withdraws.
 *   Datenanfragen — what the patient asked of this practice, and the
 *                   practice's answer, which goes back to the patient.
 *
 * A request ends as "Beantwortet": the practice has replied, nothing more.
 * Who may triage and who may answer comes from the server (`capabilities`).
 *
 * @param {{ linkId: string, practiceId: string, readOnly: boolean }} props
 */
export default function PracticePatientDataConsentTab({ linkId, practiceId, readOnly }) {
  const { language } = useLanguage();
  const t = getMessages(language).practicePatients || getMessages("en").practicePatients;
  const tReq = getMessages(language).practiceDataRequests || getMessages("en").practiceDataRequests;
  const tCons = getMessages(language).practiceConsents || getMessages("en").practiceConsents;

  const [consents, setConsents] = useState(null);
  const [requests, setRequests] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [c, r] = await Promise.all([
        fetchPracticePatientConsents(linkId, practiceId),
        fetchPracticeDataRequests(practiceId, { linkId }),
      ]);
      if (!c.res.ok || !c.data.ok || !r.res.ok || !r.data.ok) throw new Error("load_failed");
      setConsents(Array.isArray(c.data.consents) ? c.data.consents : []);
      setRequests(Array.isArray(r.data.requests) ? r.data.requests : []);
      setCapabilities(readOnly ? null : r.data.capabilities || null);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.dataConsentLoadError);
    }
  }, [linkId, practiceId, readOnly, t.dataConsentLoadError]);

  useEffect(() => { load(); }, [load]);

  const granted = useMemo(
    () => (consents || []).filter((c) => c.status === "granted"),
    [consents],
  );

  const typeLabel = (type) => ({
    deletion: tReq.typeDeletion,
    access_restriction: tReq.typeAccessRestriction,
    export: tReq.typeExport,
  }[type] || type);

  return (
    <div className="practice-dataconsent">
      {error ? <p className="practice-dashboard__error" role="alert">{error}</p> : null}

      {/* READ-ONLY: what the patient granted. Deliberately not a card with
          controls — nothing here can be changed by the practice. */}
      <section className="practice-dataconsent__readonly" aria-labelledby="dataconsent-consents">
        <div className="practice-dataconsent__head">
          <h2 id="dataconsent-consents" className="practice-dataconsent__title">
            {t.dataConsentConsentsTitle}
          </h2>
          <span className="practice-dataconsent__readonly-tag">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
              <path d="M5 7V5.2a3 3 0 0 1 6 0V7M4.2 7h7.6v6.3H4.2z" fill="none" stroke="currentColor"
                strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
            {t.dataConsentReadOnly}
          </span>
        </div>
        <p className="practice-dataconsent__intro">{t.dataConsentConsentsIntro}</p>
        {consents === null && !error ? (
          <p className="practice-dataconsent__intro" role="status">{t.loading}</p>
        ) : null}
        {consents !== null && granted.length === 0 ? (
          <p className="practice-dataconsent__empty">{t.dataConsentConsentsNone}</p>
        ) : null}
        {granted.length > 0 ? (
          <ul className="practice-dataconsent__consents">
            {granted.map((c) => (
              <li key={c.consentType}>
                <span className="practice-dataconsent__consent-name">
                  {tCons.types?.[c.consentType] || c.consentType}
                </span>
                <span className="practice-dataconsent__consent-meta">
                  {t.dataConsentGrantedSince.replace("{date}", fmt(c.grantedAt, language))}
                  {c.expiresAt ? ` · ${t.dataConsentExpires.replace("{date}", fmt(c.expiresAt, language))}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* WORK AREA: the patient's data requests, answered here. */}
      <section className="practice-dataconsent__work" aria-labelledby="dataconsent-requests">
        <h2 id="dataconsent-requests" className="practice-dataconsent__title">
          {t.dataConsentRequestsTitle}
        </h2>
        <p className="practice-dataconsent__intro">{t.dataConsentRequestsIntro}</p>
        {readOnly ? <p className="practice-record__viewer-note">{tReq.viewerReadOnly}</p> : null}

        {requests !== null && requests.length === 0 ? (
          <p className="practice-dataconsent__empty">{t.dataConsentRequestsNone}</p>
        ) : null}

        {requests && requests.length > 0 ? (
          <ul className="practice-dataconsent__requests">
            {requests.map((req) => (
              <li key={req.id} className="practice-dataconsent__request">
                <div className="practice-dataconsent__request-head">
                  <h3 className="practice-dataconsent__request-title">{typeLabel(req.type)}</h3>
                  <RequestStatus status={req.status} label={dataRequestStatusLabel(req.status, tReq)} />
                </div>
                <p className="practice-dataconsent__date">
                  {t.dataConsentReceivedOn.replace("{date}", fmt(req.createdAt, language))}
                  {req.completedAt
                    ? ` · ${t.dataConsentAnsweredOn.replace("{date}", fmt(req.completedAt, language))}`
                    : ""}
                </p>

                {req.reason ? (
                  <div className="practice-dataconsent__text">
                    <p className="practice-dataconsent__label">{t.dataConsentPatientReason}</p>
                    <p className="practice-dataconsent__body">{req.reason}</p>
                  </div>
                ) : null}

                {req.responseNote ? (
                  <figure className="practice-dataconsent__answer">
                    <figcaption className="practice-dataconsent__label">
                      {t.dataConsentResponseSent}
                      <span className="practice-dataconsent__visible"> · {t.dataConsentVisibleToPatient}</span>
                    </figcaption>
                    <blockquote className="practice-dataconsent__body">{req.responseNote}</blockquote>
                  </figure>
                ) : null}

                <PracticeDataRequestActions
                  practiceId={practiceId}
                  request={req}
                  capabilities={capabilities}
                  onSaved={load}
                  t={t}
                  idPrefix="dc"
                />
              </li>
            ))}
          </ul>
        ) : null}

        <p className="practice-dataconsent__all">
          <Link to={`/practice/data-requests?practiceId=${encodeURIComponent(practiceId)}`}>
            {t.dataConsentOpenAll}
          </Link>
        </p>
      </section>
    </div>
  );
}
