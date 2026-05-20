import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../../api/authFetch.js";
import { CHAT_KIND_SYMPTOM_CHECK } from "../../patientChatHistory/constants.js";
import {
  createSession,
  getActiveSessionId,
  getSession,
  migrateLegacyIfNeeded,
  setActiveSession,
  upsertSession,
  deleteSession,
  clearLegacyKeys,
} from "../../patientChatHistory/store.js";
import {
  LOADING_MARKER,
  LS_CONSENT_KEY,
  LS_SUMMARY_KEY,
  LS_THREAD_KEY,
  LS_VERLAUF_KEY,
  MAX_SYMPTOM_CHARS,
  SYMPTOM_THREAD_API,
} from "../constants.js";

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function introExists(messages) {
  return messages.some((m) => m.role === "assistant" && m.symptomIntro);
}

function buildIntroMessage(organHint, t) {
  const introContent = organHint
    ? t.introWithOrgan.replace(/\{\{organ\}\}/g, organHint)
    : t.introAssistant;
  return { role: "assistant", content: introContent, symptomIntro: true };
}

function pickSymptomSession(organHint, language) {
  const legacy = {
    verlauf: readJsonStorage(LS_VERLAUF_KEY, []),
    threadId: (() => {
      try {
        const raw = localStorage.getItem(LS_THREAD_KEY);
        return raw && raw !== "null" && raw !== "undefined" ? raw : null;
      } catch {
        return null;
      }
    })(),
    summary: readJsonStorage(LS_SUMMARY_KEY, null),
  };

  migrateLegacyIfNeeded(CHAT_KIND_SYMPTOM_CHECK, {
    legacy,
    buildSession: (id) => ({
      id,
      kind: CHAT_KIND_SYMPTOM_CHECK,
      verlauf: legacy.verlauf,
      threadId: legacy.threadId,
      summary: legacy.summary,
      organHint,
      language,
      createdAt: new Date().toISOString(),
    }),
  });

  clearLegacyKeys([LS_VERLAUF_KEY, LS_THREAD_KEY, LS_SUMMARY_KEY]);

  const activeId = getActiveSessionId(CHAT_KIND_SYMPTOM_CHECK);
  if (activeId) {
    const active = getSession(CHAT_KIND_SYMPTOM_CHECK, activeId);
    if (active) return active;
  }

  return createSession(CHAT_KIND_SYMPTOM_CHECK, {
    organHint,
    language,
    verlauf: [],
  });
}

/**
 * @param {object} opts
 */
