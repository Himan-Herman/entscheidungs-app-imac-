import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import { fetchPracticePatientConsents } from "../api/practicePatientsApi.js";
import RequestStatus from "./RequestStatus.jsx";
import {
  fetchPracticeDataRequests,
  patchPracticeDataRequestStatus,
} from "../api/patientDataControlApi.js";

function fmt(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(getPrimaryIntlLocale(lang), { dateStyle: "medium" });
  } catch {
    return "—";
  }
}

const OPEN = new Set(["submitted", "in_review"]);

/**
 * "Daten & Freigaben" — the practice's side of one patient relationship.
 *
 * TWO THINGS, EACH IN ONE DIRECTION:
 *   Freigaben    — what the PATIENT has granted this practice. Read-only here:
 *                  only the patient grants or withdraws; the practice sees the
 *                  state it is checked against, nothing more.
 *   Datenanfragen — what the patient asked of this practice (export, deletion,
 *                  restriction), and the practice's answer. The answer and the
 *                  status go to the patient: into their inbox, their activity
 *                  log and their "Meine Daten & Freigaben" for this practice.
 *
 * The status options respect the server's honesty rule: a deletion request
 * cannot be reported "completed" until a real erasure exists, so the option is
 * not offered rather than offered and refused.
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
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({}); // requestId -> { status, note }
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState(null); // { id, kind, text }
  const [forbidden, setForbidden] = useState(false);

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
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.dataConsentLoadError);
    }
  }, [linkId, practiceId, t.dataConsentLoadError]);

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

  const statusLabel = (status) => ({
    submitted: tReq.statusSubmitted,
    in_review: tReq.statusInReview,
    completed: tReq.statusCompleted,
    rejected: tReq.statusRejected,
  }[status] || status);

  const optionsFor = (req) =>
    req.type === "deletion" ? ["in_review", "rejected"] : ["in_review", "completed", "rejected"];

  function draftOf(req) {
    return drafts[req.id] || { status: OPEN.has(req.status) ? optionsFor(req)[0] : req.status, note: "" };
  }

  function setDraft(req, patch) {
    setDrafts((d) => ({ ...d, [req.id]: { ...draftOf(req), ...patch } }));
  }

  async function save(req) {
    const draft = draftOf(req);
    setBusyId(req.id);
    setNotice(null);
    try {
      const { res, data } = await patchPracticeDataRequestStatus(practiceId, req.id, {
        status: draft.status,
        responseNote: draft.note.trim() || undefined,
      });
      if (res.status === 403) {
        setForbidden(true);
        setNotice({ id: req.id, kind: "error", text: t.dataConsentForbidden });
        return;
      }
      if (data?.error === "deletion_requires_manual_erasure") {
        setNotice({ id: req.id, kind: "error", text: t.dataConsentDeletionManual });
        return;
      }
      if (!res.ok || !data.ok) {
        setNotice({ id: req.id, kind: "error", text: t.dataConsentSaveError });
        return;
      }
      setDrafts((d) => { const next = { ...d }; delete next[req.id]; return next; });
      setNotice({ id: req.id, kind: "ok", text: t.dataConsentSaved });
      await load();
    } finally {
      setBusyId("");
    }
  }

  const canEdit = !readOnly && !forbidden;

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
            {requests.map((req) => {
              const draft = draftOf(req);
              const open = OPEN.has(req.status);
              const busy = busyId === req.id;
              return (
                <li key={req.id} className="practice-dataconsent__request">
                  <div className="practice-dataconsent__request-head">
                    <h3 className="practice-dataconsent__request-title">{typeLabel(req.type)}</h3>
                    <RequestStatus status={req.status} label={statusLabel(req.status)} />
                  </div>
                  <p className="practice-dataconsent__date">
                    {t.dataConsentReceivedOn.replace("{date}", fmt(req.createdAt, language))}
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

                  {canEdit && open ? (
                    <div className="practice-dataconsent__form">
                      <div className="practice-dataconsent__field">
                        <label htmlFor={`dc-status-${req.id}`}>{t.dataConsentStatusLabel}</label>
                        <select
                          id={`dc-status-${req.id}`}
                          value={draft.status}
                          onChange={(e) => setDraft(req, { status: e.target.value })}
                          disabled={busy}
                          aria-describedby={req.type === "deletion" ? `dc-del-${req.id}` : undefined}
                        >
                          {optionsFor(req).map((st) => (
                            <option key={st} value={st}>{statusLabel(st)}</option>
                          ))}
                        </select>
                        {req.type === "deletion" ? (
                          <p className="practice-dataconsent__hint" id={`dc-del-${req.id}`}>
                            {t.dataConsentDeletionManual}
                          </p>
                        ) : null}
                      </div>
                      <div className="practice-dataconsent__field">
                        <label htmlFor={`dc-note-${req.id}`}>{t.dataConsentResponseLabel}</label>
                        <textarea
                          id={`dc-note-${req.id}`}
                          rows={4}
                          maxLength={2000}
                          value={draft.note}
                          onChange={(e) => setDraft(req, { note: e.target.value })}
                          disabled={busy}
                          aria-describedby={`dc-note-hint-${req.id}`}
                        />
                        <p className="practice-dataconsent__hint" id={`dc-note-hint-${req.id}`}>
                          {t.dataConsentResponseHint}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="practice-dataconsent__save"
                        onClick={() => save(req)}
                        disabled={busy}
                        aria-busy={busy || undefined}
                      >
                        {busy ? t.dataConsentSaving : t.dataConsentSave}
                      </button>
                    </div>
                  ) : null}

                  {notice?.id === req.id ? (
                    <p
                      className={`practice-dataconsent__notice practice-dataconsent__notice--${notice.kind}`}
                      role={notice.kind === "ok" ? "status" : "alert"}
                    >
                      {notice.text}
                    </p>
                  ) : null}
                </li>
              );
            })}
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
