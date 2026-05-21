import { useMemo, useState } from "react";
import InterpreterConfirmDialog from "./InterpreterConfirmDialog.jsx";
import InterpreterCloudStatusBadge from "./InterpreterCloudStatusBadge.jsx";
import { deleteCloudSession } from "../api/interpreterCloudApi.js";
import { cloudErrorMessage } from "../utils/interpreterCloudErrors.js";
import { updateSessionMetadata } from "../store/interpreterSessionStore.js";
import { saveSessionToCloud, resolveCloudSyncStatus } from "../utils/interpreterCloudSync.js";
import { validateInterpreterAccountScope } from "../utils/interpreterAccountScope.js";

/**
 * Per-session manual cloud sync controls (Phase 3.3).
 * @param {{
 *   session: import('../types.js').InterpreterSession;
 *   labels: object;
 *   accountConsent: boolean;
 *   canUseCloud: boolean;
 *   cloudSessionIds: Set<string>;
 *   onChanged: () => void;
 *   announce: (message: string) => void;
 *   compact?: boolean;
 * }} props
 */
export default function InterpreterCloudSessionSync({
  session,
  labels: t,
  accountConsent,
  canUseCloud,
  cloudSessionIds,
  onChanged,
  announce,
  compact = false,
}) {
  const [busy, setBusy] = useState(false);
  const [deleteCloudOpen, setDeleteCloudOpen] = useState(false);

  const syncStatus = useMemo(
    () => resolveCloudSyncStatus(session, cloudSessionIds),
    [session, cloudSessionIds],
  );

  const onCloud = cloudSessionIds.has(session.sessionId);
  const hasTurns = (session.turns?.length ?? 0) > 0;

  if (!canUseCloud) return null;

  const badgeLabel =
    syncStatus === "synced"
      ? t.cloud.badgeSynced
      : syncStatus === "stale"
        ? t.cloud.badgeStale
        : t.cloud.badgeLocal;

  const badgeVariant =
    syncStatus === "synced"
      ? "synced"
      : syncStatus === "stale"
        ? "stale"
        : "local";

  const handleSave = async () => {
    const scope = validateInterpreterAccountScope();
    if (!scope.ok) {
      announce(
        scope.reason === "no_user"
          ? t.cloud.scopeNoUser
          : t.cloud.scopeMismatch,
      );
      return;
    }
    if (!accountConsent) {
      announce(t.cloud.enableAccountFirst);
      return;
    }
    if (!hasTurns) {
      announce(t.cloud.saveNeedsTurns);
      return;
    }
    setBusy(true);
    const result = await saveSessionToCloud(session, { alreadyOnCloud: onCloud });
    setBusy(false);
    if (!result.ok) {
      announce(cloudErrorMessage(result.error, t));
      return;
    }
    announce(onCloud ? t.cloud.updateSuccess : t.cloud.saveSuccess);
    onChanged();
  };

  const handleDeleteCloud = async () => {
    const scope = validateInterpreterAccountScope();
    if (!scope.ok) {
      announce(
        scope.reason === "no_user"
          ? t.cloud.scopeNoUser
          : t.cloud.scopeMismatch,
      );
      return;
    }
    setBusy(true);
    const result = await deleteCloudSession(session.sessionId);
    setBusy(false);
    setDeleteCloudOpen(false);
    if (!result.ok) {
      announce(cloudErrorMessage(result.error, t));
      return;
    }
    updateSessionMetadata(session.sessionId, {
      cloudSyncStatus: "none",
      cloudSyncedAt: undefined,
    });
    announce(t.cloud.deleteCopySuccess);
    onChanged();
  };

  const saveLabel = onCloud ? t.cloud.updateSavedCopy : t.cloud.saveToAccount;

  return (
    <div
      className={
        compact
          ? "interpreter-cloud-sync interpreter-cloud-sync--compact"
          : "interpreter-cloud-sync"
      }
    >
      <div className="interpreter-cloud-sync__head">
        <InterpreterCloudStatusBadge variant={badgeVariant} label={badgeLabel} />
        {!accountConsent ? (
          <p className="interpreter-cloud-sync__hint">{t.cloud.sessionNeedsConsent}</p>
        ) : null}
      </div>

      <div className="interpreter-cloud-sync__actions">
        <button
          type="button"
          className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary interpreter-cloud-sync__btn"
          onClick={() => void handleSave()}
          disabled={busy || !accountConsent || !hasTurns}
          aria-busy={busy}
        >
          {saveLabel}
        </button>
        {onCloud ? (
          <button
            type="button"
            className="medical-interpreter-page__nav-link interpreter-live__action-danger interpreter-cloud-sync__btn"
            onClick={() => setDeleteCloudOpen(true)}
            disabled={busy}
          >
            {t.cloud.deleteCloudCopy}
          </button>
        ) : null}
      </div>

      <p className="interpreter-cloud-sync__note" role="note">
        {t.cloud.sessionLocalNote}
      </p>

      <InterpreterConfirmDialog
        open={deleteCloudOpen}
        title={t.cloud.deleteCopyConfirmTitle}
        body={t.cloud.deleteCopyConfirmBody}
        confirmLabel={t.cloud.deleteCopyConfirmAction}
        cancelLabel={t.confirm.cancel}
        onConfirm={() => void handleDeleteCloud()}
        onCancel={() => setDeleteCloudOpen(false)}
        danger
      />
    </div>
  );
}
