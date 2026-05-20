import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../../api/authFetch.js";
import {
  CHAT_KIND_BODY_MAP,
} from "../../patientChatHistory/constants.js";
import {
  createSession,
  getActiveSessionId,
  getSession,
  listSessions,
  migrateLegacyIfNeeded,
  setActiveSession,
  upsertSession,
  deleteSession,
  clearLegacyKeys,
} from "../../patientChatHistory/store.js";
import {
  BODY_MAP_THREAD_API,
  LOADING_MARKER,
  LS_CHAT_KEY,
  LS_SUMMARY_KEY,
  LS_THREAD_KEY,
  MAX_BODY_MAP_CHARS,
} from "../constants.js";

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function introExistsForOrgan(messages, organKey) {
  return messages.some(
    (m) => m.role === "assistant" && m.bodyMapIntro && m.introOrgan === organKey,
  );
}

function buildIntroMessage(organ, organLabel, introText) {
  return {
    role: "assistant",
    content: introText.replace(/\{\{region\}\}/g, organLabel),
    bodyMapIntro: true,
    introOrgan: organ,
  };
}

function sessionToState(session) {
  return {
    sessionId: session.id,
    verlauf: session.verlauf || [],
    threadId: session.threadId || "",
    summary: session.summary || null,
    organ: session.organ || null,
    organLabel: session.organLabel || "",
    seite: session.seite || "vorderseite",
  };
}

export function findOrCreateBodyMapSession(organ, organLabel, seite, language) {
  const legacy = {
    verlauf: readJsonStorage(LS_CHAT_KEY, []),
    threadId: (() => {
      try {
        return localStorage.getItem(LS_THREAD_KEY) || "";
      } catch {
        return "";
      }
    })(),
    summary: readJsonStorage(LS_SUMMARY_KEY, null),
  };

  migrateLegacyIfNeeded(CHAT_KIND_BODY_MAP, {
    legacy,
    buildSession: (id) => ({
      id,
      kind: CHAT_KIND_BODY_MAP,
      verlauf: legacy.verlauf,
      threadId: legacy.threadId || null,
      summary: legacy.summary,
      organ,
      organLabel,
      seite,
      language,
      createdAt: new Date().toISOString(),
    }),
  });

  clearLegacyKeys([LS_CHAT_KEY, LS_THREAD_KEY, LS_SUMMARY_KEY]);

  const activeId = getActiveSessionId(CHAT_KIND_BODY_MAP);
  if (activeId) {
    const active = getSession(CHAT_KIND_BODY_MAP, activeId);
    if (active && (!organ || active.organ === organ)) {
      return active;
    }
  }

  if (organ) {
    const forOrgan = listSessions(CHAT_KIND_BODY_MAP, { organFilter: organ });
    if (forOrgan.length > 0) {
      const latest = forOrgan[0];
      setActiveSession(CHAT_KIND_BODY_MAP, latest.id);
      return latest;
    }
  }

  return createSession(CHAT_KIND_BODY_MAP, {
    organ,
    organLabel,
    seite,
    language,
    verlauf: [],
  });
}

/**
 * @param {object} opts
 * @param {string} opts.initialSessionId
 * @param {import('../bodyMapTypes.js').BodyMapChatMessage[]} opts.initialVerlauf
 * @param {string} opts.initialThreadId
 * @param {import('../bodyMapTypes.js').BodyMapSummary | null} opts.initialSummary
 * @param {string | null} opts.organ
 * @param {string} opts.organLabel
 * @param {string} opts.seite
 * @param {'de'|'en'} opts.language
 * @param {Record<string, string>} opts.tc
 */
