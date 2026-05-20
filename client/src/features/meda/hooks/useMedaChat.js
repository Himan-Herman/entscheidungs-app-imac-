import { useCallback, useEffect, useState } from "react";
import { fetchMedaStatus, sendMedaMessage } from "../api/medaApi.js";
import { MEDA_MAX_HISTORY, MEDA_MAX_INPUT } from "../constants.js";

const LOADING = "__meda_loading__";

/**
 * @param {'de'|'en'} language
 * @param {Record<string, string>} t
 */
export function useMedaChat(language, t) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState(null);
  const [quota, setQuota] = useState(null);
  const [enabled, setEnabled] = useState(true);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await fetchMedaStatus(language);
      const on = data.enabled !== false;
      setEnabled(on);
      if (data.quota) setQuota(data.quota);
      if (!on) setErrorKey("unavailable");
    } catch {
      setEnabled(false);
      setErrorKey("unavailable");
    }
  }, [language]);

  useEffect(() => {
    if (open) void refreshStatus();
  }, [open, refreshStatus]);

  const send = useCallback(
    async (textOverride) => {
      const text = (typeof textOverride === "string" ? textOverride : input).trim();
      if (!text || loading) return;

      if (quota && quota.remaining <= 0) {
        setErrorKey("rateLimit");
        return;
      }

      setErrorKey(null);
      const userMsg = { role: "user", content: text };
      const history = messages
        .filter((m) => m.content && m.content !== LOADING)
        .slice(-MEDA_MAX_HISTORY);

      setMessages((prev) => [
        ...prev,
        userMsg,
        { role: "assistant", content: LOADING, loading: true },
      ]);
      setInput("");
      setLoading(true);

      try {
        const data = await sendMedaMessage({
          message: text,
          history,
          language,
        });
        setQuota(data.quota);
        setMessages((prev) => [
          ...prev.filter((m) => !m.loading),
          { role: "assistant", content: data.reply },
        ]);
      } catch (e) {
        if (e.code === "rate_limit_exceeded") {
          setErrorKey("rateLimit");
          if (e.quota) setQuota(e.quota);
        } else if (e.code === "validation_too_long") {
          setErrorKey("tooLong");
        } else if (e.code === "validation_blocked") {
          setErrorKey("blocked");
        } else {
          setErrorKey("serverError");
        }
        setMessages((prev) => prev.filter((m) => !m.loading));
      } finally {
        setLoading(false);
      }
    },
    [input, language, loading, messages, quota],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setErrorKey(null);
  }, []);

  return {
    open,
    setOpen,
    messages,
    input,
    setInput: (v) => setInput(String(v).slice(0, MEDA_MAX_INPUT)),
    loading,
    errorKey,
    quota,
    enabled,
    send,
    clearChat,
    maxInput: MEDA_MAX_INPUT,
    loadingMarker: LOADING,
  };
}
