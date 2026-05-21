import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import InterpreterConfirmDialog from "../components/InterpreterConfirmDialog.jsx";
import InterpreterHistorySearch from "../components/InterpreterHistorySearch.jsx";
import InterpreterSessionHistoryList from "../components/InterpreterSessionHistoryList.jsx";
import InterpreterCloudDataControlPanel from "../components/InterpreterCloudDataControlPanel.jsx";
import { useInterpreterCloud } from "../hooks/useInterpreterCloud.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { filterSessionsForHistory } from "../utils/sessionSummary.js";
import {
  clearAllInterpreterSessions,
  listSessions,
} from "../store/interpreterSessionStore.js";
import {
  SESSION_STATUS_ACTIVE,
  SESSION_STATUS_DRAFT,
} from "../constants.js";
import "../styles/MedicalInterpreter.css";

export default function InterpreterHomePage() {
  const t = useMedicalInterpreterMessages();
  const [storeTick, setStoreTick] = useState(0);
  const [liveMessage, setLiveMessage] = useState("");
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const focusAfterDeleteRef = useRef(null);
  const { language: uiLanguage } = useLanguage();
  const cloud = useInterpreterCloud();

  const allSessions = useMemo(() => {
    void storeTick;
    return listSessions();
  }, [storeTick]);

  const sessions = useMemo(
    () => filterSessionsForHistory(allSessions, searchQuery, t, uiLanguage),
    [allSessions, searchQuery, t, uiLanguage],
  );

  const hasResumableSession = useMemo(
    () =>
      allSessions.some(
        (s) =>
          s.status === SESSION_STATUS_DRAFT || s.status === SESSION_STATUS_ACTIVE,
      ),
    [allSessions],
  );

  const reload = useCallback(() => {
    setStoreTick((n) => n + 1);
  }, []);

  const announce = useCallback((message) => {
    setLiveMessage("");
    requestAnimationFrame(() => setLiveMessage(message));
  }, []);

  useEffect(() => {
    document.title = t.start.pageTitle;
  }, [t.start.pageTitle]);

  const handleClearAllConfirm = () => {
    clearAllInterpreterSessions();
    setClearAllOpen(false);
    reload();
    announce(t.history.cleared);
    requestAnimationFrame(() => focusAfterDeleteRef.current?.focus());
  };

  return (
    <main className="medical-interpreter-page interp-root" id="main-content">
      <Link
        ref={focusAfterDeleteRef}
        className="medical-interpreter-page__back"
        to="/patient"
      >
        {t.chrome.backToHub}
      </Link>

      <h1 className="medical-interpreter-page__title">{t.start.heading}</h1>
      <p className="medical-interpreter-page__intro">{t.start.intro}</p>

      <p className="medical-interpreter-safety" role="note">
        {t.safety.strip}
      </p>

      {liveMessage ? (
        <p className="interpreter-live__status-live" role="status" aria-live="polite">
          {liveMessage}
        </p>
      ) : null}

      <nav className="interpreter-home__primary-nav" aria-label={t.hub.cta}>
        <Link
          className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
          to={
            hasResumableSession
              ? "/patient/interpreter/setup"
              : "/patient/interpreter/setup?new=1"
          }
        >
          {t.hub.cta}
        </Link>
        {allSessions.length > 0 ? (
          <div className="interpreter-home__secondary-nav">
            <Link
              className="medical-interpreter-page__nav-link"
              to="/patient/interpreter/setup?new=1"
            >
              {t.hub.newConversation}
            </Link>
          </div>
        ) : null}
      </nav>

      <InterpreterCloudDataControlPanel
        labels={t}
        announce={announce}
        onCloudChanged={reload}
      />

      <section
        className="interpreter-home__history"
        aria-labelledby="interp-history-heading"
      >
        <h2 id="interp-history-heading" className="interpreter-live__section-title">
          {t.history.heading}
        </h2>
        <p className="interpreter-home__privacy-note" role="note">
          {t.history.privacyNote}
        </p>

        {allSessions.length > 0 ? (
          <InterpreterHistorySearch
            value={searchQuery}
            onChange={setSearchQuery}
            resultCount={sessions.length}
            totalCount={allSessions.length}
            labels={t}
          />
        ) : null}

        {searchQuery.trim() && sessions.length === 0 && allSessions.length > 0 ? (
          <p className="interpreter-empty-state">{t.history.noSearchResults}</p>
        ) : null}

        <InterpreterSessionHistoryList
          sessions={sessions}
          onChanged={reload}
          announce={announce}
          focusAfterDeleteRef={focusAfterDeleteRef}
          labels={t}
          cloud={cloud}
        />

        {allSessions.length > 0 ? (
          <button
            type="button"
            className="medical-interpreter-page__nav-link interpreter-live__action-danger interpreter-home__clear-all"
            onClick={() => setClearAllOpen(true)}
            aria-label={t.aria.clearAllHistory}
          >
            {t.history.clearAll}
          </button>
        ) : null}
      </section>

      <InterpreterConfirmDialog
        open={clearAllOpen}
        title={t.confirm.clearAllTitle}
        body={t.confirm.clearAllBody}
        confirmLabel={t.confirm.confirmClearAll}
        cancelLabel={t.confirm.cancel}
        onConfirm={handleClearAllConfirm}
        onCancel={() => setClearAllOpen(false)}
        danger
      />
    </main>
  );
}
