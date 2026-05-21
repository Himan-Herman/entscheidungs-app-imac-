import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import { hasInterpreterAck } from "../utils/interpreterAck.js";
import { getCurrentSession } from "../store/interpreterSessionStore.js";
import { isSessionReadyForLive } from "../utils/sessionReady.js";
import InterpreterPrivacyGate from "../components/InterpreterPrivacyGate.jsx";
import InterpreterLiveRoom from "../components/InterpreterLiveRoom.jsx";
import "../styles/MedicalInterpreter.css";

export default function InterpreterLivePage() {
  const t = useMedicalInterpreterMessages();
  const [ackReady, setAckReady] = useState(() => hasInterpreterAck());
  const session = getCurrentSession();

  useEffect(() => {
    if (ackReady) {
      document.title = t.room.pageTitle;
    }
  }, [ackReady, t.room.pageTitle]);

  if (!session || !isSessionReadyForLive(session)) {
    return <Navigate to="/patient/interpreter/setup" replace />;
  }

  if (!ackReady) {
    return <InterpreterPrivacyGate onAccepted={() => setAckReady(true)} />;
  }

  return <InterpreterLiveRoom />;
}
