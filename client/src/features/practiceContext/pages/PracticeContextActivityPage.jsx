import PatientActivityPage from "../../activity/pages/PatientActivityPage.jsx";
import { usePracticeContext } from "../usePracticeContext.js";

/**
 * "Meine Aktivität" for the ONE practice in context: the shared activity page
 * with its practice filter fixed to this relationship (server-side filter).
 */
export default function PracticeContextActivityPage() {
  const { linkId } = usePracticeContext();
  return <PatientActivityPage scopedLinkId={linkId} />;
}
