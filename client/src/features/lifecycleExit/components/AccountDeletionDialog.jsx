import { useMemo, useState } from "react";
import FocusModal from "../../patientPractices/components/FocusModal.jsx";
import { deleteAccount } from "../api/lifecycleExitApi.js";

/**
 * Server answers meaning "nothing was deleted, the transaction rolled back".
 * They are postcondition failures of the archive/erasure path, not user error.
 */
const SAFE_ROLLBACK_CODES = new Set([
  "account_deletion_blocked",
  "context_archive_conflict",
  "context_archive_incomplete",
  "account_deletion_incomplete",
]);
import "../../../styles/LifecycleExit.css";

/**
 * Multi-step account deletion confirmation.
 *
 * Nothing is pre-selected: the checkbox starts empty, the phrase field starts
 * empty, and the red confirm button stays disabled until BOTH are satisfied.
 * The dialog itself (FocusModal) traps focus, closes on Escape and returns
 * focus to the opener — a keyboard-only user can complete or abort the whole
 * flow without a mouse.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onDeleted: (result: { caseNumber: string | null }) => void,
 *   t: Record<string, any>,          // lifecycleExit.patient bundle
 * }} props
 */
export default function AccountDeletionDialog({ open, onClose, onDeleted, t }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const phraseOk = phrase.trim() === t.phraseExpected;
  const canConfirm = acknowledged && phraseOk && !working;

  const errorText = useMemo(() => error, [error]);

  function resetAndClose() {
    setAcknowledged(false);
    setPhrase("");
    setError("");
    onClose();
  }

  async function handleConfirm() {
    setError("");
    if (!acknowledged) return;
    if (!phraseOk) {
      setError(t.phraseMismatch);
      return;
    }
    setWorking(true);
    try {
      const { res, data } = await deleteAccount();
      if (res.ok && data?.deleted) {
        onDeleted({ caseNumber: data.caseNumber ?? null });
        return;
      }
      // Server-side codes are AP3's. The owner case is normally prevented by
      // hiding this dialog entirely, but a practice acquired since the page
      // loaded must still produce the right message rather than a generic one.
      if (data?.error === "practice_owner_account_deletion_temporarily_unavailable") {
        setError(t.errorOwnerBlocked);
      } else if (SAFE_ROLLBACK_CODES.has(data?.error)) {
        setError(t.errorContextBlocked);
      } else {
        setError(t.errorGeneric);
      }
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.errorGeneric);
    } finally {
      setWorking(false);
    }
  }

  return (
    <FocusModal
      open={open}
      onClose={working ? () => {} : resetAndClose}
      titleId="lifecycle-account-delete-title"
      title={t.dialogTitle}
    >
      <div className="lifecycle-exit__warning-card" role="alert">
        <p className="lifecycle-exit__warning-title">
          <span aria-hidden="true">⚠️</span> {t.dialogWarning}
        </p>
      </div>

      <h3 className="lifecycle-exit__label">{t.whatDeletedTitle}</h3>
      <ul className="lifecycle-exit__list">
        {t.whatDeletedItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h3 className="lifecycle-exit__label">{t.whatRemainsTitle}</h3>
      <ul className="lifecycle-exit__list">
        {t.whatRemainsItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="lifecycle-exit__note">{t.whatRemainsNote}</p>
      <p className="lifecycle-exit__note">{t.exportHint}</p>

      <div className="lifecycle-exit__checkbox-row">
        <input
          id="lifecycle-account-delete-ack"
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        <label htmlFor="lifecycle-account-delete-ack">{t.checkboxLabel}</label>
      </div>

      <div className="lifecycle-exit__field">
        <label className="lifecycle-exit__label" htmlFor="lifecycle-account-delete-phrase">
          {t.phraseLabel}
        </label>
        <p className="lifecycle-exit__note">
          <span className="lifecycle-exit__phrase">{t.phraseExpected}</span>
        </p>
        <input
          id="lifecycle-account-delete-phrase"
          className="lifecycle-exit__input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          aria-invalid={phrase.length > 0 && !phraseOk}
        />
      </div>

      {errorText ? (
        <p className="lifecycle-exit__error" role="alert">
          {errorText}
        </p>
      ) : null}

      <div className="lifecycle-exit__dialog-actions">
        <button
          type="button"
          className="lifecycle-exit__btn lifecycle-exit__btn--outline"
          onClick={resetAndClose}
          disabled={working}
        >
          {t.cancelButton}
        </button>
        <button
          type="button"
          className="lifecycle-exit__btn lifecycle-exit__btn--danger"
          onClick={() => void handleConfirm()}
          disabled={!canConfirm}
        >
          {working ? t.deleting : t.confirmButton}
        </button>
      </div>
    </FocusModal>
  );
}
