import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import {
  SESSION_STATUS_ACTIVE,
  SESSION_STATUS_DRAFT,
  SESSION_STATUS_ENDED,
} from "../constants.js";
import {
  deleteSession,
  getCurrentSession,
  renameSession,
  setCurrentSessionId,
} from "../store/interpreterSessionStore.js";
import { isSessionReadyForLive } from "../utils/sessionReady.js";
import { formatInterpreterDateTime } from "../utils/formatInterpreterDate.js";
import {
  getLanguageNativeName,
  getSessionDisplayTitle,
} from "../utils/sessionDisplayTitle.js";
import { getSessionSummaryStats } from "../utils/sessionSummary.js";
import InterpreterConfirmDialog from "./InterpreterConfirmDialog.jsx";
import InterpreterRenameDialog from "./InterpreterRenameDialog.jsx";
import InterpreterCloudSessionSync from "./InterpreterCloudSessionSync.jsx";
import InterpreterCloudStatusBadge from "./InterpreterCloudStatusBadge.jsx";
import { resolveCloudSyncStatus } from "../utils/interpreterCloudSync.js";

/**
 * @param {{
 *   sessions: import('../types.js').InterpreterSession[];
 *   onChanged: () => void;
 *   announce: (message: string) => void;
 *   focusAfterDeleteRef: import('react').RefObject<HTMLAnchorElement|null>;
 *   labels: object;
 *   cloud?: ReturnType<typeof import('../hooks/useInterpreterCloud.js').useInterpreterCloud>;
 * }} props
 */
