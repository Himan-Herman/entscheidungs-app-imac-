import { useCallback, useEffect, useState } from "react";
import InterpreterConfirmDialog from "./InterpreterConfirmDialog.jsx";
import InterpreterCloudConsentPanel from "./InterpreterCloudConsentPanel.jsx";
import InterpreterCloudRevokeDialog from "./InterpreterCloudRevokeDialog.jsx";
import { useInterpreterCloud } from "../hooks/useInterpreterCloud.js";
import {
  deleteAllCloudSessions,
  downloadInterpreterCloudExport,
  fetchInterpreterCloudConsentHistory,
  revokeInterpreterCloudConsent,
} from "../api/interpreterCloudApi.js";
import { clearAllLocalCloudSyncFlags } from "../utils/interpreterCloudLocalFlags.js";
import { cloudErrorMessage } from "../utils/interpreterCloudErrors.js";
import {
  getAuthenticatedUserId,
  validateInterpreterAccountScope,
  watchInterpreterAccountUser,
} from "../utils/interpreterAccountScope.js";
import { formatInterpreterDateTime } from "../utils/formatInterpreterDate.js";

/**
 * @param {{
 *   labels: object;
 *   announce: (message: string) => void;
 *   onCloudChanged?: () => void;
 * }} props
 */
export default function InterpreterCloudDataControlPanel({
  labels: t,
  announce,
  onCloudChanged,
}) {
  const cloud = useInterpreterCloud();
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consentHistory, setConsentHistory] = useState([]);
  const [scopeWarning, setScopeWarning] = useState("");

  const loadHistory = useCallback(async () => {
    if (!cloud.canUseCloud) {
      setConsentHistory([]);
      return;
    }
    const result = await fetchInterpreterCloudConsentHistory();
    if (result.ok && Array.isArray(result.records)) {
      setConsentHistory(result.records);
    }
  }, [cloud.canUseCloud]);

  useEffect(() => {
    const scope = validateInterpreterAccountScope();
    if (!scope.ok) {
      setScopeWarning(
        scope.reason === "no_user"
          ? t.cloud.scopeNoUser
          : t.cloud.scopeMismatch,
      );
    } else {
      setScopeWarning("");
    }
  }, [t.cloud.scopeNoUser, t.cloud.scopeMismatch, cloud.loading]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, cloud.accountConsent, cloud.loading]);

  useEffect(() => {
    return watchInterpreterAccountUser(() => {
      void cloud.reload();
      void loadHistory();
      onCloudChanged?.();
    });
  }, [cloud, loadHistory, onCloudChanged]);

  const scopeErrorMessage = (reason) =>
    reason === "no_user" ? t.cloud.scopeNoUser : t.cloud.scopeMismatch;

  const handleExportCloud = async () => {
    const scope = validateInterpreterAccountScope();
    if (!scope.ok) {
      announce(scopeErrorMessage(scope.reason));
      return;
    }
    setBusy(true);
    const result = await downloadInterpreterCloudExport();
    setBusy(false);
    if (!result.ok) {
      announce(cloudErrorMessage(result.error, t));
      return;
    }
    try {
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename || "medscout-interpreter-export.json";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      announce(t.cloud.exportSuccess);
    } catch {
      announce(t.cloud.errors.generic);
    }
  };

  const handleDeleteAllCloud = async () => {
    const scope = validateInterpreterAccountScope();
    if (!scope.ok) {
      announce(scopeErrorMessage(scope.reason));
      return;
    }
    setBusy(true);
    const result = await deleteAllCloudSessions();
    setBusy(false);
    setDeleteAllOpen(false);
    if (!result.ok) {
      announce(cloudErrorMessage(result.error, t));
      return;
    }
    clearAllLocalCloudSyncFlags();
    announce(t.cloud.deleteAllSuccess);
    await cloud.reload();
    await loadHistory();
    onCloudChanged?.();
  };

  const handleRevokeKeep = async () => {
    const scope = validateInterpreterAccountScope();
    if (!scope.ok) {
      announce(scopeErrorMessage(scope.reason));
      return;
    }
    setBusy(true);
    const result = await revokeInterpreterCloudConsent({ deleteCloudData: false });
    setBusy(false);
    setRevokeOpen(false);
    if (!result.ok) {
      announce(cloudErrorMessage(result.error, t));
      return;
    }
    announce(t.cloud.consentRevokedKeepData);
    await cloud.reload();
    await loadHistory();
    onCloudChanged?.();
  };

  const handleRevokeDeleteAll = async () => {
    const scope = validateInterpreterAccountScope();
    if (!scope.ok) {
      announce(scopeErrorMessage(scope.reason));
      return;
    }
    setBusy(true);
    const result = await revokeInterpreterCloudConsent({ deleteCloudData: true });
    setBusy(false);
    setRevokeOpen(false);
    if (!result.ok) {
      announce(cloudErrorMessage(result.error, t));
      return;
    }
    clearAllLocalCloudSyncFlags();
    const n = result.deletedSessionCount ?? 0;
    announce(
      n > 0 ? t.cloud.consentRevokedAndDeleted : t.cloud.consentRevokedKeepData,
    );
    await cloud.reload();
    await loadHistory();
    onCloudChanged?.();
  };

  const statusSummary = () => {
    if (!cloud.canUseCloud) return t.cloud.statusUnavailable;
    if (!getAuthenticatedUserId()) return t.cloud.statusSignInRequired;
    if (!cloud.accountConsent) return t.cloud.statusLocalOnly;
    if (cloud.sessionCount > 0) {
      return t.cloud.statusAccountActive.replace(
        "{{count}}",
        String(cloud.sessionCount),
      );
    }
    return t.cloud.statusConsentNoSessions;
  };

  if (cloud.loading) {
    return (
      <p className="interpreter-cloud-panel__loading" role="status">
        {t.cloud.loading}
      </p>
    );
  }

  return (
    <section
      className="interpreter-data-control"
      aria-labelledby="interp-data-control-heading"
    >
      <h2 id="interp-data-control-heading" className="interpreter-live__section-title">
        {t.cloud.dataControlHeading}
      </h2>

      <p className="interpreter-data-control__summary" role="status">
        {statusSummary()}
      </p>

      {scopeWarning ? (
        <p className="interpreter-feedback interpreter-feedback--error" role="alert">
          {scopeWarning}
        </p>
      ) : null}

      <dl className="interpreter-data-control__facts">
        <div className="interpreter-data-control__fact">
          <dt>{t.cloud.factLocal}</dt>
          <dd>{t.cloud.factLocalBody}</dd>
        </div>
        <div className="interpreter-data-control__fact">
          <dt>{t.cloud.factCloud}</dt>
          <dd>{t.cloud.factCloudBody}</dd>
        </div>
        <div className="interpreter-data-control__fact">
          <dt>{t.cloud.factAudio}</dt>
          <dd>{t.cloud.factAudioBody}</dd>
        </div>
      </dl>

      <InterpreterCloudConsentPanel
        labels={t}
        canUseCloud={cloud.canUseCloud}
        accountConsent={cloud.accountConsent}
        busy={busy}
        onGrant={cloud.grantConsent}
        onRevoke={() => Promise.resolve({ ok: true })}
        onRevokeRequest={() => setRevokeOpen(true)}
        showRevokeButton={cloud.accountConsent}
        onStatusMessage={announce}
      />

      {consentHistory.length > 0 ? (
        <div className="interpreter-data-control__history">
          <h3 className="interpreter-live__section-title">
            {t.cloud.consentHistoryHeading}
          </h3>
          <ul className="interpreter-data-control__history-list">
            {consentHistory.map((row) => (
              <li key={row.id}>
                <span className="interpreter-data-control__history-status">
                  {row.status === "granted"
                    ? t.cloud.historyGranted
                    : t.cloud.historyRevoked}
                </span>
                <time dateTime={row.createdAt}>
                  {formatInterpreterDateTime(row.createdAt)}
                </time>
                {row.version ? (
                  <span className="interpreter-data-control__history-version">
                    {row.version}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {cloud.sessionCount > 0 ? (
        <div className="interpreter-cloud-panel__export-zone">
          <h3 className="interpreter-live__section-title">
            {t.cloud.exportHeading}
          </h3>
          <p className="interpreter-cloud-panel__body">{t.cloud.exportBody}</p>
          <button
            type="button"
            className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
            onClick={() => void handleExportCloud()}
            disabled={busy}
            aria-busy={busy}
            aria-label={t.aria.exportCloudData}
          >
            {t.cloud.exportAction}
          </button>
        </div>
      ) : null}

      {cloud.accountConsent || cloud.sessionCount > 0 ? (
        <div className="interpreter-cloud-panel__danger-zone">
          <h3 className="interpreter-live__section-title">
            {t.cloud.deleteAllHeading}
          </h3>
          <p className="interpreter-cloud-panel__body">{t.cloud.deleteAllBody}</p>
          <button
            type="button"
            className="medical-interpreter-page__nav-link interpreter-live__action-danger"
            onClick={() => setDeleteAllOpen(true)}
            disabled={busy || cloud.sessionCount === 0}
            aria-label={t.aria.deleteAllCloudData}
          >
            {t.cloud.deleteAllAction}
          </button>
        </div>
      ) : null}

      <InterpreterCloudRevokeDialog
        open={revokeOpen}
        labels={t}
        sessionCount={cloud.sessionCount}
        busy={busy}
        onKeepData={handleRevokeKeep}
        onDeleteAllAndRevoke={handleRevokeDeleteAll}
        onCancel={() => setRevokeOpen(false)}
      />

      <InterpreterConfirmDialog
        open={deleteAllOpen}
        title={t.cloud.deleteAllConfirmTitle}
        body={t.cloud.deleteAllConfirmBody}
        confirmLabel={t.cloud.deleteAllConfirmAction}
        cancelLabel={t.confirm.cancel}
        onConfirm={() => void handleDeleteAllCloud()}
        onCancel={() => setDeleteAllOpen(false)}
        danger
      />
    </section>
  );
}
