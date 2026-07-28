import { useState } from "react";
import FocusModal from "./FocusModal.jsx";
import { practiceDisplayLabel } from "../../../utils/groupByPracticeBranding.js";
import { createDocumentShareGrant, shareErrorMessage } from "../api/documentShareGrantsApi.js";

/**
 * The patient releases ONE document to ONE other connected practice.
 *
 * Nothing is preselected — not the last practice used, not "all", not one
 * guessed from the specialty. Choosing the receiving practice is the decision
 * being made, so the patient makes it deliberately.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onShared: (grant: object) => void,
 *   document: { id: string, title?: string, practiceName?: string },
 *   candidates: Array<{ id: string, practice?: object }>,
 *   t: Record<string, any>,
 * }} props
 */
export default function ShareDocumentDialog({ open, onClose, onShared, document: doc, candidates, t }) {
  const [targetLinkId, setTargetLinkId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const docTitle = doc?.title || t.fields.document;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!targetLinkId || busy) return;
    setBusy(true);
    setError("");
    try {
      const { res, data } = await createDocumentShareGrant(doc.id, targetLinkId);
      if (!res.ok || !data.ok) {
        setError(shareErrorMessage(data, t.errors));
        return;
      }
      onShared(data.grant);
      setTargetLinkId("");
      onClose();
    } catch (err) {
      if (err?.name === "AbortError" || err?.message === "SESSION_EXPIRED") return;
      setError(t.errors.server_error);
    } finally {
      setBusy(false);
    }
  }

  const selected = candidates.find((c) => c.id === targetLinkId);
  const selectedName = selected ? practiceDisplayLabel(selected.practice) : "";

  return (
    <FocusModal
      open={open}
      onClose={busy ? () => {} : onClose}
      titleId="share-document-dialog-title"
      title={t.share.dialogTitle}
    >
      <form className="focus-modal__body" onSubmit={handleSubmit}>
        <p>
          <strong>{t.fields.document}:</strong> {docTitle}
          <br />
          <strong>{t.fields.sourcePractice}:</strong> {doc?.practiceName || "—"}
        </p>

        <label className="focus-modal__field" htmlFor="share-target-practice">
          <span>{t.share.selectPractice}</span>
          <select
            id="share-target-practice"
            value={targetLinkId}
            onChange={(e) => { setTargetLinkId(e.target.value); setError(""); }}
            disabled={busy}
            required
          >
            {/* Empty by design — the patient must choose. */}
            <option value="">{t.share.selectPlaceholder}</option>
            {candidates.map((link) => (
              <option key={link.id} value={link.id}>
                {practiceDisplayLabel(link.practice)}
              </option>
            ))}
          </select>
        </label>

        <p className="focus-modal__notice">{t.share.readOnlyNotice}</p>

        {error ? <p className="focus-modal__error" role="alert">{error}</p> : null}

        <div className="focus-modal__actions">
          <button
            type="submit"
            className="focus-modal__btn focus-modal__btn--primary"
            disabled={!targetLinkId || busy}
            aria-label={
              selectedName
                ? t.share.ariaLabel.replace("{document}", docTitle).replace("{practice}", selectedName)
                : undefined
            }
          >
            {busy ? t.share.submitting : t.share.confirm}
          </button>
          <button
            type="button"
            className="focus-modal__btn focus-modal__btn--secondary"
            onClick={onClose}
            disabled={busy}
          >
            {t.share.cancel}
          </button>
        </div>
      </form>
    </FocusModal>
  );
}
