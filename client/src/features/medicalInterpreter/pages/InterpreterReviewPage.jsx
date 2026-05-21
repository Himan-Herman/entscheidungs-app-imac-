import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import { useMountedRef } from "../hooks/useMountedRef.js";
import { useInterpreterConnectivity } from "../hooks/useInterpreterConnectivity.js";
import InterpreterConnectivityBanner from "../components/InterpreterConnectivityBanner.jsx";
import InterpreterConfirmDialog from "../components/InterpreterConfirmDialog.jsx";
import InterpreterRenameDialog from "../components/InterpreterRenameDialog.jsx";
import InterpreterReviewDetail from "../components/InterpreterReviewDetail.jsx";
import InterpreterCloudSessionSync from "../components/InterpreterCloudSessionSync.jsx";
import InterpreterPracticeSharePanel from "../components/InterpreterPracticeSharePanel.jsx";
import { readInterpreterInviteContext } from "../utils/interpreterInviteContext.js";
import { useInterpreterCloud } from "../hooks/useInterpreterCloud.js";
import {
  SESSION_STATUS_ACTIVE,
  SESSION_STATUS_DRAFT,
  SESSION_STATUS_ENDED,
} from "../constants.js";
import {
  deleteSession,
  endSession,
  getCurrentSession,
  getSession,
  hasPendingDraftTurn,
  renameSession,
  setCurrentSessionId,
} from "../store/interpreterSessionStore.js";
import { downloadInterpreterSessionPdf } from "../pdf/generateInterpreterSessionPdf.js";
import { getSessionDisplayTitle } from "../utils/sessionDisplayTitle.js";
import "../styles/MedicalInterpreter.css";