export default function InterpreterSessionHistoryList({
  sessions,
  onChanged,
  announce,
  focusAfterDeleteRef,
  labels: t,
  cloud,
}) {
  const navigate = useNavigate();
  const { language: uiLanguage } = useLanguage();
  const [deleteId, setDeleteId] = useState(null);
  const [sessionToRename, setSessionToRename] = useState(null);

  const statusLabel = (status) => {
    if (status === SESSION_STATUS_ENDED) return t.history.statusEnded;
    if (status === SESSION_STATUS_ACTIVE) return t.history.statusActive;
    return t.history.statusDraft;
  };

  const handleContinue = (sessionId) => {
    setCurrentSessionId(sessionId);
    const current = getCurrentSession();
    if (!isSessionReadyForLive(current)) {
      navigate("/patient/interpreter/setup", { replace: false });
      return;
    }
    navigate(`/patient/interpreter/live?sessionId=${encodeURIComponent(sessionId)}`);
  };

  const handleRenameConfirm = (title) => {
    if (!sessionToRename) return;
    const updated = renameSession(sessionToRename.sessionId, title);
    if (!updated) {
      announce(t.history.titleUnsafe);
      return;
    }
    setSessionToRename(null);
    onChanged();
    announce(t.history.renamed);
  };

  const handleDeleteConfirm = () => {
    if (!deleteId) return;
    const wasFirst = sessions[0]?.sessionId === deleteId;
    deleteSession(deleteId);
    setDeleteId(null);
    onChanged();
    announce(t.history.deleted);
    if (wasFirst) {
      requestAnimationFrame(() => focusAfterDeleteRef.current?.focus());
    }
  };

  if (sessions.length === 0) {
    return (
      <p className="interpreter-empty-state">{t.empty.historyEmpty}</p>
    );
  }

  return (
    <>
      <ul className="interpreter-history__list" aria-label={t.aria.historyList}>
        {sessions.map((session) => {
          const title = getSessionDisplayTitle(session, t, uiLanguage);
          const stats = getSessionSummaryStats(session);
          const turnSummary = t.history.turnCount
            .replace("{{count}}", String(stats.turnCount))
            .replace("{{translated}}", String(stats.translatedCount));
          const langPair = t.history.languagePair
            .replace("{{patient}}", getLanguageNativeName(session.patientLanguage))
            .replace("{{doctor}}", getLanguageNativeName(session.doctorLanguage));
          const canContinue =
            session.status === SESSION_STATUS_DRAFT ||
            session.status === SESSION_STATUS_ACTIVE;

          const syncStatus = cloud
            ? resolveCloudSyncStatus(session, cloud.cloudSessionIds)
            : "none";
          const cloudBadgeLabel =
            syncStatus === "synced"
              ? t.cloud.badgeSynced
              : syncStatus === "stale"
                ? t.cloud.badgeStale
                : t.cloud.badgeLocal;
          const cloudBadgeVariant =
            syncStatus === "synced"
              ? "synced"
              : syncStatus === "stale"
                ? "stale"
                : "local";

          return (
            <li key={session.sessionId} className="interpreter-history__item">
              <article className="interpreter-history__card">
                <header className="interpreter-history__card-head">
                  <h3 className="interpreter-history__card-title">{title}</h3>
                  <div className="interpreter-history__badges">
                    <span
                      className={`interpreter-history__badge interpreter-history__badge--${session.status}`}
                    >
                      {statusLabel(session.status)}
                    </span>
                    {cloud?.canUseCloud ? (
                      <InterpreterCloudStatusBadge
                        variant={cloudBadgeVariant}
                        label={cloudBadgeLabel}
                      />
                    ) : null}
                  </div>
                </header>
                <p className="interpreter-history__card-meta">
                  <time dateTime={session.createdAt}>
                    {formatInterpreterDateTime(session.createdAt)}
                  </time>
                </p>
                <p className="interpreter-history__card-langs">{langPair}</p>
                {stats.turnCount > 0 ? (
                  <p className="interpreter-history__card-stats">{turnSummary}</p>
                ) : null}
                {cloud?.canUseCloud ? (
                  <InterpreterCloudSessionSync
                    session={session}
                    labels={t}
                    accountConsent={cloud.accountConsent}
                    canUseCloud={cloud.canUseCloud}
                    cloudSessionIds={cloud.cloudSessionIds}
                    onChanged={() => {
                      onChanged();
                      void cloud.reload();
                    }}
                    announce={announce}
                    compact
                  />
                ) : null}
                <div className="interpreter-history__card-actions">
                  {canContinue ? (
                    <button
                      type="button"
                      className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary interpreter-history__btn"
                      onClick={() => handleContinue(session.sessionId)}
                    >
                      {t.history.continue}
                    </button>
                  ) : null}
                  <Link
                    className="medical-interpreter-page__nav-link interpreter-history__btn"
                    to={`/patient/interpreter/review?sessionId=${encodeURIComponent(session.sessionId)}`}
                  >
                    {t.history.review}
                  </Link>
                  <button
                    type="button"
                    className="medical-interpreter-page__nav-link interpreter-history__btn"
                    onClick={() => setSessionToRename(session)}
                    aria-label={t.aria.renameSession}
                  >
                    {t.history.rename}
                  </button>
                  <button
                    type="button"
                    className="medical-interpreter-page__nav-link interpreter-live__action-danger interpreter-history__btn"
                    onClick={() => setDeleteId(session.sessionId)}
                    aria-label={t.aria.deleteSession}
                  >
                    {t.sessionActions.delete}
                  </button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      <InterpreterRenameDialog
        open={sessionToRename != null}
        initialTitle={
          sessionToRename ? getSessionDisplayTitle(sessionToRename, t) : ""
        }
        title={t.history.renameTitle}
        label={t.history.renamePrompt}
        confirmLabel={t.history.renameSave}
        cancelLabel={t.confirm.cancel}
        onConfirm={handleRenameConfirm}
        onCancel={() => setSessionToRename(null)}
      />

      <InterpreterConfirmDialog
        open={deleteId != null}
        title={t.confirm.deleteTitle}
        body={t.cloud.deleteLocalOnlyBody}
        confirmLabel={t.confirm.confirmDelete}
        cancelLabel={t.confirm.cancel}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        danger
      />
    </>
  );
}
