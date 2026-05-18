import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import DataDeletionRequestDialog from "../components/DataDeletionRequestDialog.jsx";
import RevokeProfileSharingDialog from "../components/RevokeProfileSharingDialog.jsx";
import {
  fetchPatientDataControl,
  patchPatientLinkArchive,
  patchPatientProfileAccess,
  postPatientDataRequest,
} from "../api/patientDataControlApi.js";
import "../../../styles/PatientInboxPage.css";
import "../../../styles/PatientDataControlPage.css";

function statusLabel(status, t) {
  const map = {
    active: t.statusActive,
    invited: t.statusInvited,
    revoked: t.statusRevoked,
    archived: t.statusArchived,
  };
  return map[status] || status;
}

function fmtActivity(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(lang === "de" ? "de-DE" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function indicatorLabel(has, t) {
  return has ? t.indicatorYes : t.indicatorNo;
}

export default function PatientDataControlPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).patientDataControl ||
      getMessages("en").patientDataControl,
    [language],
  );

  const [practices, setPractices] = useState([]);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPatientDataControl();
      if (res.status === 404 && data.error === "feature_disabled") {
        setPractices([]);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setPractices(Array.isArray(data.practices) ? data.practices : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setPractices([]);
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

  async function archiveLink(link) {
    if (!window.confirm(t.archiveConfirm)) return;
    setBusyId(link.id);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await patchPatientLinkArchive(link.id);
      if (!res.ok || !data.ok) {
        setError(t.archiveError);
        return;
      }
      setStatusMsg(t.archiveSuccess);
      await load();
    } finally {
      setBusyId("");
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

  return (
    <div className="patient-inbox">
      <Link className="patient-inbox__back" to="/patient">
        {t.backHub}
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

      {!loading && !error && practices.length === 0 ? (
        <p className="patient-inbox__muted">{t.empty}</p>
      ) : null}

      {!loading && !error && practices.length > 0 ? (
        <ul className="patient-inbox__list" aria-label={t.listCaption}>
          {practices.map((link) => {
            const practiceName = link.practice?.practiceName || "—";
            const granted = Boolean(link.profileAccessGranted);
            const st = statusLabel(link.status, t);
            const canManage =
              link.status === "active" || link.status === "invited";
            const hasPending = Boolean(link.openDataRequest);

            return (
              <li key={link.id} className="patient-inbox__item" style={{ padding: "1rem" }}>
                <p className="patient-inbox__item-title">{practiceName}</p>
                <p className="patient-inbox__item-meta">{st}</p>
                {hasPending ? (
                  <p className="patient-data-control__badge" role="status">
                    {t.requestPending}
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
                    <dd>{fmtActivity(link.lastActivityAt, language)}</dd>
                  </div>
                </dl>

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
                  <fieldset style={{ border: "none", margin: "1rem 0 0", padding: 0 }}>
                    <legend className="patient-inbox__item-title" style={{ fontSize: "1rem" }}>
                      {t.profileSharingSectionTitle}
                    </legend>
                    <p className="patient-inbox__muted">{t.shareProfileHint}</p>
                    <p className="patient-inbox__item-meta" role="status" aria-live="polite">
                      {granted ? t.profileAccessOn : t.profileAccessOff}
                    </p>
                    {link.profileAccessGrantedAt ? (
                      <p className="patient-inbox__item-meta">
                        {t.grantedAtLabel}: {fmtActivity(link.profileAccessGrantedAt, language)}
                      </p>
                    ) : null}
                    {!granted && link.profileAccessRevokedAt ? (
                      <p className="patient-inbox__item-meta">
                        {t.revokedAtLabel}: {fmtActivity(link.profileAccessRevokedAt, language)}
                      </p>
                    ) : null}
                    <div className="patient-data-control__actions" style={{ marginTop: "0.5rem" }}>
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
                    <div className="patient-data-control__actions" style={{ marginTop: "0.75rem" }}>
                      <button
                        type="button"
                        className="patient-threads__btn patient-threads__btn--secondary"
                        disabled={busyId === link.id || link.status === "archived"}
                        onClick={() => archiveLink(link)}
                      >
                        {t.archiveLink}
                      </button>
                      {!hasPending ? (
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
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

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
    </div>
  );
}
