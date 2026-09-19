import { useState } from "react";
import { patchPracticeDataRequestStatus } from "../api/patientDataControlApi.js";
import { OPEN_STATUSES } from "../lib/dataRequestStatus.js";
import "./PracticeDataRequestActions.css";

/**
 * What the practice can DO with one open data request — deliberately short:
 *
 *   Neu  →  In Bearbeitung  →  Antwort schreiben  →  Antwort senden (= Beantwortet)
 *
 * Two levels of authority, from the practice's permission model (the server
 * sends them as `capabilities` and enforces them again):
 *   triage  — reception included: may mark the request "in progress";
 *   answer  — owner, admin, practice management, doctor: may write the answer
 *             to the patient and close the request with it.
 *
 * A triage-only role sees no answer field at all (clearer than a disabled
 * one), just one line saying who answers. Closed requests show no actions.
 *
 * @param {{ practiceId: string, request: { id: string, status: string },
 *           capabilities: { triage?: boolean, answer?: boolean } | null,
 *           onSaved: () => void | Promise<void>, t: Record<string, string>,
 *           idPrefix?: string }} props
 */
export default function PracticeDataRequestActions({
  practiceId, request, capabilities, onSaved, t, idPrefix = "dra",
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null); // { kind, text }

  const canTriage = Boolean(capabilities?.triage);
  const canAnswer = Boolean(capabilities?.answer);
  if (!OPEN_STATUSES.has(request.status) || (!canTriage && !canAnswer)) {
    return message ? <Notice message={message} /> : null;
  }

  const noteId = `${idPrefix}-note-${request.id}`;
  const hintId = `${idPrefix}-hint-${request.id}`;

  async function send(status) {
    if (busy) return;
    const text = note.trim();
    if (status === "answered" && !text) {
      setMessage({ kind: "error", text: t.dataRequestAnswerRequired });
      return;
    }
    setBusy(status);
    setMessage(null);
    try {
      const { res, data } = await patchPracticeDataRequestStatus(practiceId, request.id, {
        status,
        ...(status === "answered" ? { responseNote: text } : {}),
      });
      if (!res.ok || !data.ok) {
        const byCode = {
          forbidden: t.dataRequestForbidden,
          forbidden_answer: t.dataRequestForbidden,
          validation_answer_required: t.dataRequestAnswerRequired,
          request_already_answered: t.dataRequestAlreadyAnswered,
        };
        setMessage({ kind: "error", text: byCode[data?.error] || t.dataRequestSaveError });
        return;
      }
      setNote("");
      setMessage({
        kind: "ok",
        text: status === "answered" ? t.dataRequestAnswered : t.dataRequestMarkedInReview,
      });
      await onSaved?.();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="pdr-actions">
      {request.status === "submitted" ? (
        <button
          type="button"
          className="pdr-actions__secondary"
          onClick={() => send("in_review")}
          disabled={Boolean(busy)}
          aria-busy={busy === "in_review" || undefined}
        >
          {t.dataRequestMarkInReview}
        </button>
      ) : null}

      {canAnswer ? (
        <div className="pdr-actions__answer">
          <label htmlFor={noteId} className="pdr-actions__label">{t.dataConsentResponseLabel}</label>
          <textarea
            id={noteId}
            rows={4}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={Boolean(busy)}
            aria-describedby={hintId}
          />
          <div id={hintId} className="pdr-actions__hints">
            <p>{t.dataConsentResponseHint}</p>
            <p>{t.dataRequestPartialHint}</p>
          </div>
          <button
            type="button"
            className="pdr-actions__primary"
            onClick={() => send("answered")}
            disabled={Boolean(busy)}
            aria-busy={busy === "answered" || undefined}
          >
            {busy === "answered" ? t.dataConsentSaving : t.dataRequestSendAnswer}
          </button>
        </div>
      ) : (
        <p className="pdr-actions__role">{t.dataRequestAnswerRoleInfo}</p>
      )}

      {message ? <Notice message={message} /> : null}
    </div>
  );
}

function Notice({ message }) {
  return (
    <p
      className={`pdr-actions__notice pdr-actions__notice--${message.kind}`}
      role={message.kind === "ok" ? "status" : "alert"}
    >
      {message.text}
    </p>
  );
}
