import { useCallback, useEffect, useRef, useState } from "react";
import FocusModal from "./FocusModal.jsx";
import {
  fetchDocumentShareGrants,
  revokeDocumentShareGrant,
  shareErrorMessage,
} from "../api/documentShareGrantsApi.js";
import "./SharedDataSection.css";

function fmtDate(value, language) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(language || "de", {
      year: "numeric", month: "2-digit", day: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * "Geteilte Daten" — everything the patient has released to another practice.
 *
 * Revocation is never optimistic: the status changes only after the server has
 * confirmed it, because showing "withdrawn" while a practice can still read the
 * document would be worse than a slow spinner.
 *
 * @param {{ t: Record<string, any>, language: string }} props
 */
export default function SharedDataSection({ t, language }) {
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [pendingRevoke, setPendingRevoke] = useState(null);
  const [busy, setBusy] = useState(false);
  const [revokeError, setRevokeError] = useState("");
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchDocumentShareGrants();
      if (!aliveRef.current) return;
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setGrants(Array.isArray(data.grants) ? data.grants : []);
    } catch (err) {
      if (err?.name === "AbortError" || err?.message === "SESSION_EXPIRED") return;
      if (aliveRef.current) setError(t.sharedData.loadError);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [t.sharedData.loadError]);

  useEffect(() => {
    aliveRef.current = true;
    void load();
    return () => { aliveRef.current = false; };
  }, [load]);

  async function confirmRevoke() {
    if (!pendingRevoke || busy) return;
    setBusy(true);
    setRevokeError("");
    try {
      const { res, data } = await revokeDocumentShareGrant(pendingRevoke.id);
      if (!res.ok || !data.ok) {
        setRevokeError(shareErrorMessage(data, t.errors));
        return;
      }
      // Only now, with the server's answer in hand, does the row change.
      setGrants((prev) => prev.map((g) => (g.id === data.grant.id ? data.grant : g)));
      setStatusMsg(t.revoke.success);
      setPendingRevoke(null);
    } catch (err) {
      if (err?.name === "AbortError" || err?.message === "SESSION_EXPIRED") return;
      setRevokeError(t.errors.server_error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="shared-data" aria-labelledby="shared-data-heading">
      <h2 id="shared-data-heading">{t.sharedData.title}</h2>
      <p className="shared-data__intro">{t.sharedData.description}</p>

      <div role="status" aria-live="polite" className="shared-data__status">
        {loading ? t.sharedData.loading : statusMsg}
      </div>

      {error && (
        <div className="shared-data__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>{t.sharedData.retry}</button>
        </div>
      )}

      {!loading && grants.length === 0 && !error && (
        <p className="shared-data__empty">{t.sharedData.empty}</p>
      )}

      {grants.length > 0 && (
        <ul className="shared-data__list" aria-label={t.sharedData.listLabel}>
          {grants.map((grant) => {
            const source = grant.sourcePractice?.practiceName || "—";
            const target = grant.targetPractice?.practiceName || "—";
            const title = grant.documentTitle || t.fields.document;
            const isActive = grant.status === "active";
            return (
              <li key={grant.id} className="shared-data__item">
                <h3 className="shared-data__doc">{title}</h3>
                <dl className="shared-data__meta">
                  <div><dt>{t.fields.sourcePractice}</dt><dd>{source}</dd></div>
                  <div><dt>{t.fields.targetPractice}</dt><dd>{target}</dd></div>
                  <div>
                    <dt>{t.fields.status}</dt>
                    <dd>
                      {/* Text first, colour only as reinforcement. */}
                      <span className={`shared-data__pill shared-data__pill--${grant.status}`}>
                        {t.status[grant.status] || grant.status}
                      </span>
                    </dd>
                  </div>
                  <div><dt>{t.fields.grantedAt}</dt><dd>{fmtDate(grant.grantedAt, language)}</dd></div>
                  {grant.revokedAt ? (
                    <div><dt>{t.fields.revokedAt}</dt><dd>{fmtDate(grant.revokedAt, language)}</dd></div>
                  ) : null}
                  {grant.expiresAt ? (
                    <div><dt>{t.fields.expiresAt}</dt><dd>{fmtDate(grant.expiresAt, language)}</dd></div>
                  ) : null}
                </dl>

                {isActive && (
                  <button
                    type="button"
                    className="shared-data__revoke"
                    onClick={() => { setRevokeError(""); setPendingRevoke(grant); }}
                    aria-label={t.revoke.ariaLabel
                      .replace("{document}", title)
                      .replace("{practice}", target)}
                  >
                    {t.revoke.action}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <FocusModal
        open={Boolean(pendingRevoke)}
        onClose={busy ? () => {} : () => setPendingRevoke(null)}
        titleId="revoke-grant-dialog-title"
        title={t.revoke.dialogTitle}
      >
        {pendingRevoke && (
          <div className="focus-modal__body">
            <p>
              <strong>{t.fields.document}:</strong> {pendingRevoke.documentTitle || t.fields.document}
              <br />
              <strong>{t.fields.sourcePractice}:</strong>{" "}
              {pendingRevoke.sourcePractice?.practiceName || "—"}
              <br />
              <strong>{t.fields.targetPractice}:</strong>{" "}
              {pendingRevoke.targetPractice?.practiceName || "—"}
            </p>
            <p className="focus-modal__notice">{t.revoke.notice}</p>
            <p>{t.revoke.externalCopies}</p>

            {revokeError ? <p className="focus-modal__error" role="alert">{revokeError}</p> : null}

            <div className="focus-modal__actions">
              <button
                type="button"
                className="focus-modal__btn focus-modal__btn--danger"
                onClick={confirmRevoke}
                disabled={busy}
              >
                {busy ? t.revoke.submitting : t.revoke.confirm}
              </button>
              <button
                type="button"
                className="focus-modal__btn focus-modal__btn--secondary"
                onClick={() => setPendingRevoke(null)}
                disabled={busy}
              >
                {t.revoke.cancel}
              </button>
            </div>
          </div>
        )}
      </FocusModal>
    </section>
  );
}
