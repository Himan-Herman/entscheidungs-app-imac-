import InterpreterTurnDocument from "./InterpreterTurnDocument.jsx";
import {
  groupTurnsIntoSections,
  sectionLabelForKind,
} from "../utils/sessionTurnSections.js";

/**
 * @param {{
 *   session: import('../types.js').InterpreterSession;
 *   labels: object;
 * }} props
 */
export default function InterpreterReviewTimeline({ session, labels: t }) {
  const turns = session.turns ?? [];
  const sections = groupTurnsIntoSections(turns, session.status);

  if (!sections.length) {
    return <p className="interpreter-empty-state">{t.empty.noTurns}</p>;
  }

  let globalIndex = 0;

  return (
    <div className="interpreter-review__timeline">
      {sections.map((section, sectionIdx) => {
        const sectionLabel = sectionLabelForKind(section.kind, t);
        const sectionId = `interp-section-${session.sessionId}-${sectionIdx}`;

        return (
          <section
            key={sectionId}
            className="interpreter-review__section"
            aria-labelledby={sectionId}
          >
            <h3 id={sectionId} className="interpreter-review__section-title">
              {sectionLabel}
            </h3>
            <ol
              className="interpreter-review__turn-list"
              aria-label={`${sectionLabel} — ${t.aria.turnList}`}
            >
              {section.turns.map((turn) => {
                const index = globalIndex;
                globalIndex += 1;
                return (
                  <li key={turn.turnId} className="interpreter-review__timeline-item">
                    <InterpreterTurnDocument turn={turn} index={index} labels={t} />
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
