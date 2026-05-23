import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import { hasInterpreterAck } from "../utils/interpreterAck.js";
import {
  getCurrentSession,
  getLatestSession,
  getSession,
  setCurrentSessionId,
} from "../store/interpreterSessionStore.js";
import { isSessionReadyForLive } from "../utils/sessionReady.js";
import InterpreterPrivacyGate from "../components/InterpreterPrivacyGate.jsx";
import InterpreterLiveRoom from "../components/InterpreterLiveRoom.jsx";
import "../styles/MedicalInterpreter.css";

function resolveLiveSession(sessionId) {
  const fromUrl = sessionId ? getSession(sessionId) : null;
  if (isSessionReadyForLive(fromUrl)) return fromUrl;

  const current = getCurrentSession();
  if (isSessionReadyForLive(current)) return current;

  const latest = getLatestSession();
  if (isSessionReadyForLive(latest)) return latest;

  return fromUrl || current || latest || null;
}

export default function InterpreterLivePage() {
  const t = useMedicalInterpreterMessages();
  const [ackReady, setAckReady] = useState(() => hasInterpreterAck());
  const [searchParams] = useSearchParams();
  const sessionIdParam = searchParams.get("sessionId")?.trim() || "";
  const session = useMemo(
    () => resolveLiveSession(sessionIdParam),
    [sessionIdParam],
  );
  const sessionReady = isSessionReadyForLive(session);

  useEffect(() => {
    if (ackReady) {
      document.title = t.room.pageTitle;
    }
  }, [ackReady, t.room.pageTitle]);

  useEffect(() => {
    if (session?.sessionId) {
      setCurrentSessionId(session.sessionId);
    }
  }, [session?.sessionId]);

  if (!ackReady) {
    return <InterpreterPrivacyGate onAccepted={() => setAckReady(true)} />;
  }

  if (!sessionReady) {
    return (
      <main className="medical-interpreter-page interp-root" id="main-content">
        <Link className="medical-interpreter-page__back" to="/patient/interpreter">
          {t.chrome.backToInterpreterHome}
        </Link>

        <h1 className="medical-interpreter-page__title">{t.room.heading}</h1>
        <div className="interpreter-feedback interpreter-feedback--error" role="alert">
          {t.errors.sessionNotFound}
        </div>
        <p className="interpreter-prose">{t.reliability.recoveryBody}</p>

        <div className="interpreter-recovery__actions">
          <Link
            className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
            to="/patient/interpreter/setup?new=1"
          >
            {t.start.start}
          </Link>
          <Link className="medical-interpreter-page__nav-link" to="/patient/interpreter">
            {t.reliability.errorBoundaryBack}
          </Link>
        </div>
      </main>
    );
  }

  return <InterpreterLiveRoom sessionId={session.sessionId} />;
}
