import { useCallback, useEffect, useId, useRef, useState } from "react";
import QRCode from "qrcode";
import { Link } from "react-router-dom";
import InterpreterPracticeFeatureGate from "../components/InterpreterPracticeFeatureGate.jsx";
import {
  createPracticeInterpreterInvite,
  fetchPracticeInterpreterInvites,
  revokePracticeInterpreterInvite,
} from "../api/interpreterPracticeInvitesApi.js";
import { fetchInterpreterPracticeStatus } from "../api/interpreterPracticeApi.js";
import { useMedicalInterpreterPracticeMessages } from "../hooks/useMedicalInterpreterPracticeMessages.js";
import {
  practiceInterpreterPath,
  usePracticeIdFromQuery,
} from "../utils/practiceContextQuery.js";
import "../styles/MedicalInterpreter.css";

function inviteStatusLabel(t, status) {
  const map = {
    active: t.invites.statusActive,
    revoked: t.invites.statusRevoked,
    expired: t.invites.statusExpired,
  };
  return map[status] || t.invites.statusUnknown;
}

function InterpreterPracticeInvitesContent() {
  const t = useMedicalInterpreterPracticeMessages();
  const practiceId = usePracticeIdFromQuery();
  const revokeDialogTitleId = useId();
  const [canManage, setCanManage] = useState(false);
  const [loadState, setLoadState] = useState({ loading: true, invites: [], error: null });
  const [createdLink, setCreatedLink] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState(
    /** @type {'idle' | 'ok' | 'error'} */ ("idle"),
  );
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [inviteType, setInviteType] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ttlHours, setTtlHours] = useState("");
  const [formError, setFormError] = useState("");
  const generateRef = useRef(null);

  const dashboardHref = practiceInterpreterPath(
    "/practice/interpreter/dashboard",
    practiceId,
  );
  const interpreterHref = practiceInterpreterPath("/practice/interpreter", practiceId);

  const reload = useCallback(async () => {
    setLoadState((s) => ({ ...s, loading: true }));
    const result = await fetchPracticeInterpreterInvites({ practiceId });
    setLoadState({
      loading: false,
      invites: result.invites || [],
      error: result.ok ? null : result.error,
    });
  }, [practiceId]);

  useEffect(() => {
    document.title = t.invites.pageTitle;
  }, [t.invites.pageTitle]);

  useEffect(() => {
    let cancelled = false;
    void fetchInterpreterPracticeStatus({ practiceId }).then((status) => {
      if (!cancelled) {
        setCanManage(status.practiceAccess?.canManage === true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!createdLink?.path) {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(createdLink.path, { margin: 2, width: 220 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    }).catch(() => {
      if (!cancelled) setQrDataUrl("");
    });
    return () => {
      cancelled = true;
    };
  }, [createdLink?.path]);

  const handleCopyLink = async () => {
    if (!createdLink?.path) return;
    setCopyStatus("idle");
    try {
      await navigator.clipboard.writeText(createdLink.path);
      setCopyStatus("ok");
    } catch {
      setCopyStatus("error");
    }
  };

  const handleGenerate = async (event) => {
    event?.preventDefault?.();
    if (!canManage || busy) return;
    if (!inviteType.trim()) {
      setFormError(t.invites.inviteTypeRequired);
      generateRef.current?.focus();
      return;
    }
    setFormError("");
    setBusy(true);
    setCreatedLink(null);

    const payload = {
      practiceId,
      inviteType: inviteType.trim(),
    };
    const trimmedName = displayName.trim();
    if (trimmedName) {
      payload.displayName = trimmedName;
    }
    const ttlRaw = ttlHours.trim();
    if (ttlRaw) {
      const parsed = Number.parseInt(ttlRaw, 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 720) {
        payload.ttlHours = parsed;
      }
    } else {
      payload.ttlHours = 168;
    }

    const result = await createPracticeInterpreterInvite(payload);
    setBusy(false);
    if (result.ok && result.invitePath) {
      const fullPath =
        typeof window !== "undefined"
          ? `${window.location.origin}${result.invitePath}`
          : result.invitePath;
      setCreatedLink({ path: fullPath, token: result.token });
      void reload();
    }
  };

  const confirmRevoke = async () => {
    if (!revokeTarget || busy) return;
    setBusy(true);
    await revokePracticeInterpreterInvite({
      practiceId,
      inviteId: revokeTarget.id,
    });
    setBusy(false);
    setRevokeTarget(null);
    void reload();
  };

  return (
    <main
      className="medical-interpreter-page interp-practice-invites interp-root"
      id="main-content"
    >
      <nav className="interp-practice-dash__nav" aria-label={t.invites.navAria}>
        <Link className="medical-interpreter-page__back" to={dashboardHref}>
          {t.invites.backToDashboard}
        </Link>
        <Link className="medical-interpreter-page__nav-link" to={interpreterHref}>
          {t.chrome.backToInterpreter}
        </Link>
      </nav>

      <header className="interp-practice-invites__hero">
        <h1 className="medical-interpreter-page__title">{t.invites.heading}</h1>
        <p className="medical-interpreter-page__intro">{t.invites.intro}</p>
        <p className="medical-interpreter-safety" role="note">
          {t.safety.communicationOnly}
        </p>
      </header>

      <section aria-labelledby="interp-invites-actions-heading">
        <h2 id="interp-invites-actions-heading" className="interp-practice-dash__section-title">
          {t.invites.actionsHeading}
        </h2>
        <p className="interp-practice-invites__placeholder-note" role="status">
          {t.invites.placeholderNote}
        </p>
        {canManage ? (
          <form
            className="interpreter-setup__form interp-practice-invites__form"
            onSubmit={(event) => void handleGenerate(event)}
            noValidate
          >
            <p className="interpreter-setup__hint">{t.invites.requiredLegend}</p>

            <div className="interpreter-setup__field">
              <label className="interpreter-setup__label" htmlFor="interp-invite-type">
                {t.invites.inviteTypeLabel}
              </label>
              <span className="interpreter-setup__hint" id="interp-invite-type-hint">
                {t.invites.inviteTypeHint}
              </span>
              <select
                id="interp-invite-type"
                ref={generateRef}
                className="interpreter-setup__select"
                value={inviteType}
                onChange={(event) => {
                  setInviteType(event.target.value);
                  if (formError) setFormError("");
                }}
                aria-required="true"
                aria-invalid={formError ? true : undefined}
                aria-describedby={
                  formError
                    ? "interp-invite-type-hint interp-invite-form-error"
                    : "interp-invite-type-hint"
                }
              >
                <option value="">{t.invites.inviteTypeSelectEmpty}</option>
                <option value="waiting_room">{t.invites.inviteTypeWaitingRoom}</option>
                <option value="reception">{t.invites.inviteTypeReception}</option>
                <option value="doctor_room">{t.invites.inviteTypeDoctorRoom}</option>
                <option value="remote">{t.invites.inviteTypeRemote}</option>
                <option value="other">{t.invites.inviteTypeOther}</option>
              </select>
            </div>

            <div className="interpreter-setup__field">
              <label className="interpreter-setup__label" htmlFor="interp-invite-display-name">
                {t.invites.displayNameLabel}
              </label>
              <span className="interpreter-setup__hint" id="interp-invite-display-name-hint">
                {t.invites.displayNameHint}
              </span>
              <input
                id="interp-invite-display-name"
                type="text"
                className="interpreter-setup__input"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={t.invites.displayNamePlaceholder}
                maxLength={80}
                aria-describedby="interp-invite-display-name-hint"
              />
            </div>

            <div className="interpreter-setup__field">
              <label className="interpreter-setup__label" htmlFor="interp-invite-ttl">
                {t.invites.ttlHoursLabel}
              </label>
              <span className="interpreter-setup__hint" id="interp-invite-ttl-hint">
                {t.invites.ttlHoursHint}
              </span>
              <input
                id="interp-invite-ttl"
                type="number"
                className="interpreter-setup__input"
                value={ttlHours}
                onChange={(event) => setTtlHours(event.target.value)}
                min={1}
                max={720}
                placeholder="168"
                aria-describedby="interp-invite-ttl-hint"
              />
            </div>

            {formError ? (
              <p
                id="interp-invite-form-error"
                className="interpreter-setup__error"
                role="alert"
              >
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
              disabled={busy}
            >
              {busy ? t.invites.generating : t.invites.generateButton}
            </button>
          </form>
        ) : (
          <p className="interpreter-empty-state" role="status">
            {t.invites.managePermissionRequired}
          </p>
        )}
        {createdLink ? (
          <div
            className="interp-practice-invites__created"
            role="region"
            aria-labelledby="interp-invite-created-heading"
          >
            <h3 id="interp-invite-created-heading">{t.invites.createdHeading}</h3>
            <p>{t.invites.createdOnceWarning}</p>
            <p>
              <code className="interp-practice-invites__link-code">{createdLink.path}</code>
            </p>
            <button
              type="button"
              className="medical-interpreter-page__nav-link"
              onClick={() => void handleCopyLink()}
            >
              {t.invites.copyLink}
            </button>
            {copyStatus === "ok" ? (
              <p className="interp-practice-invites__copy-status" role="status" aria-live="polite">
                {t.invites.copySuccess}
              </p>
            ) : null}
            {copyStatus === "error" ? (
              <p className="interp-practice-invites__copy-status" role="alert">
                {t.invites.copyError}
              </p>
            ) : null}
            {qrDataUrl ? (
              <div className="interp-practice-invites__qr">
                <h4>{t.invites.qrHeading}</h4>
                <img src={qrDataUrl} alt={t.invites.qrAlt} width={220} height={220} />
                <p>{t.invites.qrFallback}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="interp-invites-list-heading">
        <h2 id="interp-invites-list-heading" className="interp-practice-dash__section-title">
          {t.invites.listHeading}
        </h2>
        {loadState.loading ? (
          <p className="interpreter-empty-state" role="status" aria-live="polite">
            {t.invites.listLoading}
          </p>
        ) : null}
        {!loadState.loading && loadState.invites.length === 0 ? (
          <p className="interpreter-empty-state" role="status">
            {t.invites.listEmpty}
          </p>
        ) : null}
        {!loadState.loading && loadState.invites.length > 0 ? (
          <ul className="interp-practice-invites__list">
            {loadState.invites.map((inv) => {
              const statusText = inviteStatusLabel(t, inv.status);
              return (
                <li key={inv.id} className="interp-practice-invites__item">
                  <div className="interp-practice-invites__item-main">
                    <span className="interp-practice-invites__name">
                      {inv.displayName || inv.tokenPrefix || t.invites.unnamedInvite}
                    </span>
                    <span
                      className={`interp-practice-invites__badge interp-practice-invites__badge--${inv.status}`}
                      role="status"
                      aria-label={t.invites.statusBadgeAria.replace("{status}", statusText)}
                    >
                      {statusText}
                    </span>
                  </div>
                  <p className="interp-practice-invites__meta">
                    {t.invites.expiresLabel}:{" "}
                    <time dateTime={inv.expiresAt}>
                      {new Date(inv.expiresAt).toLocaleString()}
                    </time>
                  </p>
                  {canManage && inv.status === "active" ? (
                    <button
                      type="button"
                      className="interp-practice-invites__revoke"
                      disabled={busy}
                      onClick={() => setRevokeTarget(inv)}
                    >
                      {t.invites.revokeButton}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {revokeTarget ? (
        <div
          className="interp-practice-invites__dialog-backdrop"
          role="presentation"
          onClick={() => !busy && setRevokeTarget(null)}
        >
          <div
            className="interp-practice-invites__dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={revokeDialogTitleId}
            aria-describedby="interp-invite-revoke-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={revokeDialogTitleId}>{t.invites.revokeDialogTitle}</h3>
            <p id="interp-invite-revoke-desc">{t.invites.revokeDialogBody}</p>
            <div className="interp-practice-invites__dialog-actions">
              <button
                type="button"
                className="interp-practice-invites__dialog-cancel"
                disabled={busy}
                onClick={() => setRevokeTarget(null)}
              >
                {t.invites.revokeDialogCancel}
              </button>
              <button
                type="button"
                className="interp-practice-invites__revoke"
                disabled={busy}
                onClick={() => void confirmRevoke()}
              >
                {t.invites.revokeDialogConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function InterpreterPracticeInvitesPage() {
  return (
    <InterpreterPracticeFeatureGate>
      <InterpreterPracticeInvitesContent />
    </InterpreterPracticeFeatureGate>
  );
}