export function useBodyMapChat({
  initialSessionId = "",
  initialVerlauf = [],
  initialThreadId = "",
  initialSummary = null,
  organ,
  organLabel,
  seite = "vorderseite",
  language,
  tc,
}) {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [eingabe, setEingabe] = useState("");
  const [verlauf, setVerlauf] = useState(initialVerlauf);
  const [threadId, setThreadId] = useState(initialThreadId);
  const [summary, setSummary] = useState(initialSummary);
  const [isSending, setIsSending] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [errorKey, setErrorKey] = useState(null);
  const lastIntroOrganRef = useRef(null);
  const createdAtRef = useRef(
    getSession(CHAT_KIND_BODY_MAP, initialSessionId)?.createdAt ||
      new Date().toISOString(),
  );

  const userTurnCount = verlauf.filter((m) => m.role === "user").length;

  const persistSession = useCallback(() => {
    if (!sessionId) return;
    upsertSession({
      id: sessionId,
      kind: CHAT_KIND_BODY_MAP,
      createdAt: createdAtRef.current,
      verlauf,
      threadId: threadId || null,
      summary,
      organ,
      organLabel,
      seite,
      language,
    });
  }, [sessionId, verlauf, threadId, summary, organ, organLabel, seite, language]);

  useEffect(() => {
    persistSession();
  }, [persistSession]);

  useEffect(() => {
    if (!organ) return;
    setVerlauf((prev) => {
      if (introExistsForOrgan(prev, organ)) {
        lastIntroOrganRef.current = organ;
        return prev;
      }
      if (lastIntroOrganRef.current === organ) return prev;
      lastIntroOrganRef.current = organ;
      return [...prev, buildIntroMessage(organ, organLabel, tc.introAssistant)];
    });
  }, [organ, organLabel, tc.introAssistant]);

  const buildPayloadVerlauf = useCallback(
    (userMsg, forSummary = false) => {
      const base = verlauf.filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          m.content &&
          m.content !== LOADING_MARKER &&
          !m.loading,
      );

      if (forSummary) {
        return [...base, userMsg];
      }

      if (!threadId && organ) {
        return [
          {
            role: "user",
            content: `[Body map] Region: "${organ}". Neutral visit notes only.`,
          },
          userMsg,
        ];
      }
      return [userMsg];
    },
    [organ, threadId, verlauf],
  );

  const postToThread = useCallback(
    async ({ userMsg, intent = "chat" }) => {
      const payload = {
        threadId: threadId || null,
        organName: organ || organLabel,
        patientLanguage: language,
        intent,
        verlauf:
          intent === "summary"
            ? buildPayloadVerlauf(userMsg, true)
            : buildPayloadVerlauf(userMsg, false),
      };

      const response = await authFetch(BODY_MAP_THREAD_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        const err = new Error(data.error || "koerpersymptom_failed");
        err.code = data.error || "koerpersymptom_failed";
        err.status = response.status;
        throw err;
      }
      return data;
    },
    [buildPayloadVerlauf, language, organ, organLabel, threadId],
  );

  const sendMessage = useCallback(
    async (textOverride) => {
      const raw = typeof textOverride === "string" ? textOverride : eingabe;
      const text = (raw || "").trim();
      if (!text || isSending || isSummarizing) return;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setErrorKey("offlineError");
        return;
      }

      setErrorKey(null);
      setSummary(null);

      const userMsg = { role: "user", content: text };
      const basisVerlauf = [...verlauf, userMsg];
      setVerlauf([...basisVerlauf, { role: "assistant", content: LOADING_MARKER, loading: true }]);
      setEingabe("");
      setIsSending(true);

      try {
        const data = await postToThread({ userMsg, intent: "chat" });
        if (data.threadId) setThreadId(data.threadId);

        setVerlauf([
          ...basisVerlauf,
          { role: "assistant", content: data.antwort || "…" },
        ]);
      } catch {
        setErrorKey("serverError");
        setVerlauf([
          ...basisVerlauf,
          { role: "assistant", content: tc.serverError },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [eingabe, isSending, isSummarizing, postToThread, tc.serverError, verlauf],
  );

  const requestSummary = useCallback(async () => {
    if (userTurnCount < 1 || isSending || isSummarizing) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setErrorKey("offlineError");
      return;
    }

    setErrorKey(null);
    setIsSummarizing(true);

    try {
      const data = await postToThread({
        userMsg: {
          role: "user",
          content:
            language === "en"
              ? "Please create the final neutral summary for my doctor visit."
              : "Bitte erstellen Sie die neutrale Zusammenfassung für meinen Arzttermin.",
        },
        intent: "summary",
      });

      if (data.threadId) setThreadId(data.threadId);

      if (data.summary) {
        setSummary(data.summary);
      } else if (data.antwort) {
        setSummary({
          region: organLabel,
          symptomSummary: data.antwort,
          timeline: "",
          associatedFactors: "",
          specialties: [],
          visitTopics: [],
        });
      }

      if (data.antwort) {
        setVerlauf((prev) => [
          ...prev.filter((m) => !m.loading),
          { role: "assistant", content: data.antwort },
        ]);
      }
    } catch {
      setErrorKey("summaryError");
    } finally {
      setIsSummarizing(false);
    }
  }, [
    isSending,
    isSummarizing,
    language,
    organLabel,
    postToThread,
    userTurnCount,
    verlauf,
  ]);

  const applySession = useCallback(
    (session) => {
      if (!session) return null;
      setActiveSession(CHAT_KIND_BODY_MAP, session.id);
      createdAtRef.current = session.createdAt;
      setSessionId(session.id);
      setVerlauf(session.verlauf || []);
      setThreadId(session.threadId || "");
      setSummary(session.summary || null);
      setEingabe("");
      setErrorKey(null);
      lastIntroOrganRef.current = session.organ || null;
      return session;
    },
    [],
  );

  const prevOrganRef = useRef(organ);
  useEffect(() => {
    if (!organ) return;
    if (prevOrganRef.current === organ) return;
    prevOrganRef.current = organ;
    const session = findOrCreateBodyMapSession(organ, organLabel, seite, language);
    applySession(session);
  }, [organ, seite, organLabel, language, applySession]);

  const startNewConversation = useCallback(() => {
    persistSession();
    const intro = organ
      ? [buildIntroMessage(organ, organLabel, tc.introAssistant)]
      : [];
    const sess = createSession(CHAT_KIND_BODY_MAP, {
      organ,
      organLabel,
      seite,
      language,
      verlauf: intro,
      threadId: null,
      summary: null,
    });
    createdAtRef.current = sess.createdAt;
    setSessionId(sess.id);
    setVerlauf(intro);
    setThreadId("");
    setSummary(null);
    setEingabe("");
    setErrorKey(null);
    if (organ) lastIntroOrganRef.current = organ;
    return sess;
  }, [organ, organLabel, seite, language, persistSession, tc.introAssistant]);

  const openSession = useCallback(
    (id) => {
      const session = getSession(CHAT_KIND_BODY_MAP, id);
      return applySession(session);
    },
    [applySession],
  );

  const deleteConversation = useCallback(
    (id) => {
      const targetId = id || sessionId;
      if (!targetId) return null;
      const wasActive = targetId === sessionId;
      const nextActiveId = deleteSession(CHAT_KIND_BODY_MAP, targetId);

      if (!wasActive) return nextActiveId;

      if (nextActiveId) {
        const next = getSession(CHAT_KIND_BODY_MAP, nextActiveId);
        applySession(next);
        return next;
      }

      const sess = createSession(CHAT_KIND_BODY_MAP, {
        organ,
        organLabel,
        seite,
        language,
        verlauf: organ ? [buildIntroMessage(organ, organLabel, tc.introAssistant)] : [],
      });
      applySession(sess);
      return sess;
    },
    [
      sessionId,
      organ,
      organLabel,
      seite,
      language,
      applySession,
      tc.introAssistant,
    ],
  );

  const clearChat = useCallback(() => {
    setSummary(null);
    if (organ) {
      const intro = buildIntroMessage(organ, organLabel, tc.introAssistant);
      setVerlauf([intro]);
      lastIntroOrganRef.current = organ;
    } else {
      setVerlauf([]);
    }
    setThreadId("");
  }, [organ, organLabel, tc.introAssistant]);

  return {
    sessionId,
    eingabe,
    setEingabe,
    verlauf,
    threadId,
    summary,
    isSending,
    isSummarizing,
    errorKey,
    setErrorKey,
    sendMessage,
    requestSummary,
    clearChat,
    startNewConversation,
    openSession,
    deleteConversation,
    userTurnCount,
    maxChars: MAX_BODY_MAP_CHARS,
  };
}

export function loadBodyMapChatState({ organ, organLabel, seite, language }) {
  const session = findOrCreateBodyMapSession(organ, organLabel, seite, language);
  return sessionToState(session);
}