export function useSymptomCheckChat({
  initialSessionId = "",
  initialVerlauf = [],
  initialThreadId = null,
  initialSummary = null,
  organHint = null,
  language,
  t,
  consentOk,
}) {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [eingabe, setEingabe] = useState("");
  const [verlauf, setVerlauf] = useState(initialVerlauf);
  const [threadId, setThreadId] = useState(initialThreadId);
  const [summary, setSummary] = useState(initialSummary);
  const [isSending, setIsSending] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [errorKey, setErrorKey] = useState(null);
  const introAddedRef = useRef(initialVerlauf.some((m) => m.symptomIntro));
  const createdAtRef = useRef(
    getSession(CHAT_KIND_SYMPTOM_CHECK, initialSessionId)?.createdAt ||
      new Date().toISOString(),
  );

  const userTurnCount = verlauf.filter((m) => m.role === "user").length;

  const persistSession = useCallback(() => {
    if (!consentOk || !sessionId) return;
    upsertSession({
      id: sessionId,
      kind: CHAT_KIND_SYMPTOM_CHECK,
      createdAt: createdAtRef.current,
      verlauf,
      threadId,
      summary,
      organHint,
      language,
    });
  }, [consentOk, sessionId, verlauf, threadId, summary, organHint, language]);

  useEffect(() => {
    persistSession();
  }, [persistSession]);

  useEffect(() => {
    if (!consentOk) return;
    setVerlauf((prev) => {
      if (introExists(prev) || introAddedRef.current) {
        introAddedRef.current = true;
        return prev;
      }
      introAddedRef.current = true;
      return [...prev, buildIntroMessage(organHint, t)];
    });
  }, [consentOk, organHint, t]);

  const transcript = useCallback(
    () =>
      verlauf.filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          m.content &&
          m.content !== LOADING_MARKER &&
          !m.loading,
      ),
    [verlauf],
  );

  const postToThread = useCallback(
    async ({ userMsg, intent = "chat" }) => {
      const payload = {
        threadId: threadId || null,
        patientLanguage: language,
        organHint,
        intent,
        userTurnCount: intent === "chat" ? userTurnCount + 1 : userTurnCount,
        verlauf:
          intent === "summary"
            ? [...transcript(), userMsg]
            : [userMsg],
      };

      const response = await authFetch(SYMPTOM_THREAD_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        const err = new Error(data.error || data.fehler || "symptom_check_failed");
        err.code = data.error || data.fehler;
        throw err;
      }
      return data;
    },
    [language, organHint, threadId, transcript, userTurnCount],
  );

  const sendMessage = useCallback(
    async (textOverride) => {
      if (!consentOk) return;
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
      setVerlauf([
        ...basisVerlauf,
        { role: "assistant", content: LOADING_MARKER, loading: true },
      ]);
      setEingabe("");
      setIsSending(true);

      try {
        const data = await postToThread({ userMsg, intent: "chat" });
        if (data.threadId) setThreadId(data.threadId);

        setVerlauf([
          ...basisVerlauf,
          { role: "assistant", content: data.antwort || t.serverError },
        ]);
      } catch {
        setErrorKey("serverError");
        setVerlauf([
          ...basisVerlauf,
          { role: "assistant", content: t.serverError },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [
      consentOk,
      eingabe,
      isSending,
      isSummarizing,
      postToThread,
      t.serverError,
      verlauf,
    ],
  );

  const requestSummary = useCallback(async () => {
    if (!consentOk || userTurnCount < 1 || isSending || isSummarizing) return;
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
          content: t.summaryRequestUser,
        },
        intent: "summary",
      });

      if (data.threadId) setThreadId(data.threadId);

      if (data.summary) {
        setSummary(data.summary);
      } else if (data.antwort) {
        setSummary({
          mainComplaints: data.antwort,
          location: "",
          timeline: "",
          associatedFactors: "",
          symptomSummary: data.antwort,
          specialties: [],
          visitTopics: [],
        });
      }

      if (data.antwort) {
        setVerlauf((prev) => [
          ...prev.filter((m) => !m.loading && m.content !== LOADING_MARKER),
          { role: "assistant", content: data.antwort },
        ]);
      }
    } catch {
      setErrorKey("summaryError");
    } finally {
      setIsSummarizing(false);
    }
  }, [
    consentOk,
    isSending,
    isSummarizing,
    postToThread,
    t.summaryRequestUser,
    userTurnCount,
  ]);

  const applySession = useCallback((session) => {
    if (!session) return null;
    setActiveSession(CHAT_KIND_SYMPTOM_CHECK, session.id);
    createdAtRef.current = session.createdAt;
    setSessionId(session.id);
    setVerlauf(session.verlauf || []);
    setThreadId(session.threadId || null);
    setSummary(session.summary || null);
    setEingabe("");
    setErrorKey(null);
    introAddedRef.current = (session.verlauf || []).some((m) => m.symptomIntro);
    return session;
  }, []);

  const startNewConversation = useCallback(() => {
    if (!consentOk) return null;
    persistSession();
    const intro = [buildIntroMessage(organHint, t)];
    const sess = createSession(CHAT_KIND_SYMPTOM_CHECK, {
      organHint,
      language,
      verlauf: intro,
      threadId: null,
      summary: null,
    });
    createdAtRef.current = sess.createdAt;
    introAddedRef.current = true;
    setSessionId(sess.id);
    setVerlauf(intro);
    setThreadId(null);
    setSummary(null);
    setEingabe("");
    setErrorKey(null);
    return sess;
  }, [consentOk, organHint, language, persistSession, t]);

  const openSession = useCallback(
    (id) => {
      const session = getSession(CHAT_KIND_SYMPTOM_CHECK, id);
      return applySession(session);
    },
    [applySession],
  );

  const deleteConversation = useCallback(
    (id) => {
      const targetId = id || sessionId;
      if (!targetId) return null;
      const wasActive = targetId === sessionId;
      const nextActiveId = deleteSession(CHAT_KIND_SYMPTOM_CHECK, targetId);

      if (!wasActive) return nextActiveId;

      if (nextActiveId) {
        return applySession(getSession(CHAT_KIND_SYMPTOM_CHECK, nextActiveId));
      }

      const sess = createSession(CHAT_KIND_SYMPTOM_CHECK, {
        organHint,
        language,
        verlauf: [buildIntroMessage(organHint, t)],
      });
      introAddedRef.current = true;
      return applySession(sess);
    },
    [sessionId, organHint, language, applySession, t],
  );

  const clearChat = useCallback(() => {
    setSummary(null);
    introAddedRef.current = true;
    setVerlauf([buildIntroMessage(organHint, t)]);
    setThreadId(null);
  }, [organHint, t]);

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
    sendMessage,
    requestSummary,
    clearChat,
    startNewConversation,
    openSession,
    deleteConversation,
    userTurnCount,
    maxChars: MAX_SYMPTOM_CHARS,
  };
}

export function loadSymptomCheckState(organHint, language) {
  const session = pickSymptomSession(organHint, language);
  return {
    sessionId: session.id,
    verlauf: session.verlauf || [],
    threadId: session.threadId,
    summary: session.summary || null,
    consentOk: (() => {
      try {
        return localStorage.getItem(LS_CONSENT_KEY) === "1";
      } catch {
        return false;
      }
    })(),
  };
}

export function persistSymptomConsent() {
  try {
    localStorage.setItem(LS_CONSENT_KEY, "1");
  } catch {
    /* ignore */
  }
}
