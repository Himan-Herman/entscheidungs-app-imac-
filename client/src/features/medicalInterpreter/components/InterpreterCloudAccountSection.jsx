import { useState } from "react";
import InterpreterConfirmDialog from "./InterpreterConfirmDialog.jsx";
import InterpreterCloudConsentPanel from "./InterpreterCloudConsentPanel.jsx";
import { useInterpreterCloud } from "../hooks/useInterpreterCloud.js";
import { deleteAllCloudSessions } from "../api/interpreterCloudApi.js";
import { clearAllLocalCloudSyncFlags } from "../utils/interpreterCloudLocalFlags.js";
import { cloudErrorMessage } from "../utils/interpreterCloudErrors.js";

/**
 * @param {{
 *   labels: object;
 *   announce: (message: string) => void;
 *   onCloudChanged?: () => void;
 * }} props
 */
export default function InterpreterCloudAccountSection({
  labels: t,
  announce,
  onCloudChanged,
}) {
  const cloud = useInterpreterCloud();
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDeleteAllCloud = async () => {
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
    onCloudChanged?.();
  };

  if (cloud.loading) {
    return (
      <p className="interpreter-cloud-panel__loading" role="status">
        {t.cloud.loading}
      </p>
    );
  }

  return (
    <>
      <InterpreterCloudConsentPanel
        labels={t}
        canUseCloud={cloud.canUseCloud}
        accountConsent={cloud.accountConsent}
        busy={busy}
        onGrant={cloud.grantConsent}
        onRevoke={cloud.revokeConsent}
        onStatusMessage={announce}
      />

      {cloud.accountConsent && cloud.sessionCount > 0 ? (
        <div className="interpreter-cloud-panel__danger-zone">
          <h3 className="interpreter-live__section-title">
            {t.cloud.deleteAllHeading}
          </h3>
          <p className="interpreter-cloud-panel__body">{t.cloud.deleteAllBody}</p>
          <button
            type="button"
            className="medical-interpreter-page__nav-link interpreter-live__action-danger"
            onClick={() => setDeleteAllOpen(true)}
            disabled={busy}
            aria-label={t.aria.deleteAllCloudData}
          >
            {t.cloud.deleteAllAction}
          </button>
        </div>
      ) : null}

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
    </>
  );
}