export default function InterpreterReviewPage() {
  const t = useMedicalInterpreterMessages();
  const { language: uiLanguage } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [storeTick, setStoreTick] = useState(0);
  const [liveMessage, setLiveMessage] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const actionsRef = useRef(null);
  const exportButtonRef = useRef(null);
  const sessionActionInFlightRef = useRef(false);
  const mountedRef = useMountedRef();
  const connectivity = useInterpreterConnectivity();
  const cloud = useInterpreterCloud();

  const sessionIdParam = searchParams.get("sessionId")?.trim() || "";

  const session = useMemo(() => {
    void storeTick;
    if (sessionIdParam) return getSession(sessionIdParam);
    return getCurrentSession();
  }, [sessionIdParam, storeTick]);

  const reload = useCallback(() => setStoreTick((n) => n + 1), []);

  const announce = useCallback(
    (message) => {
      if (!mountedRef.current) return;
      setLiveMessage("");
      requestAnimationFrame(() => {
        if (mountedRef.current) setLiveMessage(message);
      });
    },
    [mountedRef],
  );

  useEffect(() => {
    document.title = t.review.pageTitle;
  }, [t.review.pageTitle]);

  const [sessionActionBusy, setSessionActionBusy] = useState(false);

  const doEndSession = useCallback(() => {
    if (!session || sessionActionInFlightRef.current) return;
    sessionActionInFlightRef.current = true;
    if (mountedRef.current) setSessionActionBusy(true);
    endSession(session.sessionId, t, uiLanguage);
    reload();
    announce(t.sessionActions.ended);
    sessionActionInFlightRef.current = false;
    if (mountedRef.current) {
      setSessionActionBusy(false);
      requestAnimationFrame(() => actionsRef.current?.focus());
    }
  }, [session, t, uiLanguage, reload, announce, mountedRef]);

  const handleEnd = () => {
    if (
      !session ||
      session.status === SESSION_STATUS_ENDED ||
      sessionActionBusy ||
      isExporting
    ) {
      return;
    }
    if (hasPendingDraftTurn(session)) {
      setConfirmAction("end");
      return;
    }
    doEndSession();
  };

  const handleDelete = () => {
    if (!session || sessionActionBusy || isExporting) return;
    setConfirmAction("delete");
  };

  const handleDeleteConfirm = () => {
    if (!session || sessionActionInFlightRef.current) return;
    sessionActionInFlightRef.current = true;
    if (mountedRef.current) setSessionActionBusy(true);
    deleteSession(session.sessionId);
    setConfirmAction(null);
    sessionActionInFlightRef.current = false;
    announce(t.history.deleted);
    navigate("/patient/interpreter", { replace: true });
  };

  const handleContinue = () => {
    if (!session || sessionActionBusy || isExporting) return;
    if (!connectivity.isOnline) {
      announce(t.errors.offline);
      return;
    }
    setCurrentSessionId(session.sessionId);
    navigate("/patient/interpreter/live");
  };

  const handleRenameConfirm = (title) => {
    if (!session) return;
    const updated = renameSession(session.sessionId, title);
    if (!updated) {
      announce(t.history.titleUnsafe);
      return;
    }
    setRenameOpen(false);
    reload();
    announce(t.history.renamed);
    requestAnimationFrame(() => actionsRef.current?.focus());
  };

  const hasTurns = (session?.turns?.length ?? 0) > 0;

  const handleExportPdf = useCallback(async () => {
    if (!session || !hasTurns || isExporting || sessionActionBusy) return;
    if (mountedRef.current) {
      setIsExporting(true);
      setLiveMessage("");
    }
    try {
      const title = getSessionDisplayTitle(session, t, uiLanguage);
      const result = downloadInterpreterSessionPdf(session, title, t);
      if (!mountedRef.current) return;
      if (result.ok) {
        announce(t.pdf.exportSuccess);
        requestAnimationFrame(() => exportButtonRef.current?.focus());
        return;
      }
      const message =
        result.code === "no_turns"
          ? t.pdf.exportNoTurns
          : t.pdf.exportFailed;
      announce(message);
    } finally {
      if (mountedRef.current) setIsExporting(false);
    }
  }, [
    session,
    hasTurns,
    isExporting,
    sessionActionBusy,
    t,
    uiLanguage,
    announce,
    mountedRef,
  ]);

  const actionsDisabled = isExporting || sessionActionBusy;

  const inviteContext = useMemo(() => readInterpreterInviteContext(), []);

  if (!session) {
    return (
      <main className="medical-interpreter-page interp-root" id="main-content">
        <Link className="medical-interpreter-page__back" to="/patient/interpreter">
          {t.review.backToList}
        </Link>
        <h1 className="medical-interpreter-page__title">{t.review.heading}</h1>
        <p className="interpreter-live__panel-empty">{t.empty.noSession}</p>
        <Link
          className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
          to="/patient/interpreter/setup?new=1"
        >
          {t.hub.cta}
        </Link>
      </main>
    );
  }

  const canContinue =
    session.status === SESSION_STATUS_DRAFT ||
    session.status === SESSION_STATUS_ACTIVE;
  const canEnd = session.status !== SESSION_STATUS_ENDED;
  const showPracticeShare =
    session.status === SESSION_STATUS_ENDED && Boolean(inviteContext);

  return (
    <main
      className="medical-interpreter-page medical-interpreter-page--review interp-root"
      id="main-content"
    >
      <Link className="medical-interpreter-page__back" to="/patient/interpreter">
        {t.review.backToList}
      </Link>

      {liveMessage ? (
        <p className="interpreter-live__status-live" role="status" aria-live="polite">
          {liveMessage}
        </p>
      ) : null}

      {connectivity.showOfflineBanner ? (
        <InterpreterConnectivityBanner
          variant="offline"
          message={t.reliability.offlineBanner}
        />
      ) : null}

      {connectivity.showReconnectedBanner ? (
        <InterpreterConnectivityBanner
          variant="reconnected"
          message={t.reliability.reconnectedBanner}
        />
      ) : null}

      <InterpreterReviewDetail session={session} labels={t} />

      {showPracticeShare ? (
        <InterpreterPracticeSharePanel session={session} />
      ) : null}

      {cloud.canUseCloud ? (
        <InterpreterCloudSessionSync
          session={session}
          labels={t}
          accountConsent={cloud.accountConsent}
          canUseCloud={cloud.canUseCloud}
          cloudSessionIds={cloud.cloudSessionIds}
          onChanged={() => {
            reload();
            void cloud.reload();
          }}
          announce={announce}
        />
      ) : null}

      <section
        ref={actionsRef}
        className="interpreter-review__actions"
        aria-labelledby="interp-review-actions-heading"
        tabIndex={-1}
      >
        <h2 id="interp-review-actions-heading" className="interpreter-live__section-title">
          {t.sessionActions.heading}
        </h2>
        <div className="interpreter-setup__actions">
          {canContinue ? (
            <button
              type="button"
              className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
              onClick={handleContinue}
              disabled={actionsDisabled}
            >
              {t.history.continue}
            </button>
          ) : null}
          {canEnd ? (
            <button
              type="button"
              className="medical-interpreter-page__nav-link"
              onClick={handleEnd}
              disabled={actionsDisabled}
              aria-busy={sessionActionBusy}
              aria-label={t.aria.endSession}
            >
              {t.sessionActions.end}
            </button>
          ) : null}
          <button
            type="button"
            className="medical-interpreter-page__nav-link"
            onClick={() => setRenameOpen(true)}
            disabled={actionsDisabled}
            aria-label={t.aria.renameSession}
          >
            {t.history.rename}
          </button>
          <button
            type="button"
            className="medical-interpreter-page__nav-link interpreter-live__action-danger"
            onClick={handleDelete}
            disabled={actionsDisabled}
            aria-label={t.aria.deleteSession}
          >
            {t.sessionActions.delete}
          </button>
          <button
            ref={exportButtonRef}
            type="button"
            className="medical-interpreter-page__nav-link"
            onClick={() => void handleExportPdf()}
            disabled={!hasTurns || actionsDisabled}
            aria-busy={isExporting}
            aria-label={t.aria.exportConversation}
          >
            {isExporting ? t.pdf.exportLoading : t.sessionActions.export}
          </button>
        </div>
        <p className="interpreter-setup__hint">
          {hasTurns ? t.sessionActions.exportHint : t.sessionActions.exportUnavailable}
        </p>
      </section>

      <InterpreterRenameDialog
        open={renameOpen}
        initialTitle={getSessionDisplayTitle(session, t, uiLanguage)}
        title={t.history.renameTitle}
        label={t.history.renamePrompt}
        confirmLabel={t.history.renameSave}
        cancelLabel={t.confirm.cancel}
        onConfirm={handleRenameConfirm}
        onCancel={() => setRenameOpen(false)}
      />

      <InterpreterConfirmDialog
        open={confirmAction === "delete"}
        title={t.confirm.deleteTitle}
        body={t.confirm.deleteBody}
        confirmLabel={t.confirm.confirmDelete}
        cancelLabel={t.confirm.cancel}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmAction(null)}
        danger
      />

      <InterpreterConfirmDialog
        open={confirmAction === "end"}
        title={t.confirm.endTitle}
        body={t.confirm.endWithDraftBody}
        confirmLabel={t.confirm.endAnyway}
        cancelLabel={t.confirm.keepEditing}
        onConfirm={() => {
          setConfirmAction(null);
          if (!sessionActionInFlightRef.current) doEndSession();
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </main>
  );
}
