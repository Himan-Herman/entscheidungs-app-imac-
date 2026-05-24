import { Navigate } from "react-router-dom";

/** Legacy route — local history is now a section inside Meine Vorbereitungen. */
export default function PreVisitHistoryPage() {
  return <Navigate to="/pre-visit/my-preparations#device-storage" replace />;
}
