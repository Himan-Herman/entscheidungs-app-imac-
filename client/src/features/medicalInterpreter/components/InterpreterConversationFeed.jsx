import { SPEAKER_DOCTOR, TURN_STATUS_TRANSLATED } from "../constants.js";
import { formatInterpreterDateTime } from "../utils/formatInterpreterDate.js";

/**
 * @param {{
 *   turns: import('../types.js').InterpreterTurn[];
 *   labels: object;
 * }} props
 */
export default function InterpreterConversationFeed({ turns, labels: t }) {
  const items = (turns ?? []).filter((turn) => turn.originalText?.trim());

  if (!items.length) {
    return (
      <p className="interpreter-conversation-feed__empty" role="status">
        {t.conversation.waiting}
      </p>
    );
  }

  return (
    <section
      className="interpreter-conversation-feed"
      aria-labelledby="interp-conversation-heading"
    >
      <h2 id="interp-conversation-heading" className="interpreter-live__section-title">
        {t.conversation.heading}
      </h2>
      <ol className="interpreter-conversation-feed__list">
        {items.map((turn) => {
          const speakerLabel =
            turn.speaker === SPEAKER_DOCTOR
              ? t.conversation.clinicianLabel
              : t.conversation.patientLabel;
          const timeLabel = turn.createdAt
            ? formatInterpreterDateTime(turn.createdAt)
            : "";

          return (
            <li key={turn.turnId} className="interpreter-conversation-feed__item">
              <header className="interpreter-conversation-feed__meta">
                <span className="interpreter-conversation-feed__speaker">{speakerLabel}</span>
                {timeLabel ? (
                  <time className="interpreter-conversation-feed__time" dateTime={turn.createdAt}>
                    {timeLabel}
                  </time>
                ) : null}
              </header>
              <div className="interpreter-conversation-feed__columns">
                <div className="interpreter-conversation-feed__col">
                  <span className="interpreter-conversation-feed__col-label">
                    {t.review.originalLabel}
                  </span>
                  <p dir="auto" lang={turn.sourceLanguage}>
                    {turn.originalText}
                  </p>
                </div>
                <div className="interpreter-conversation-feed__col interpreter-conversation-feed__col--translation">
                  <span className="interpreter-conversation-feed__col-label">
                    {t.review.translatedLabel}
                  </span>
                  <p dir="auto" lang={turn.targetLanguage}>
                    {turn.status === TURN_STATUS_TRANSLATED && turn.translatedText?.trim()
                      ? turn.translatedText
                      : t.conversation.translationPending}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
