import PatientDataControlPage from "../../careRelationship/pages/PatientDataControlPage.jsx";
import { usePracticeContext } from "../usePracticeContext.js";

/**
 * "Meine Daten & Freigaben" for the ONE practice in context. The page itself is
 * shared with the cross-practice view; scoping is done by the server (the
 * request carries the link id) and the page keeps every link inside this area.
 */
export default function PracticeContextDataControlPage() {
  const { linkId } = usePracticeContext();
  return <PatientDataControlPage scopedLinkId={linkId} />;
}
