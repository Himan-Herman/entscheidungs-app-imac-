import { SESSION_STATUS_ENDED, SPEAKER_DOCTOR } from "../constants.js";

/**
 * @typedef {'opening'|'patient'|'clinician'|'closing'} InterpreterSectionKind
 */

/**
 * @typedef {{
 *   kind: InterpreterSectionKind;
 *   turns: import('../types.js').InterpreterTurn[];
 *   speaker?: import('../types.js').InterpreterSpeaker;
 * }} InterpreterTurnSection
 */

/**
 * @param {import('../types.js').InterpreterTurn[]} turns
 */
function buildSpeakerRuns(turns) {
  /** @type {{ speaker: import('../types.js').InterpreterSpeaker, turns: import('../types.js').InterpreterTurn[] }[]} */
  const runs = [];
  for (const turn of turns) {
    const last = runs[runs.length - 1];
    if (last && last.speaker === turn.speaker) {
      last.turns.push(turn);
    } else {
      runs.push({ speaker: turn.speaker, turns: [turn] });
    }
  }
  return runs;
}

/**
 * Neutral conversation sections — not clinical categories (Phase 2.5).
 * @param {import('../types.js').InterpreterTurn[]} turns
 * @param {import('../types.js').InterpreterSessionStatus} [sessionStatus]
 * @returns {InterpreterTurnSection[]}
 */
export function groupTurnsIntoSections(turns, sessionStatus) {
  if (!turns?.length) return [];

  const runs = buildSpeakerRuns(turns);
  const sessionEnded = sessionStatus === SESSION_STATUS_ENDED;
  const useClosing = sessionEnded && turns.length >= 3 && runs.length >= 2;

  /** @type {InterpreterTurnSection[]} */
  const sections = [];

  runs.forEach((run, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === runs.length - 1;
    const isClosing = useClosing && isLast && !isFirst;

    /** @type {InterpreterSectionKind} */
    let kind;
    if (isClosing) kind = "closing";
    else if (isFirst) kind = "opening";
    else kind = run.speaker === SPEAKER_DOCTOR ? "clinician" : "patient";

    sections.push({
      kind,
      turns: run.turns,
      speaker: run.speaker,
    });
  });

  return sections;
}

/**
 * @param {InterpreterSectionKind} kind
 * @param {object} t
 */
export function sectionLabelForKind(kind, t) {
  const s = t?.sections ?? {};
  switch (kind) {
    case "opening":
      return s.opening;
    case "patient":
      return s.patientStatements;
    case "clinician":
      return s.clinicianStatements;
    case "closing":
      return s.closing;
    default:
      return s.middle;
  }
}
