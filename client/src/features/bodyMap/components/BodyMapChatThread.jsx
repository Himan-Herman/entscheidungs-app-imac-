import React, { useEffect, useRef } from "react";
import SpeakButton from "../../../components/SpeakButton.jsx";
import { LOADING_MARKER } from "../constants.js";

/**
 * @param {object} props
 * @param {import('../bodyMapTypes.js').BodyMapChatMessage[]} props.messages
 * @param {Record<string, string>} props.labels
 */
export default function BodyMapChatThread({ messages, labels }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <div
      className="body-map-chat__thread"
      ref={scrollRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label={labels.threadAria}
    >
      {messages.length === 0 ? (
        <p className="body-map-chat__placeholder">
          {labels.placeholderEmpty}
          <span className="body-map-chat__placeholder-example">
            {labels.placeholderExample}
          </span>
        </p>
      ) : null}

      {messages.map((msg, index) => {
        const isUser = msg.role === "user";
        const isLoading = msg.content === LOADING_MARKER || msg.loading;

        return (
          <article
            key={`${index}-${msg.role}-${isLoading ? "loading" : "msg"}`}
            className={`body-map-chat__bubble body-map-chat__bubble--${isUser ? "user" : "assistant"}`}
            aria-label={`${labels.messageLabel} ${index + 1}: ${isUser ? labels.userLabel : labels.assistantLabel}`}
          >
            <div className="body-map-chat__bubble-head">
              <strong className="body-map-chat__bubble-label">
                {isUser ? labels.userLabel : labels.assistantLabel}
              </strong>
              {!isUser && !isLoading ? (
                <SpeakButton
                  text={msg.content || ""}
                  className="body-map-chat__tts"
                  ariaLabel={labels.speakAria}
                />
              ) : null}
            </div>
            <p className="body-map-chat__bubble-text">
              {isLoading ? labels.loadingLine : msg.content}
            </p>
          </article>
        );
      })}
    </div>
  );
}
