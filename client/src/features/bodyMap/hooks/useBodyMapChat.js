import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../../api/authFetch.js";
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

function writeStorage(key, value) {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  } catch {
    /* ignore quota / private mode */
  }
}

function introExistsForOrgan(messages, organKey) {
  return messages.some(
    (m) => m.role === "assistant" && m.bodyMapIntro && m.introOrgan === organKey,
  );
}

/**
 * @param {object} opts
 * @param {import('../bodyMapTypes.js').BodyMapChatMessage[]} opts.initialVerlauf
 * @param {string} opts.initialThreadId
 * @param {import('../bodyMapTypes.js').BodyMapSummary | null} opts.initialSummary
 * @param {string | null} opts.organ
 * @param {string} opts.organLabel
 * @param {'de'|'en'} opts.language
 * @param {Record<string, string>} opts.tc
 */
export function useBodyMapChat({
  initialVerlauf = [],
  initialThreadId = "",
  initialSummary = null,
  organ,
  organLabel,
  language,
  tc,
}) {
  const [eingabe, setEingabe] = useState("");
  const [verlauf, setVerlauf] = useState(initialVerlauf);
  const [threadId, setThreadId] = useState(initialThreadId);
  const [summary, setSummary] = useState(initialSummary);
  const [isSending, setIsSending] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [errorKey, setErrorKey] = useState(null);
  const lastIntroOrganRef = useRef(null);

  const userTurnCount = verlauf.filter((m) => m.role === "user").length;

  useEffect(() => {
    writeStorage(LS_CHAT_KEY, verlauf);
  }, [verlauf]);

  useEffect(() => {
    writeStorage(LS_THREAD_KEY, threadId || null);
  }, [threadId]);

  useEffect(() => {
    writeStorage(LS_SUMMARY_KEY, summary);
  }, [summary]);

  useEffect(() => {
    if (!organ) return;
    setVerlauf((prev) => {
      if (introExistsForOrgan(prev, organ)) {
        lastIntroOrganRef.current = organ;
        return prev;
      }
      if (lastIntroOrganRef.current === organ) return prev;
      lastIntroOrganRef.current = organ;
      return [
        ...prev,
        {
          role: "assistant",
          content: tc.introAssistant.replace(/\{\{region\}\}/g, organLabel),
          bodyMapIntro: true,
          introOrgan: organ,
        },
      ];
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

  const clearChat = useCallback(() => {
    setSummary(null);
    writeStorage(LS_SUMMARY_KEY, null);
    if (organ) {
      const intro = {
        role: "assistant",
        content: tc.introAssistant.replace(/\{\{region\}\}/g, organLabel),
        bodyMapIntro: true,
        introOrgan: organ,
      };
      setVerlauf([intro]);
      lastIntroOrganRef.current = organ;
    } else {
      setVerlauf([]);
    }
  }, [organ, organLabel, tc.introAssistant]);

  const resetAll = useCallback(() => {
    setVerlauf([]);
    setEingabe("");
    setThreadId("");
    setSummary(null);
    writeStorage(LS_CHAT_KEY, null);
    writeStorage(LS_THREAD_KEY, null);
    writeStorage(LS_SUMMARY_KEY, null);
    lastIntroOrganRef.current = null;
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
    setErrorKey,
    sendMessage,
    requestSummary,
    clearChat,
    resetAll,
    userTurnCount,
    maxChars: MAX_BODY_MAP_CHARS,
  };
}

export function loadBodyMapChatState() {
  return {
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
}
