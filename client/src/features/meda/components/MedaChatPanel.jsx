import React, { useEffect, useRef } from "react";
import { FaPaperPlane, FaTimes } from "react-icons/fa";

/**
 * @param {object} props
 * @param {import('../hooks/useMedaChat.js').ReturnType<typeof import('../hooks/useMedaChat.js').useMedaChat>} chat
 * @param {Record<string, string>} t
 * @param {string[]} suggestions
 * @param {() => void} onClose
 */
export default function MedaChatPanel({ chat, t, suggestions, onClose }) {
  const threadRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (chat.open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [chat.open]);

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chat.messages]);

  const showIntro = chat.messages.length === 0;
  const errorText = chat.errorKey ? t[chat.errorKey] : null;
  const remainingText =
    chat.quota && chat.quota.limit
      ? t.remaining
          .replace("{{count}}", String(chat.quota.remaining))
          .replace("{{limit}}", String(chat.quota.limit))
      : null;

  return (
    <div
      className="meda-panel"
      role="dialog"
      aria-labelledby="meda-panel-title"
      aria-modal="false"
    >
      <header className="meda-panel__header">
        <div>
          <h2 id="meda-panel-title" className="meda-panel__title">
            {t.panelTitle}
          </h2>
          <p className="meda-panel__subtitle">{t.panelSubtitle}</p>
        </div>
        <button
          type="button"
          className="meda-panel__close"
          onClick={onClose}
          aria-label={t.closeAria}
        >
          <FaTimes aria-hidden />
        </button>
      </header>

      <p className="meda-panel__disclaimer">{t.disclaimer}</p>

      {remainingText ? (
        <p className="meda-panel__quota" aria-live="polite">
          {remainingText}
        </p>
      ) : null}

      {errorText ? (
        <p className="meda-panel__error" role="alert">
          {errorText}
        </p>
      ) : null}

      <div
        className="meda-panel__thread"
        ref={threadRef}
        role="log"
        aria-live="polite"
        aria-label={t.threadAria}
      >
        {showIntro ? (
          <p className="meda-panel__intro">{t.intro}</p>
        ) : null}

        {chat.messages.map((msg, i) => {
          const isUser = msg.role === "user";
          const isLoading = msg.loading || msg.content === chat.loadingMarker;
          return (
            <article
              key={i}
              className={`meda-panel__bubble meda-panel__bubble--${isUser ? "user" : "assistant"}`}
              aria-label={`${t.messageLabel} ${i + 1}`}
            >
              <strong className="meda-panel__bubble-label">
                {isUser ? t.userLabel : t.assistantLabel}
              </strong>
              <p className="meda-panel__bubble-text">
                {isLoading ? t.loadingLine : msg.content}
              </p>
            </article>
          );
        })}
      </div>

      {showIntro && suggestions?.length ? (
        <div className="meda-panel__chips" aria-label={t.inputLabel}>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="meda-panel__chip"
              disabled={chat.loading || (chat.quota && chat.quota.remaining <= 0)}
              onClick={() => void chat.send(s)}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <div className="meda-panel__composer">
        <label htmlFor="meda-input" className="meda-panel__input-label">
          {t.inputLabel}
        </label>
        <textarea
          id="meda-input"
          ref={inputRef}
          className="meda-panel__textarea"
          rows={2}
          value={chat.input}
          maxLength={chat.maxInput}
          placeholder={t.inputPlaceholder}
          disabled={chat.loading || !chat.enabled || (chat.quota && chat.quota.remaining <= 0)}
          onChange={(e) => chat.setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void chat.send();
            }
          }}
          aria-label={t.inputLabel}
        />
        <div className="meda-panel__composer-actions">
          <button
            type="button"
            className="meda-panel__clear"
            onClick={chat.clearChat}
            disabled={chat.loading || chat.messages.length === 0}
          >
            {t.clearChat}
          </button>
          <span className="meda-panel__count" aria-live="polite">
            {chat.input.length}/{chat.maxInput}
          </span>
          <button
            type="button"
            className="meda-panel__send"
            disabled={
              chat.loading ||
              !chat.input.trim() ||
              !chat.enabled ||
              (chat.quota && chat.quota.remaining <= 0)
            }
            onClick={() => void chat.send()}
            aria-label={t.sendAria}
          >
            <FaPaperPlane aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
