import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../../api/authFetch.js";
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

function writeStorage(key, value) {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(
        key,
        typeof value === "string" ? value : JSON.stringify(value),
      );
    }
  } catch {
    /* ignore */
  }
}

function introExists(messages) {
  return messages.some((m) => m.role === "assistant" && m.symptomIntro);
}

/**
 * @param {object} opts
 * @param {import('../symptomTypes.js').SymptomChatMessage[]} opts.initialVerlauf
 * @param {string | null} opts.initialThreadId
 * @param {import('../symptomTypes.js').SymptomCheckSummary | null} opts.initialSummary
 * @param {string | null} opts.organHint
 * @param {'de'|'en'} opts.language
 * @param {Record<string, string>} opts.t
 * @param {boolean} opts.consentOk
 */
export function useSymptomCheckChat({
  initialVerlauf = [],
  initialThreadId = null,
  initialSummary = null,
  organHint = null,
  language,
  t,
  consentOk,
}) {
  const [eingabe, setEingabe] = useState("");
  const [verlauf, setVerlauf] = useState(initialVerlauf);
  const [threadId, setThreadId] = useState(initialThreadId);
  const [summary, setSummary] = useState(initialSummary);
  const [isSending, setIsSending] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [errorKey, setErrorKey] = useState(null);
  const introAddedRef = useRef(initialVerlauf.some((m) => m.symptomIntro));

  const userTurnCount = verlauf.filter((m) => m.role === "user").length;

  useEffect(() => {
    if (!consentOk) return;
    writeStorage(LS_VERLAUF_KEY, verlauf);
  }, [verlauf, consentOk]);

  useEffect(() => {
    if (!consentOk) return;
    writeStorage(LS_THREAD_KEY, threadId);
  }, [threadId, consentOk]);

  useEffect(() => {
    if (!consentOk) return;
    writeStorage(LS_SUMMARY_KEY, summary);
  }, [summary, consentOk]);

  useEffect(() => {
    if (!consentOk) return;
    setVerlauf((prev) => {
      if (introExists(prev) || introAddedRef.current) {
        introAddedRef.current = true;
        return prev;
      }
      introAddedRef.current = true;
      const introContent = organHint
        ? t.introWithOrgan.replace(/\{\{organ\}\}/g, organHint)
        : t.introAssistant;
      return [
        ...prev,
        { role: "assistant", content: introContent, symptomIntro: true },
      ];
    });
  }, [consentOk, organHint, t.introAssistant, t.introWithOrgan]);

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

  const clearChat = useCallback(() => {
    setSummary(null);
    writeStorage(LS_SUMMARY_KEY, null);
    introAddedRef.current = false;
    const introContent = organHint
      ? t.introWithOrgan.replace(/\{\{organ\}\}/g, organHint)
      : t.introAssistant;
    setVerlauf([{ role: "assistant", content: introContent, symptomIntro: true }]);
    introAddedRef.current = true;
  }, [organHint, t.introAssistant, t.introWithOrgan]);

  const resetAll = useCallback(() => {
    setVerlauf([]);
    setEingabe("");
    setThreadId(null);
    setSummary(null);
    introAddedRef.current = false;
    writeStorage(LS_VERLAUF_KEY, null);
    writeStorage(LS_THREAD_KEY, null);
    writeStorage(LS_SUMMARY_KEY, null);
  }, []);

  return {
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
    resetAll,
    userTurnCount,
    maxChars: MAX_SYMPTOM_CHARS,
  };
}

export function loadSymptomCheckState() {
  let threadId = null;
  try {
    const raw = localStorage.getItem(LS_THREAD_KEY);
    if (raw && raw !== "null" && raw !== "undefined" && raw.trim()) {
      threadId = raw;
    }
  } catch {
    /* ignore */
  }

  return {
    verlauf: readJsonStorage(LS_VERLAUF_KEY, []),
    threadId,
    summary: readJsonStorage(LS_SUMMARY_KEY, null),
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
