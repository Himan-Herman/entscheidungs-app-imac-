import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import DataDeletionRequestDialog from "../components/DataDeletionRequestDialog.jsx";
import RevokeProfileSharingDialog from "../components/RevokeProfileSharingDialog.jsx";
import ArchiveRelationshipDialog from "../components/ArchiveRelationshipDialog.jsx";
import ExportRequestDialog from "../components/ExportRequestDialog.jsx";
import PatientPracticeDoctorSelect from "../components/PatientPracticeDoctorSelect.jsx";
import ScopedConsentSummary from "../components/ScopedConsentSummary.jsx";
import RequestStatus from "../components/RequestStatus.jsx";
import { statusLabel as dataRequestStatusLabel, TERMINAL_STATUSES } from "../lib/dataRequestStatus.js";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';
import {
  fetchPatientDataControl,
  patchPatientLinkArchive,
  patchPatientProfileAccess,
  postPatientDataRequest,
  postPatientDataRequestAiDraft,
  postPatientDataRequestAiSummary,
} from "../api/patientDataControlApi.js";
import "../../../styles/PatientInboxPage.css";
import "../../../styles/PatientThreadsPage.css";
import "../../../styles/PatientDataControlPage.css";

function statusLabel(status, t) {
  const map = {
    active: t.statusActive,
    invited: t.statusInvited,
    revoked: t.statusRevoked,
    archived: t.statusArchived,
  };
  return map[status] || t.notProvided;
}

function requestTypeLabel(type, t) {
  const map = {
    deletion: t.typeDeletion,
    access_restriction: t.typeAccessRestriction,
    export: t.typeExport,
  };
  return map[type] || t.notProvided;
}

function requestStatusLabel(status, t) {
  return dataRequestStatusLabel(status, t);
}

function fmtActivity(iso, lang, fallback) {
  if (!iso) return fallback;
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return fallback;
  }
}

function fmtDate(iso, lang, fallback) {
  if (!iso) return fallback;
  try {
    return new Date(iso).toLocaleDateString(getPrimaryIntlLocale(lang), { dateStyle: "medium" });
  } catch {
    return fallback;
  }
}

function indicatorLabel(has, t) {
  return has ? t.indicatorYes : t.indicatorNo;
}

function hasOpenType(link, type) {
  const open = link.openDataRequests || [];
  return open.some((r) => r.type === type);
}

/**
 * "Meine Daten & Freigaben".
 *
 * Two homes, one page: across all practices at /patient/data-control, and for
 * ONE practice inside its own area (/patient/practice/:linkId/data-control,
 * `scopedLinkId` set). Scoped, the server itself returns only that
 * relationship and its requests, and every link on the page stays inside the
 * practice's area instead of jumping to the cross-practice lists.
 *
 * @param {{ scopedLinkId?: string }} props
 */
