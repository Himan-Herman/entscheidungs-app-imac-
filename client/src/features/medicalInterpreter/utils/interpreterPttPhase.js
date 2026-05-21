import {
  TURN_STATUS_BLOCKED,
  TURN_STATUS_DRAFT,
  TURN_STATUS_ERROR,
  TURN_STATUS_TRANSLATED,
} from "../constants.js";

/** @typedef {'idle'|'recording'|'uploading'|'transcribing'|'draft_ready'|'translating'|'translated'|'blocked'|'error'} InterpreterPttPhase */

export const PTT_PHASE = {
  IDLE: "idle",
  RECORDING: "recording",
  UPLOADING: "uploading",
  TRANSCRIBING: "transcribing",
  DRAFT_READY: "draft_ready",
  TRANSLATING: "translating",
  TRANSLATED: "translated",
  BLOCKED: "blocked",
  ERROR: "error",
};

/**
 * Single source of truth for live-room PTT UI state (Phase 5.2).
 * @param {{
 *   sessionEnded?: boolean;
 *   isPreparing?: boolean;
 *   isRecording?: boolean;
 *   isStopping?: boolean;
 *   isTranscribing?: boolean;
 *   isTranslating?: boolean;
 *   isSimplifying?: boolean;
 *   turnStatus?: string;
 * }} input
 * @returns {InterpreterPttPhase}
 */
export function derivePttPhase(input) {
  const {
    sessionEnded = false,
    isPreparing = false,
    isRecording = false,
    isStopping = false,
    isTranscribing = false,
    isTranslating = false,
    isSimplifying = false,
    turnStatus,
  } = input;

  if (sessionEnded) {
    return PTT_PHASE.IDLE;
  }
  if (isPreparing || isRecording || isStopping) {
    return PTT_PHASE.RECORDING;
  }
  if (isTranscribing) {
    return PTT_PHASE.TRANSCRIBING;
  }
  if (isTranslating || isSimplifying) {
    return PTT_PHASE.TRANSLATING;
  }
  if (turnStatus === TURN_STATUS_BLOCKED) {
    return PTT_PHASE.BLOCKED;
  }
  if (turnStatus === TURN_STATUS_ERROR) {
    return PTT_PHASE.ERROR;
  }
  if (turnStatus === TURN_STATUS_DRAFT) {
    return PTT_PHASE.DRAFT_READY;
  }
  if (turnStatus === TURN_STATUS_TRANSLATED) {
    return PTT_PHASE.TRANSLATED;
  }
  return PTT_PHASE.IDLE;
}

/**
 * @param {InterpreterPttPhase} phase
 * @param {object} labels — medicalInterpreter i18n root
 * @returns {string}
 */
export function pttPhaseStatusLabel(phase, labels) {
  const room = labels?.room ?? {};
  switch (phase) {
    case PTT_PHASE.RECORDING:
      return room.statusRecording ?? "";
    case PTT_PHASE.UPLOADING:
      return room.statusUploading ?? room.statusTranscribing ?? "";
    case PTT_PHASE.TRANSCRIBING:
      return room.statusTranscribing ?? "";
    case PTT_PHASE.TRANSLATING:
      return room.statusTranslating ?? "";
    case PTT_PHASE.DRAFT_READY:
      return room.statusEditingDraft ?? "";
    case PTT_PHASE.TRANSLATED:
      return room.statusReadyForNext ?? "";
    case PTT_PHASE.BLOCKED:
      return room.statusBlocked ?? room.statusEditingDraft ?? "";
    case PTT_PHASE.ERROR:
      return room.statusError ?? room.statusIdle ?? "";
    default:
      return room.statusIdle ?? "";
  }
}

/**
 * @param {InterpreterPttPhase} phase
 */
export function isPttCaptureActive(phase) {
  return phase === PTT_PHASE.RECORDING;
}

/**
 * @param {InterpreterPttPhase} phase
 */
export function isPttPipelineBusy(phase) {
  return (
    phase === PTT_PHASE.RECORDING ||
    phase === PTT_PHASE.UPLOADING ||
    phase === PTT_PHASE.TRANSCRIBING ||
    phase === PTT_PHASE.TRANSLATING
  );
}
