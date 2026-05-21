import { Navigate, useParams } from "react-router-dom";

/** Phase 4.6 links used `/interpreter/invite/:token` — redirect to `/i/interpreter/:token`. */
export default function InterpreterInviteLegacyRedirect() {
  const { token } = useParams();
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={`/i/interpreter/${encodeURIComponent(token)}`} replace />;
}
