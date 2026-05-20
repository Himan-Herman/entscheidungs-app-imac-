import { useCallback, useMemo, useState } from "react";
import { CHAT_KIND_BODY_MAP, CHAT_KIND_SYMPTOM_CHECK } from "../constants.js";
import {
  deleteSession,
  getActiveSessionId,
  listSessions,
  setActiveSession,
} from "../store.js";
import { buildSessionTitle } from "../sessionUtils.js";

/**
 * @param {object} opts
 * @param {typeof CHAT_KIND_BODY_MAP | typeof CHAT_KIND_SYMPTOM_CHECK} opts.kind
 * @param {string | null} [opts.organFilter]
 * @param {'de'|'en'} opts.language
 * @param {Record<string, string>} opts.labels
 */
export function usePatientChatHistory({ kind, organFilter = null, language, labels }) {
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);

  const sessions = useMemo(() => {
    void revision;
    const raw = listSessions(kind, { organFilter: organFilter || undefined });
    return raw.map((s) => ({
      ...s,
      displayTitle: buildSessionTitle(s, language, labels),
    }));
  }, [kind, organFilter, language, labels, revision]);

  const activeId = useMemo(() => {
    void revision;
    return getActiveSessionId(kind);
  }, [kind, revision]);

  const openSession = useCallback(
    (id) => {
      setActiveSession(kind, id);
      bump();
      return id;
    },
    [kind, bump],
  );

  const removeSession = useCallback(
    (id) => {
      const nextActive = deleteSession(kind, id);
      bump();
      return nextActive;
    },
    [kind, bump],
  );

  return {
    sessions,
    activeId,
    refresh: bump,
    openSession,
    removeSession,
  };
}

export { CHAT_KIND_BODY_MAP, CHAT_KIND_SYMPTOM_CHECK };
