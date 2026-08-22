import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { PracticeContextValue } from "./practiceContextValue.js";
import { fetchPatientPracticeLink } from "./api/practiceContextApi.js";
import {
  CONTEXT_STATE,
  isContextActive,
  isContextOpenable,
  resolveContextIdentity,
} from "./lib/contextIdentity.js";

/**
 * The one practice context a practice-scoped patient page runs in.
 *
 * DESIGN
 * ------
 * - The URL owns the context. `/patient/practice/:linkId/...` names it, so
 *   refresh, deep link, browser back and a second tab are all deterministic
 *   without any stored state. Nothing is written to localStorage: two tabs must
 *   be able to sit in two different practices at the same time.
 * - The server validates it. The route id is resolved against the patient's own
 *   relationships before anything is shown; a link the patient does not hold
 *   yields NOT_FOUND with no hint about whose it is.
 * - There is no fallback. If the context cannot be established, the answer is an
 *   explicit state, never "then use the last practice" — that is exactly how one
 *   practice's data ends up under another practice's URL.
 * - It carries the minimum: the authorized link id, the display metadata a
 *   header needs, and the state. Not the patient record, not the practice
 *   record.
 *
 * The id here is convenience for routing and display. It grants nothing: every
 * request is authorized independently by the server.
 */

export function PracticeContextProvider({ children }) {
  const { linkId: routeLinkId } = useParams();
  const { linkId } = useMemo(
    () => resolveContextIdentity({ routeLinkId }),
    [routeLinkId],
  );

  const [state, setState] = useState(CONTEXT_STATE.IDLE);
  const [link, setLink] = useState(null);

  const load = useCallback(async () => {
    if (!linkId) {
      setLink(null);
      setState(CONTEXT_STATE.NOT_FOUND);
      return;
    }

    // A context switch must never leave the previous practice on screen while
    // the new one loads, so the old value is dropped BEFORE the request starts.
    setLink(null);
    setState(CONTEXT_STATE.LOADING);

    let cancelled = false;
    try {
      const { res, data } = await fetchPatientPracticeLink(linkId);
      if (cancelled) return;

      if (res.status === 404 || !data?.ok || !data.link) {
        setState(CONTEXT_STATE.NOT_FOUND);
        return;
      }
      if (!isContextOpenable(data.link.status)) {
        setState(CONTEXT_STATE.NOT_FOUND);
        return;
      }
      setLink(data.link);
      setState(CONTEXT_STATE.READY);
    } catch (err) {
      if (cancelled) return;
      if (err?.message === "SESSION_EXPIRED") return;
      setState(CONTEXT_STATE.ERROR);
    }
    return () => {
      cancelled = true;
    };
  }, [linkId]);

  useEffect(() => {
    let alive = true;
    // The guard mirrors the one in useScopedRequest: a validation response for
    // the previous link must not establish a context that is no longer current.
    (async () => {
      await load();
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const value = useMemo(
    () => ({
      /** The authorized care relationship. The context key everywhere. */
      linkId,
      state,
      isReady: state === CONTEXT_STATE.READY,
      /** Display metadata only. */
      practice: link?.practice ?? null,
      /**
       * Which person this relationship is for — null when it is the account
       * holder's own. Display only: the context key stays `linkId`.
       */
      patientProfileName: link?.patientProfile?.displayName ?? null,
      relationshipStatus: link?.status ?? null,
      /** Presentation hint: may the patient still act, or only look? */
      isActiveRelationship: isContextActive(link?.status),
      reload: load,
    }),
    [linkId, state, link, load],
  );

  return (
    <PracticeContextValue.Provider value={value}>{children}</PracticeContextValue.Provider>
  );
}