export default function PatientDataControlPage({ scopedLinkId = "" } = {}) {
  const { language } = useLanguage();
  const scoped = Boolean(scopedLinkId);
  const scopedBase = scoped ? `/patient/practice/${encodeURIComponent(scopedLinkId)}` : "";
  const tContext = getMessages(language).practiceContext || getMessages("en").practiceContext;
  const [searchParams] = useSearchParams();
  const focusLinkId = searchParams.get("linkId")?.trim() || "";
  const t = useMemo(
    () =>
      getMessages(language).patientDataControl ||
      getMessages("en").patientDataControl,
    [language],
  );

  const [practices, setPractices] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [busyId, setBusyId] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeStep, setRevokeStep] = useState(1);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiveStep, setArchiveStep] = useState(1);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const [exportTarget, setExportTarget] = useState(null);
  const [exportStep, setExportStep] = useState(1);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportReason, setExportReason] = useState("");
  const [exportAiBusy, setExportAiBusy] = useState(false);

  const [aiSummaryId, setAiSummaryId] = useState("");
  const [aiSummaryText, setAiSummaryText] = useState("");
  const [aiSummaryBusy, setAiSummaryBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPatientDataControl(
        scopedLinkId ? { linkId: scopedLinkId } : {},
      );
      if (res.status === 404 && data.error === "feature_disabled") {
        setPractices([]);
        setRequests([]);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setPractices(Array.isArray(data.practices) ? data.practices : []);
      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setPractices([]);
      setRequests([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [scopedLinkId, t.featureDisabled, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!focusLinkId || loading || error) return;
    const el = document.getElementById(`data-control-link-${focusLinkId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    el.focus({ preventScroll: true });
  }, [focusLinkId, loading, error, practices]);

  async function grantProfile(link) {
    setBusyId(link.id);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await patchPatientProfileAccess(link.id, true);
      if (!res.ok || !data.ok) {
        setError(t.saveError);
        return;
      }
      setStatusMsg(t.savedGranted);
      await load();
    } finally {
      setBusyId("");
    }
  }

  function openRevokeDialog(link) {
    setRevokeTarget(link);
    setRevokeStep(1);
  }

  function closeRevokeDialog() {
    setRevokeTarget(null);
    setRevokeStep(1);
    setRevokeBusy(false);
  }

  async function confirmRevokeProfile() {
    if (!revokeTarget) return;
    setRevokeBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await patchPatientProfileAccess(revokeTarget.id, false);
      if (!res.ok || !data.ok) {
        setError(t.saveError);
        return;
      }
      setStatusMsg(t.savedRevoked);
      closeRevokeDialog();
      await load();
    } finally {
      setRevokeBusy(false);
    }
  }

  function openArchiveDialog(link) {
    setArchiveTarget(link);
    setArchiveStep(1);
  }

  function closeArchiveDialog() {
    setArchiveTarget(null);
    setArchiveStep(1);
    setArchiveBusy(false);
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setArchiveBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await patchPatientLinkArchive(archiveTarget.id);
      if (!res.ok || !data.ok) {
        setError(t.archiveError);
        return;
      }
      setStatusMsg(t.archiveSuccess);
      closeArchiveDialog();
      await load();
    } finally {
      setArchiveBusy(false);
    }
  }

  function openDeleteDialog(link) {
    setDeleteTarget(link);
    setDeleteStep(1);
  }

  function closeDeleteDialog() {
    setDeleteTarget(null);
    setDeleteStep(1);
    setDeleteBusy(false);
  }

  async function submitDeletionRequest() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setError("");
    try {
      const { res, data } = await postPatientDataRequest({
        practicePatientLinkId: deleteTarget.id,
        type: "deletion",
      });
      if (res.status === 409 && data.error === "request_already_open") {
        setError(t.requestAlreadyOpen);
        return;
      }
      if (!res.ok || !data.ok) {
        setError(t.requestError);
        return;
      }
      setStatusMsg(t.requestSuccess);
      closeDeleteDialog();
      await load();
    } finally {
      setDeleteBusy(false);
    }
  }

  function openExportDialog(link) {
    setExportTarget(link);
    setExportStep(1);
    setExportReason("");
  }

  function closeExportDialog() {
    setExportTarget(null);
    setExportStep(1);
    setExportBusy(false);
    setExportReason("");
    setExportAiBusy(false);
  }

  async function loadExportAiDraft() {
    if (!exportTarget) return;
    setExportAiBusy(true);
    try {
      const { res, data } = await postPatientDataRequestAiDraft({
        type: "export",
        locale: language,
        practiceName: exportTarget.practice?.practiceName,
      });
      if (!res.ok || !data.ok) {
        setError(t.aiDraftError);
        return;
      }
      if (data.draft) setExportReason(data.draft);
    } finally {
      setExportAiBusy(false);
    }
  }

  async function submitExportRequest() {
    if (!exportTarget) return;
    setExportBusy(true);
    setError("");
    try {
      const { res, data } = await postPatientDataRequest({
        practicePatientLinkId: exportTarget.id,
        type: "export",
        reason: exportReason.trim() || undefined,
      });
      if (res.status === 409 && data.error === "request_already_open") {
        setError(t.requestAlreadyOpen);
        return;
      }
      if (!res.ok || !data.ok) {
        setError(t.requestError);
        return;
      }
      setStatusMsg(t.requestExportSuccess);
      closeExportDialog();
      await load();
    } finally {
      setExportBusy(false);
    }
  }

  async function explainRequest(requestId) {
    setAiSummaryId(requestId);
    setAiSummaryText("");
    setAiSummaryBusy(true);
    setError("");
    try {
      const { res, data } = await postPatientDataRequestAiSummary(requestId, language);
      if (!res.ok || !data.ok) {
        setError(t.aiSummaryError);
        return;
      }
      setAiSummaryText(data.summary || "");
    } finally {
      setAiSummaryBusy(false);
    }
  }

  /**
   * One data request, as the patient reads it: what was asked, where it
   * stands, and — set apart — what the practice answered.
   */
  function renderRequest(req, withPractice) {
    const explaining = aiSummaryBusy && aiSummaryId === req.id;
    return (
      <li key={req.id} className="dc-request">
        <div className="dc-request__head">
          <h3 className="dc-request__title">{requestTypeLabel(req.type, t)}</h3>
          <RequestStatus status={req.status} label={requestStatusLabel(req.status, t)} />
        </div>
        <p className="dc-request__meta">
          {withPractice && req.practice?.practiceName ? `${req.practice.practiceName} · ` : ""}
          {t.requestedOn.replace("{date}", fmtDate(req.createdAt, language, t.notProvided))}
          {TERMINAL_STATUSES.has(req.status) && req.completedAt
            ? ` · ${t.answeredOn.replace("{date}", fmtDate(req.completedAt, language, t.notProvided))}`
            : ""}
        </p>
        {req.reason ? (
          <p className="dc-request__note">
            <span className="dc-request__note-label">{t.yourNoteLabel}</span>
            {req.reason}
          </p>
        ) : null}
        {/* The practice's answer, verbatim — written for the patient, and
            without it a "rejected" says nothing. Set apart as a reply. */}
        {req.responseNote ? (
          <figure className="dc-answer">
            <figcaption className="dc-answer__label">{t.responseNoteLabel}</figcaption>
            <blockquote className="dc-answer__text">{req.responseNote}</blockquote>
          </figure>
        ) : null}
        {/* Art. 12(4) GDPR: where a request is not (fully) met, the patient
            must learn of the right to complain and to a judicial remedy.
            Worded conditionally, so it is true whatever the answer says. */}
        {TERMINAL_STATUSES.has(req.status) ? (
          <p className="dc-request__rights">{t.answeredRightsNote}</p>
        ) : null}
        <button
          type="button"
          className="dc-request__explain"
          disabled={explaining}
          aria-busy={explaining || undefined}
          onClick={() => explainRequest(req.id)}
        >
          {explaining ? t.aiSummaryLoading : t.aiSummaryButton}
        </button>
        {aiSummaryId === req.id && aiSummaryText ? (
          <aside className="patient-data-control__ai-box" aria-labelledby={`ai-sum-${req.id}`}>
            <h4 id={`ai-sum-${req.id}`} className="dc-request__note-label">
              {t.aiSummaryHeading}
            </h4>
            <p className="patient-data-control__ai-hint">{t.aiHint}</p>
            <p style={{ whiteSpace: "pre-wrap", margin: "0.35rem 0 0" }}>{aiSummaryText}</p>
          </aside>
        ) : null}
      </li>
    );
  }

  const crossView = (
    <>
      <Link className="patient-inbox__back" to="/patient/practice">
        {t.backHub}
      </Link>
      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{t.heading}</h1>
        <p className="patient-inbox__intro">{t.intro}</p>
        <p className="patient-data-control__privacy" role="note">
          {t.privacyNotice}
        </p>
        <p style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <Link className="patient-threads__btn patient-threads__btn--secondary" to="/patient/activity">
            {t.openActivity}
          </Link>
          <Link className="patient-threads__btn patient-threads__btn--secondary" to="/patient/exports">
            {(getMessages(language).exports || getMessages("en").exports).headingPatient}
          </Link>
          <Link className="patient-threads__btn patient-threads__btn--secondary" to="/patient/consents">
            {t.openConsents}
          </Link>
        </p>
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

      {!loading && !error ? (
        <section className="patient-data-control__requests-panel" aria-labelledby="data-requests-heading">
          <h2 id="data-requests-heading" className="patient-inbox__item-title">
            {t.requestsSectionTitle}
          </h2>
          <p className="patient-inbox__muted">{t.requestsSectionIntro}</p>
          {requests.length > 0 ? (
            <ul className="dc-requests">
              {requests.map((req) => renderRequest(req, true))}
            </ul>
          ) : (
            <p className="patient-inbox__muted">{t.requestsEmpty}</p>
          )}
        </section>
      ) : null}

      {!loading && !error && practices.length === 0 ? (
        <p className="patient-inbox__muted">{t.empty}</p>
      ) : null}

      {!loading && !error && practices.length > 0 ? (
        <ul className="patient-inbox__list" aria-label={t.listCaption}>
          {practices.map((link) => {
            const practiceName = link.practice?.practiceName || t.notProvided;
            const granted = Boolean(link.profileAccessGranted);
            const st = statusLabel(link.status, t);
            const canManage = link.status === "active" || link.status === "invited";
            const pendingDeletion =
              hasOpenType(link, "deletion") || hasOpenType(link, "access_restriction");
            const pendingExport = hasOpenType(link, "export");

            return (
              <li
                key={link.id}
                id={`data-control-link-${link.id}`}
                className="patient-inbox__item patient-data-control__card"
                tabIndex={focusLinkId === link.id ? -1 : undefined}
              >
                <p className="patient-inbox__item-title">{practiceName}</p>
                <p className="patient-inbox__item-meta">{st}</p>
                {link.linkedAt ? (
                  <p className="patient-inbox__item-meta">
                    {t.linkedSince}: {fmtActivity(link.linkedAt, language, t.notProvided)}
                  </p>
                ) : null}
                {pendingDeletion ? (
                  <p className="patient-data-control__badge" role="status">
                    {t.requestPendingDeletion}
                  </p>
                ) : null}
                {pendingExport ? (
                  <p className="patient-data-control__badge patient-data-control__badge--export" role="status">
                    {t.requestPendingExport}
                  </p>
                ) : null}

                <dl className="patient-data-control__meta-grid">
                  <div>
                    <dt>{t.shareProfileTitle}</dt>
                    <dd>{granted ? t.profileAccessOn : t.profileAccessOff}</dd>
                  </div>
                  <div>
                    <dt>{t.hasMedicationPlans}</dt>
                    <dd>{indicatorLabel(link.hasMedicationPlans, t)}</dd>
                  </div>
                  <div>
                    <dt>{t.hasDocuments}</dt>
                    <dd>{indicatorLabel(link.hasDocuments, t)}</dd>
                  </div>
                  <div>
                    <dt>{t.hasMessages}</dt>
                    <dd>{indicatorLabel(link.hasMessages, t)}</dd>
                  </div>
                  <div>
                    <dt>{t.lastActivity}</dt>
                    <dd>{fmtActivity(link.lastActivityAt, language, t.notProvided)}</dd>
                  </div>
                </dl>

                {canManage && link.practice?.id ? (
                  <PatientPracticeDoctorSelect
                    practiceId={link.practice.id}
                    currentDoctorUserId={link.assignment?.patientSelectedDoctorUserId}
                    onUpdated={load}
                  />
                ) : null}

                <div className="patient-data-control__actions">
                  <Link
                    className="patient-threads__btn patient-threads__btn--secondary"
                    to="/patient/medication-plans"
                  >
                    {t.openMedicationPlans}
                  </Link>
                  <Link
                    className="patient-threads__btn patient-threads__btn--secondary"
                    to="/patient/practice-documents"
                  >
                    {t.openDocuments}
                  </Link>
                  <Link
                    className="patient-threads__btn patient-threads__btn--secondary"
                    to="/patient/messages"
                  >
                    {t.openMessages}
                  </Link>
                </div>

                {canManage ? (
                  <>
                    <fieldset className="patient-data-control__fieldset">
                      <legend className="patient-data-control__legend">{t.profileSharingSectionTitle}</legend>
                      <p className="patient-inbox__muted">{t.shareProfileHint}</p>
                      <p className="patient-inbox__item-meta" role="status" aria-live="polite">
                        {granted ? t.profileAccessOn : t.profileAccessOff}
                      </p>
                      {link.profileAccessGrantedAt ? (
                        <p className="patient-inbox__item-meta">
                          {t.grantedAtLabel}: {fmtActivity(link.profileAccessGrantedAt, language, t.notProvided)}
                        </p>
                      ) : null}
                      {!granted && link.profileAccessRevokedAt ? (
                        <p className="patient-inbox__item-meta">
                          {t.revokedAtLabel}: {fmtActivity(link.profileAccessRevokedAt, language, t.notProvided)}
                        </p>
                      ) : null}
                      <div className="patient-data-control__actions">
                        {!granted ? (
                          <button
                            type="button"
                            className="patient-threads__btn patient-threads__btn--secondary"
                            disabled={busyId === link.id}
                            aria-label={t.grantProfile}
                            onClick={() => grantProfile(link)}
                          >
                            {t.grantProfile}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="patient-threads__btn patient-data-control__btn--muted-danger"
                            disabled={busyId === link.id}
                            aria-label={t.revokeProfile}
                            onClick={() => openRevokeDialog(link)}
                          >
                            {t.revokeProfile}
                          </button>
                        )}
                      </div>
                    </fieldset>

                    <fieldset className="patient-data-control__fieldset">
                      <legend className="patient-data-control__legend">{t.dataActionsTitle}</legend>
                      <div className="patient-data-control__actions">
                        <button
                          type="button"
                          className="patient-threads__btn patient-threads__btn--secondary"
                          disabled={busyId === link.id}
                          onClick={() => openArchiveDialog(link)}
                        >
                          {t.archiveLink}
                        </button>
                        {!pendingExport ? (
                          <button
                            type="button"
                            className="patient-threads__btn patient-threads__btn--secondary"
                            disabled={busyId === link.id}
                            onClick={() => openExportDialog(link)}
                          >
                            {t.requestExport}
                          </button>
                        ) : null}
                        {!pendingDeletion ? (
                          <button
                            type="button"
                            className="patient-threads__btn patient-data-control__btn--muted-danger"
                            disabled={busyId === link.id}
                            onClick={() => openDeleteDialog(link)}
                          >
                            {t.requestDeletion}
                          </button>
                        ) : null}
                      </div>
                    </fieldset>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );

  /*
   * ONE practice. Ordered by what a patient opening "my data at this
   * practice" wants to know: what may it see → what did I ask → what did it
   * answer → the relationship itself. Same handlers and dialogs as the
   * cross-practice view; only the arrangement differs.
   */
  const link = practices[0] || null;
  const linkManageable = Boolean(link) && (link.status === "active" || link.status === "invited");
  const scopedPendingDeletion = link
    ? hasOpenType(link, "deletion") || hasOpenType(link, "access_restriction")
    : false;
  const scopedPendingExport = link ? hasOpenType(link, "export") : false;
  const profileGranted = Boolean(link?.profileAccessGranted);

  const scopedView = (
    <>
      <Link className="patient-inbox__back" to={scopedBase}>
        {tContext.backToHub}
      </Link>
      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{t.heading}</h1>
        <p className="patient-inbox__intro">{t.introScoped}</p>
      </header>

      {loading ? <p className="patient-inbox__muted" role="status">{t.loading}</p> : null}
      {error ? <p className="patient-inbox__error" role="alert">{error}</p> : null}
      {statusMsg ? <p className="dc-status-msg" role="status">{statusMsg}</p> : null}

      {!loading && !error && link ? (
        <>
          <ScopedConsentSummary link={link} language={language}>
            {linkManageable ? (
              <div className="dc-profile">
                <div className="dc-profile__text">
                  <h3 className="dc-profile__title">{t.profileScopedTitle}</h3>
                  <p className="dc-profile__state" aria-live="polite">
                    {profileGranted ? t.profileScopedOn : t.profileScopedOff}
                  </p>
                </div>
                {!profileGranted ? (
                  <button
                    type="button"
                    className="patient-threads__btn patient-threads__btn--secondary"
                    disabled={busyId === link.id}
                    onClick={() => grantProfile(link)}
                  >
                    {t.grantProfile}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="patient-threads__btn patient-data-control__btn--muted-danger"
                    disabled={busyId === link.id}
                    onClick={() => openRevokeDialog(link)}
                  >
                    {t.revokeProfile}
                  </button>
                )}
              </div>
            ) : null}
          </ScopedConsentSummary>

          <section className="dc-section" aria-labelledby="dc-requests-title">
            <h2 id="dc-requests-title" className="dc-section__title">{t.requestsScopedTitle}</h2>
            <p className="dc-section__intro">{t.requestsScopedIntro}</p>
            {requests.length > 0 ? (
              <ul className="dc-requests">
                {requests.map((req) => renderRequest(req, false))}
              </ul>
            ) : (
              <p className="dc-empty">{t.requestsScopedEmpty}</p>
            )}

            {linkManageable && (!scopedPendingExport || !scopedPendingDeletion) ? (
              <div className="dc-actions">
                {!scopedPendingExport ? (
                  <button
                    type="button"
                    className="patient-threads__btn patient-threads__btn--secondary"
                    disabled={busyId === link.id}
                    onClick={() => openExportDialog(link)}
                  >
                    {t.requestExport}
                  </button>
                ) : null}
                {!scopedPendingDeletion ? (
                  <button
                    type="button"
                    className="patient-threads__btn patient-threads__btn--secondary"
                    disabled={busyId === link.id}
                    onClick={() => openDeleteDialog(link)}
                  >
                    {t.requestDeletion}
                  </button>
                ) : null}
              </div>
            ) : null}
            <p className="dc-footnote">{t.deletionNoteScoped}</p>
          </section>

          <section className="dc-section dc-section--quiet" aria-labelledby="dc-connection-title">
            <h2 id="dc-connection-title" className="dc-section__title">{t.connectionTitle}</h2>
            <p className="dc-connection__line">
              {statusLabel(link.status, t)}
              {link.linkedAt
                ? ` · ${t.linkedSince} ${fmtDate(link.linkedAt, language, t.notProvided)}`
                : ""}
            </p>
            {linkManageable && link.practice?.id ? (
              <PatientPracticeDoctorSelect
                practiceId={link.practice.id}
                currentDoctorUserId={link.assignment?.patientSelectedDoctorUserId}
                onUpdated={load}
              />
            ) : null}
            {linkManageable ? (
              <button
                type="button"
                className="dc-connection__archive"
                disabled={busyId === link.id}
                onClick={() => openArchiveDialog(link)}
              >
                {t.archiveLink}
              </button>
            ) : null}
          </section>
        </>
      ) : null}
    </>
  );

  return (
    <div className={`patient-inbox${scoped ? " dc-scoped" : ""}`}>
      {scoped ? scopedView : crossView}

      <DataDeletionRequestDialog
        open={Boolean(deleteTarget)}
        step={deleteStep}
        busy={deleteBusy}
        practiceName={deleteTarget?.practice?.practiceName}
        t={t}
        onCancel={closeDeleteDialog}
        onConfirmStep1={() => setDeleteStep(2)}
        onConfirmStep2={submitDeletionRequest}
      />

      <RevokeProfileSharingDialog
        open={Boolean(revokeTarget)}
        step={revokeStep}
        busy={revokeBusy}
        practiceName={revokeTarget?.practice?.practiceName}
        t={t}
        onCancel={closeRevokeDialog}
        onConfirmStep1={() => setRevokeStep(2)}
        onConfirmStep2={confirmRevokeProfile}
      />

      <ArchiveRelationshipDialog
        open={Boolean(archiveTarget)}
        step={archiveStep}
        busy={archiveBusy}
        practiceName={archiveTarget?.practice?.practiceName}
        t={t}
        onCancel={closeArchiveDialog}
        onConfirmStep1={() => setArchiveStep(2)}
        onConfirmStep2={confirmArchive}
      />

      <ExportRequestDialog
        open={Boolean(exportTarget)}
        step={exportStep}
        busy={exportBusy}
        practiceName={exportTarget?.practice?.practiceName}
        reason={exportReason}
        onReasonChange={setExportReason}
        aiBusy={exportAiBusy}
        onAiDraft={loadExportAiDraft}
        t={t}
        onCancel={closeExportDialog}
        onConfirmStep1={() => setExportStep(2)}
        onConfirmStep2={submitExportRequest}
      />
    </div>
  );
}
