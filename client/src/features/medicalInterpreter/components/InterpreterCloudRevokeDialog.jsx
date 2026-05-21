import { useId, useState } from "react";
import InterpreterConfirmDialog from "./InterpreterConfirmDialog.jsx";

/**
 * @param {{
 *   open: boolean;
 *   labels: object;
 *   sessionCount: number;
 *   busy?: boolean;
 *   onKeepData: () => void | Promise<void>;
 *   onDeleteAllAndRevoke: () => void | Promise<void>;
 *   onCancel: () => void;
 * }} props
 */
export default function InterpreterCloudRevokeDialog({
  open,
  labels: t,
  sessionCount,
  busy = false,
  onKeepData,
  onDeleteAllAndRevoke,
  onCancel,
}) {
  const titleId = useId();
  const [choice, setChoice] = useState(null);

  const handleClose = () => {
    setChoice(null);
    onCancel();
  };

  if (!open) return null;

  if (choice === "delete" && sessionCount > 0) {
    return (
      <InterpreterConfirmDialog
        open
        title={t.cloud.revokeDeleteConfirmTitle}
        body={t.cloud.revokeDeleteConfirmBody.replace(
          "{{count}}",
          String(sessionCount),
        )}
        confirmLabel={t.cloud.revokeDeleteConfirmAction}
        cancelLabel={t.cloud.revokeBackToChoices}
        onConfirm={() => {
          setChoice(null);
          void onDeleteAllAndRevoke();
        }}
        onCancel={() => setChoice(null)}
        danger
      />
    );
  }

  return (
    <div
      className="interpreter-dialog-backdrop"
      role="presentation"
      onClick={handleClose}
    >
      <div
        className="interpreter-dialog interpreter-dialog--revoke"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="interpreter-dialog__title">
          {t.cloud.revokeDialogTitle}
        </h2>
        <p className="interpreter-dialog__body">{t.cloud.revokeDialogIntro}</p>

        <div className="interpreter-cloud-revoke__choices">
          <button
            type="button"
            className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary interpreter-cloud-revoke__choice"
            disabled={busy}
            onClick={() => {
              setChoice(null);
              void onKeepData();
            }}
          >
            <span className="interpreter-cloud-revoke__choice-title">
              {t.cloud.revokeKeepTitle}
            </span>
            <span className="interpreter-cloud-revoke__choice-desc">
              {t.cloud.revokeKeepBody}
            </span>
          </button>

          {sessionCount > 0 ? (
            <button
              type="button"
              className="medical-interpreter-page__nav-link interpreter-live__action-danger interpreter-cloud-revoke__choice"
              disabled={busy}
              onClick={() => setChoice("delete")}
            >
              <span className="interpreter-cloud-revoke__choice-title">
                {t.cloud.revokeDeleteTitle}
              </span>
              <span className="interpreter-cloud-revoke__choice-desc">
                {t.cloud.revokeDeleteBody.replace(
                  "{{count}}",
                  String(sessionCount),
                )}
              </span>
            </button>
          ) : null}
        </div>

        <div className="interpreter-dialog__actions">
          <button
            type="button"
            className="medical-interpreter-page__nav-link"
            onClick={handleClose}
            disabled={busy}
          >
            {t.confirm.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
