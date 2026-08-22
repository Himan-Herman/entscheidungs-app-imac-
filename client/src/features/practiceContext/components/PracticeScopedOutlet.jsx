import { Outlet, useParams } from "react-router-dom";
import { PracticeContextProvider } from "../PracticeContext.jsx";
import { usePracticeContext } from "../usePracticeContext.js";
import { CONTEXT_STATE } from "../lib/contextIdentity.js";
import PracticeContextBar from "./PracticeContextBar.jsx";
import "../practiceContext.css";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";

/**
 * Renders the practice-scoped area, and nothing of it until the context is
 * established.
 *
 * THE HARD GUARANTEE
 * ------------------
 * The route element below is mounted with `key={linkId}`. On a context switch
 * React unmounts the entire subtree and mounts a fresh one, so every piece of
 * component state from the previous practice is destroyed rather than
 * overwritten. With no query library in this codebase that is the strongest
 * available isolation: there is no cache left holding the old practice's data,
 * because there is no surviving component to hold it.
 *
 * Children are rendered ONLY in the READY state, so the previous practice's data
 * can never be on screen while a new practice name is in the header — not even
 * for a frame.
 */
function ScopedGate() {
  const { state } = usePracticeContext();
  const { language } = useLanguage();
  const t =
    getMessages(language).practiceContext || getMessages("en").practiceContext;

  if (state === CONTEXT_STATE.LOADING || state === CONTEXT_STATE.IDLE) {
    return (
      <div className="practice-context__state" role="status" aria-live="polite">
        {t.loading}
      </div>
    );
  }

  if (state === CONTEXT_STATE.NOT_FOUND) {
    // Deliberately identical for "does not exist" and "not yours", mirroring the
    // server convention. No hint about whom the link belongs to.
    return (
      <div className="practice-context__state" role="alert">
        <h1 className="practice-context__state-title">{t.notFoundTitle}</h1>
        <p>{t.notFoundBody}</p>
      </div>
    );
  }

  if (state === CONTEXT_STATE.ERROR) {
    return (
      <div className="practice-context__state" role="alert">
        <h1 className="practice-context__state-title">{t.errorTitle}</h1>
        <p>{t.errorBody}</p>
      </div>
    );
  }

  // The bar renders only in READY, alongside the content, so the context shown
  // and the data shown always come from the same practice.
  return (
    <>
      <PracticeContextBar />
      <Outlet />
    </>
  );
}

export default function PracticeScopedOutlet() {
  const { linkId } = useParams();
  // key -> a switch destroys the previous subtree instead of updating it.
  return (
    <PracticeContextProvider key={linkId}>
      <ScopedGate />
    </PracticeContextProvider>
  );
}
