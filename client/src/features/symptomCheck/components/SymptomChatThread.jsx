import React, { useEffect, useRef } from "react";
import SpeakButton from "../../../components/SpeakButton.jsx";
import { LOADING_MARKER } from "../constants.js";

/**
 * @param {object} props
 * @param {import('../symptomTypes.js').SymptomChatMessage[]} props.messages
 * @param {Record<string, string>} props.labels
 */
export default function SymptomChatThread({ messages, labels }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      className="symptom-check__thread"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label={labels.threadAria}
    >
      {messages.length === 0 ? (
        <p className="symptom-check__placeholder">
          {labels.placeholderEmpty}
          <span className="symptom-check__placeholder-example">
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
            className={`symptom-check__bubble symptom-check__bubble--${isUser ? "user" : "assistant"}`}
            aria-label={`${labels.messageLabel} ${index + 1}: ${isUser ? labels.userLabel : labels.assistantLabel}`}
          >
            <div className="symptom-check__bubble-head">
              <strong className="symptom-check__bubble-label">
                {isUser ? labels.userLabel : labels.assistantLabel}
              </strong>
              {!isUser && !isLoading ? (
                <SpeakButton
                  text={msg.content || ""}
                  className="symptom-check__tts"
                  ariaLabel={labels.speakAria}
                />
              ) : null}
            </div>
            <p className="symptom-check__bubble-text">
              {isLoading ? labels.loadingLine : msg.content}
            </p>
          </article>
        );
      })}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}
