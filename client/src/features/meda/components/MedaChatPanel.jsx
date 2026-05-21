import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaPaperPlane, FaTimes, FaExpandAlt, FaCompressAlt } from "react-icons/fa";
import medscoutLogo from "../../../assets/img/medscout-logo.png";

const INPUT_MIN_PX = 48;
const INPUT_AUTO_MAX_PX = 120;
const INPUT_EXPANDED_MIN_PX = 120;
const INPUT_EXPANDED_MAX_PX = 220;

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
  const [inputExpanded, setInputExpanded] = useState(false);

  const syncTextareaHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const minH = inputExpanded ? INPUT_EXPANDED_MIN_PX : INPUT_MIN_PX;
    const maxH = inputExpanded ? INPUT_EXPANDED_MAX_PX : INPUT_AUTO_MAX_PX;
    el.style.height = "auto";
    const next = Math.min(maxH, Math.max(minH, el.scrollHeight));
    el.style.height = `${next}px`;
  }, [inputExpanded]);

  useEffect(() => {
    if (chat.open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [chat.open]);

  useEffect(() => {
    syncTextareaHeight();
  }, [chat.input, inputExpanded, syncTextareaHeight]);

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

  const toggleInputExpanded = () => {
    setInputExpanded((v) => !v);
    requestAnimationFrame(() => {
      syncTextareaHeight();
      inputRef.current?.focus();
    });
  };

  return (
    <div
      className="meda-panel"
      role="dialog"
      aria-labelledby="meda-panel-title"
      aria-modal="false"
    >
      <header className="meda-panel__brand" aria-label={t.brandAria}>
        <div className="meda-panel__brand-mark">
          <img
            className="meda-panel__brand-logo"
            src={medscoutLogo}
            alt=""
            width={32}
            height={32}
          />
          <div className="meda-panel__brand-text">
            <span className="meda-panel__brand-name">MedScoutX</span>
            <span className="meda-panel__brand-tagline">{t.brandTagline}</span>
          </div>
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

      <div className="meda-panel__title-row">
        <div>
          <h2 id="meda-panel-title" className="meda-panel__title">
            {t.panelTitle}
          </h2>
          <p className="meda-panel__subtitle">{t.panelSubtitle}</p>
        </div>
      </div>

      <div className="meda-panel__scroll" ref={threadRef}>
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
      </div>

      <div className="meda-panel__composer">
        <label htmlFor="meda-input" className="meda-panel__input-label">
          {t.inputLabel}
        </label>
        <div
          className={`meda-panel__input-wrap${inputExpanded ? " meda-panel__input-wrap--expanded" : ""}`}
        >
          <textarea
            id="meda-input"
            ref={inputRef}
            className="meda-panel__textarea"
            rows={2}
            value={chat.input}
            maxLength={chat.maxInput}
            placeholder={t.inputPlaceholder}
            disabled={
              chat.loading ||
              !chat.enabled ||
              (chat.quota && chat.quota.remaining <= 0)
            }
            onChange={(e) => chat.setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void chat.send();
              }
            }}
            aria-label={t.inputLabel}
            aria-expanded={inputExpanded}
          />
          <button
            type="button"
            className="meda-panel__input-expand"
            onClick={toggleInputExpanded}
            aria-label={inputExpanded ? t.collapseInputAria : t.expandInputAria}
            aria-expanded={inputExpanded}
            aria-controls="meda-input"
            disabled={
              chat.loading ||
              !chat.enabled ||
              (chat.quota && chat.quota.remaining <= 0)
            }
          >
            {inputExpanded ? (
              <FaCompressAlt aria-hidden />
            ) : (
              <FaExpandAlt aria-hidden />
            )}
          </button>
        </div>
        <div className="meda-panel__composer-actions">
          <button
            type="button"
            className="meda-panel__clear"
            onClick={chat.clearChat}
            disabled={chat.loading || chat.messages.length === 0}
            aria-label={t.clearChatAria}
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
