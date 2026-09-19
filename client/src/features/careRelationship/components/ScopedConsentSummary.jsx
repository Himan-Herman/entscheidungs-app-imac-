import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getMessages } from "../../../i18n/translations";
import { fetchPatientConsents } from "../../consent/api/patientConsentsApi.js";

/**
 * "What may THIS practice see?" — the patient's current consents for one
 * relationship, read-only, with the one way to change them.
 *
 * Read from the same consent records the practice is checked against, so the
 * list cannot claim more (or less) than is actually in force. Only the latest
 * record per consent type counts; a revoked or expired one is not listed.
 *
 * `children` (the profile-sharing control) sits inside the same block: it
 * answers the same question — what may this practice see.
 *
 * @param {{ link: { id: string, status: string }, language: string, children?: import("react").ReactNode }} props
 */
export default function ScopedConsentSummary({ link, language, children }) {
  const t = getMessages(language).patientDataControl || getMessages("en").patientDataControl;
  const tc = getMessages(language).patientConsents || getMessages("en").patientConsents;

  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPatientConsents()
      .then(({ res, data }) => {
        if (cancelled) return;
        if (!res.ok) { setError(true); return; }
        setRows(Array.isArray(data.consents) ? data.consents : []);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [link.id]);

  const granted = useMemo(() => {
    if (!rows) return [];
    const latest = new Map();
    for (const row of rows) {
      if (row.practicePatientLinkId !== link.id) continue;
      const prev = latest.get(row.consentType);
      if (!prev || new Date(row.createdAt) > new Date(prev.createdAt)) latest.set(row.consentType, row);
    }
    return [...latest.values()].filter((r) => r.status === "granted");
  }, [rows, link.id]);

  // Not yet consented: the request with its own checkboxes. Otherwise the
  // consent manager, narrowed to this practice.
  const manageTo = link.status === "invited"
    ? `/patient/practice-links?request=${encodeURIComponent(link.id)}`
    : `/patient/consents?linkId=${encodeURIComponent(link.id)}`;
  const canManage = link.status === "invited" || link.status === "active";

  return (
    <section className="dc-section dc-section--consents" aria-labelledby="scoped-consents-title">
      <h2 id="scoped-consents-title" className="dc-section__title">
        {t.consentSummaryTitle}
      </h2>

      {error ? (
        <p className="patient-inbox__error" role="alert">{t.consentSummaryLoadError}</p>
      ) : rows === null ? (
        <p className="dc-empty" role="status">{t.loading}</p>
      ) : granted.length === 0 ? (
        <p className="dc-empty">{t.consentSummaryNone}</p>
      ) : (
        <>
          <p className="dc-section__intro">{t.consentSummaryIntro}</p>
          <ul className="dc-consents">
            {granted.map((r) => (
              <li key={r.id}>
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                  <path d="M3.5 8.4l3 3 6-6.4" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {tc.types?.[r.consentType] || r.consentType}
              </li>
            ))}
          </ul>
        </>
      )}

      {canManage ? (
        <Link className="patient-threads__btn patient-threads__btn--secondary dc-consents__manage" to={manageTo}>
          {granted.length === 0 && link.status === "invited" ? t.consentSummarySet : t.consentSummaryManage}
        </Link>
      ) : null}

      {children}
    </section>
  );
}
