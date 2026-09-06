import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import {
  archivePatientEntry,
  createInvitation,
  createPatientEntry,
  fetchEntryInvitations,
  fetchPatientEntries,
  revokeInvitation,
  rotateManualCode,
  sendInvitationEmail,
} from "../api/patientOnboardingApi.js";
import { buildInvitationLink } from "../invitationLink.js";
import AddPatientEntryDialog from "../components/AddPatientEntryDialog.jsx";
import InvitationQrModal from "../components/InvitationQrModal.jsx";
import "../../../styles/PatientOnboarding.css";

/**
 * The practice side: local records, and the invitations that let a patient
 * connect their own account to one.
 *
 * TWO THINGS THIS PAGE HOLDS IN MEMORY AND NOWHERE ELSE: the plaintext
 * invitation token and the plaintext on-site code. Both come back exactly once
 * from the server, are shown once, and are gone on reload — so they are never
 * written to storage, never put in a URL, and never logged.
 */
export default function PracticePatientEntriesPage() {
  const { language } = useLanguage();
  const messages = getMessages(language);
  const tx = messages.patientOnboarding.practice;

  const [params] = useSearchParams();
  const practiceId = params.get("practiceId") || "";

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState(null);
  const [duplicateNotice, setDuplicateNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Plaintext credentials, per entry, in memory only.
  const [freshLink, setFreshLink] = useState({});   // entryId -> link
  const [freshCode, setFreshCode] = useState({});   // entryId -> code
  const [invitations, setInvitations] = useState({}); // entryId -> newest invitation
  const [qrFor, setQrFor] = useState(null);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(getPrimaryIntlLocale(language), { dateStyle: "medium" }),
    [language],
  );
  const fmtDate = (iso) => {
    if (!iso) return "—";
    try { return dateFmt.format(new Date(iso)); } catch { return "—"; }
  };

  const load = useCallback(async () => {
    if (!practiceId) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchPatientEntries(practiceId, {
        q: search || undefined,
        includeArchived,
      });
      setEntries(res.entries || []);
      // Newest invitation per entry, so the list can show a real status rather
      // than guessing from the entry alone.
      const map = {};
      await Promise.all((res.entries || []).map(async (entry) => {
        try {
          const inv = await fetchEntryInvitations(practiceId, entry.id);
          map[entry.id] = (inv.invitations || [])[0] || null;
        } catch {
          map[entry.id] = null;
        }
      }));
      setInvitations(map);
    } catch (err) {
      // The route answers 404 `feature_disabled` while the module is off. That
      // is not a failure to report as one — somebody simply opened a URL for a
      // module this deployment does not run.
      setLoadError(err?.code === "feature_disabled" ? tx.unavailable : tx.loadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, search, includeArchived, tx.loadError, tx.unavailable]);

  useEffect(() => { load(); }, [load]);

  /** What the practice should read for an entry, derived from real backend state. */
  function invitationLabel(entry) {
    const inv = invitations[entry.id];
    if (!inv) return tx.invitationStatus.none;
    if (inv.status === "pending") {
      return inv.isExpired ? tx.invitationStatus.expired : tx.invitationStatus.pending;
    }
    return tx.invitationStatus[inv.status] || tx.invitationStatus.none;
  }

  async function handleCreate(data) {
    const res = await createPatientEntry(practiceId, data);
    setShowAdd(false);
    setNotice(null);
    // A hint, never a blocker, and never a list of other people.
    if (res.possibleDuplicateCount > 0) {
      setDuplicateNotice({
        count: res.possibleDuplicateCount,
        capped: Boolean(res.duplicateScanCapped),
      });
    } else {
      setDuplicateNotice(null);
    }
    await load();
  }

  async function withBusy(entryId, fn) {
    if (busyId) return;
    setBusyId(entryId);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setNotice({ kind: "error", text: tx.invitation.error, code: err?.code });
    } finally {
      setBusyId(null);
    }
  }

  const handleInvite = (entry, regenerate) => withBusy(entry.id, async () => {
    const res = await createInvitation(practiceId, entry.id);
    // The plaintext exists here and nowhere else. Straight into the link.
    setFreshLink((m) => ({ ...m, [entry.id]: buildInvitationLink(res.token) }));
    setFreshCode((m) => ({ ...m, [entry.id]: null }));
    setNotice({
      kind: "ok",
      text: regenerate ? tx.invitation.regenerated : tx.invitation.created,
    });
    await load();
  });

  /**
   * Issue and email in one server call.
   *
   * No link and no code are shown afterwards: the token never came to this
   * browser. Showing a stale one from a previous issue would be worse than
   * showing none, because superseding just made it dead.
   */
  const handleSendEmail = (entry) => withBusy(entry.id, async () => {
    try {
      const res = await sendInvitationEmail(practiceId, entry.id, language);
      setFreshLink((m) => ({ ...m, [entry.id]: null }));
      setFreshCode((m) => ({ ...m, [entry.id]: null }));
      setNotice({
        kind: "ok",
        text: tx.invitation.emailSent.replace("{address}", res.deliveredTo || ""),
      });
      await load();
    } catch (err) {
      setNotice({
        kind: "error",
        text: err?.code === "entry_has_no_email"
          ? tx.invitation.emailMissing
          : tx.invitation.emailFailed,
      });
    }
  });

  const handleRevoke = (entry) => {
    const inv = invitations[entry.id];
    if (!inv) return;
    if (!window.confirm(tx.invitation.confirmRevoke)) return;
    return withBusy(entry.id, async () => {
      await revokeInvitation(practiceId, inv.id);
      setFreshLink((m) => ({ ...m, [entry.id]: null }));
      setFreshCode((m) => ({ ...m, [entry.id]: null }));
      setNotice({ kind: "ok", text: tx.invitation.revoked });
      await load();
    });
  };

  const handleManualCode = (entry) => {
    const inv = invitations[entry.id];
    if (!inv) return;
    return withBusy(entry.id, async () => {
      const res = await rotateManualCode(practiceId, inv.id);
      setFreshCode((m) => ({ ...m, [entry.id]: res.manualCode }));
      setNotice({ kind: "ok", text: tx.invitation.codeCreated });
      await load();
    });
  };

  const handleArchive = (entry) => {
    if (!window.confirm(tx.invitation.confirmArchive)) return;
    return withBusy(entry.id, async () => {
      await archivePatientEntry(practiceId, entry.id);
      setFreshLink((m) => ({ ...m, [entry.id]: null }));
      setFreshCode((m) => ({ ...m, [entry.id]: null }));
      await load();
    });
  };

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice({ kind: "ok", text: tx.invitation.copied });
    } catch {
      setNotice({ kind: "error", text: tx.invitation.copyFailed });
    }
  }

  return (
    <section className="onboarding-page">
      <header className="onboarding-page__head">
        <div>
          <h1 className="onboarding-page__title">{tx.title}</h1>
          <p className="onboarding-page__intro">{tx.intro}</p>
        </div>
        <button
          type="button"
          className="onboarding-btn"
          onClick={() => setShowAdd(true)}
          disabled={!practiceId}
        >
          {tx.addButton}
        </button>
      </header>

      <div className="onboarding-toolbar">
        <label className="onboarding-field onboarding-field--inline">
          <span className="onboarding-field__label">{tx.searchLabel}</span>
          <input
            className="onboarding-field__input"
            value={search}
            placeholder={tx.searchPlaceholder}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="onboarding-checkbox">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          <span>{tx.showArchived}</span>
        </label>
      </div>

      {/* Announced to assistive technology, not only shown in a colour. */}
      {notice && (
        <p
          className={`onboarding-alert onboarding-alert--${notice.kind === "ok" ? "ok" : "error"}`}
          role="status"
        >
          {notice.text}
        </p>
      )}
      {duplicateNotice && (
        <div className="onboarding-alert onboarding-alert--warn" role="status">
          <strong>
            {duplicateNotice.count === 1
              ? tx.duplicate.one
              : tx.duplicate.many.replace("{count}", String(duplicateNotice.count))}
          </strong>
          <p>{tx.duplicate.hint}</p>
          {duplicateNotice.capped && <p>{tx.duplicate.capped}</p>}
        </div>
      )}

      {loading && <p className="onboarding-page__intro">{tx.loading}</p>}
      {loadError && (
        <p className="onboarding-alert onboarding-alert--error" role="alert">{loadError}</p>
      )}
      {!loading && !loadError && entries.length === 0 && (
        <p className="onboarding-page__intro">{tx.empty}</p>
      )}

      <ul className="onboarding-list">
        {entries.map((entry) => {
          const inv = invitations[entry.id];
          const link = freshLink[entry.id];
          const code = freshCode[entry.id];
          const livePending = inv?.status === "pending" && !inv.isExpired;
          const busy = busyId === entry.id;

          return (
            <li key={entry.id} className="onboarding-card">
              <div className="onboarding-card__head">
                <h2 className="onboarding-card__name">
                  {entry.givenName} {entry.familyName}
                </h2>
                {/* Status carries text, not colour alone. */}
                <span className={`onboarding-badge onboarding-badge--${entry.status}`}>
                  {tx.entryStatus[entry.status] || entry.status}
                </span>
              </div>

              <dl className="onboarding-card__meta">
                <div>
                  <dt>{tx.columns.dateOfBirth}</dt>
                  <dd>{fmtDate(entry.dateOfBirth)}</dd>
                </div>
                <div>
                  <dt>{tx.columns.invitation}</dt>
                  <dd>{invitationLabel(entry)}</dd>
                </div>
              </dl>

              {entry.isLinked && (
                <p className="onboarding-alert onboarding-alert--ok">
                  <strong>{tx.linked.badge}</strong> {tx.linked.hint}
                </p>
              )}

              {link && (
                <div className="onboarding-credential">
                  <label className="onboarding-field">
                    <span className="onboarding-field__label">{tx.invitation.linkLabel}</span>
                    <textarea className="onboarding-field__input" readOnly rows={2} value={link} />
                    <span className="onboarding-field__hint">{tx.invitation.linkHint}</span>
                  </label>
                  <div className="onboarding-card__actions">
                    <button type="button" className="onboarding-btn onboarding-btn--ghost"
                      onClick={() => copy(link)}>
                      {tx.actions.copyLink}
                    </button>
                    <button type="button" className="onboarding-btn onboarding-btn--ghost"
                      onClick={() => setQrFor(link)}>
                      {tx.actions.showQr}
                    </button>
                  </div>
                </div>
              )}
              {livePending && !link && (
                <p className="onboarding-field__hint">{tx.invitation.linkGone}</p>
              )}

              {code && (
                <div className="onboarding-credential">
                  <label className="onboarding-field">
                    <span className="onboarding-field__label">{tx.invitation.codeLabel}</span>
                    <output className="onboarding-code">{code}</output>
                    <span className="onboarding-field__hint">{tx.invitation.codeHint}</span>
                  </label>
                </div>
              )}

              <div className="onboarding-card__actions">
                {entry.status !== "archived" && !entry.isLinked && (
                  <button
                    type="button" className="onboarding-btn" disabled={busy}
                    onClick={() => handleInvite(entry, livePending)}
                  >
                    {livePending ? tx.actions.regenerate : tx.actions.invite}
                  </button>
                )}
                {entry.status !== "archived" && !entry.isLinked && entry.email && (
                  <button
                    type="button" className="onboarding-btn onboarding-btn--ghost"
                    disabled={busy} onClick={() => handleSendEmail(entry)}
                  >
                    {tx.actions.sendEmail}
                  </button>
                )}
                {livePending && (
                  <>
                    <button type="button" className="onboarding-btn onboarding-btn--ghost"
                      disabled={busy} onClick={() => handleManualCode(entry)}>
                      {code ? tx.actions.newManualCode : tx.actions.manualCode}
                    </button>
                    <button type="button" className="onboarding-btn onboarding-btn--danger"
                      disabled={busy} onClick={() => handleRevoke(entry)}>
                      {tx.actions.revoke}
                    </button>
                  </>
                )}
                {entry.status !== "archived" && (
                  <button type="button" className="onboarding-btn onboarding-btn--ghost"
                    disabled={busy} onClick={() => handleArchive(entry)}>
                    {tx.actions.archive}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {showAdd && (
        <AddPatientEntryDialog
          tx={tx}
          onCancel={() => setShowAdd(false)}
          onCreate={handleCreate}
        />
      )}
      {qrFor && (
        <InvitationQrModal
          link={qrFor}
          tx={{ ...tx, loading: tx.loading }}
          onClose={() => setQrFor(null)}
        />
      )}
    </section>
  );
}
