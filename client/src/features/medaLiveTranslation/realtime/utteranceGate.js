/**
 * Meda Live — per-utterance gate (pure, no I/O, no React).
 *
 * Decides, for each closed speech segment of a client-gated session, whether
 * it may reach the interpreter model at all, who said it, and in which
 * direction it is translated. Kept free of WebRTC so every case can be tested
 * in Node.
 *
 * Order — deterministic, no extra model anywhere:
 *   1. empty transcript   → nothing was said
 *   2. allowed languages  → a segment CLEARLY in a third language is rejected
 *                           (classifyUtteranceLanguage: only the session's
 *                           languages are ever returned)
 *   3. speaker binding    → manual mode: the selection at SPEECH START;
 *                           auto mode: the recognised session language
 *                           ("Ja", "Nein", "Yes", "No" count as evidence)
 *   4. otherwise          → kept, without a speaker ("Paracetamol 500",
 *                           names, numbers carry no language evidence)
 *
 * Nothing is attributed to a speaker on a guess, and nothing that might be a
 * dose or an answer is dropped just because it is short.
 */

import { classifyUtteranceLanguage } from './realtimeLanguages.js';

/** Why a segment was kept out of the conversation. */
export const REJECT_REASONS = Object.freeze({
  EMPTY: 'empty',
  FOREIGN_LANGUAGE: 'foreign_language',
  /** The transcription itself failed — unintelligible audio. */
  UNCLEAR: 'unclear',
});

/** @param {'patient'|'practice'} role */
function otherRole(role) {
  return role === 'patient' ? 'practice' : 'patient';
}

/**
 * @typedef {{
 *   accept: boolean,
 *   reason: string|null,
 *   speakerRole: 'patient'|'practice'|null,
 *   targetRole: 'patient'|'practice'|null,
 *   sourceLanguage: string|null,
 *   targetLanguage: string|null,
 *   speakerCertain: boolean,
 * }} UtteranceDecision
 */

/**
 * @param {{
 *   transcript: string,
 *   patientLanguage: string,
 *   practiceLanguage: string,
 *   manualMode?: boolean,
 *   boundRole?: 'patient'|'practice'|null,
 * }} input
 * @returns {UtteranceDecision}
 */
export function decideUtterance({
  transcript,
  patientLanguage,
  practiceLanguage,
  manualMode = false,
  boundRole = null,
}) {
  const reject = (reason) => ({
    accept: false,
    reason,
    speakerRole: null,
    targetRole: null,
    sourceLanguage: null,
    targetLanguage: null,
    speakerCertain: false,
  });
  const accept = (speakerRole) => {
    if (!speakerRole) {
      return {
        accept: true,
        reason: null,
        speakerRole: null,
        targetRole: null,
        sourceLanguage: null,
        targetLanguage: null,
        speakerCertain: false,
      };
    }
    return {
      accept: true,
      reason: null,
      speakerRole,
      targetRole: otherRole(speakerRole),
      sourceLanguage: speakerRole === 'patient' ? patientLanguage : practiceLanguage,
      targetLanguage: speakerRole === 'patient' ? practiceLanguage : patientLanguage,
      speakerCertain: true,
    };
  };

  const text = String(transcript ?? '').trim();
  // 1. Nothing recognisable — noise, a cough, a door.
  if (!text) return reject(REJECT_REASONS.EMPTY);

  // 2. The session's two languages are binding. Only CLEAR evidence rejects.
  const lang = classifyUtteranceLanguage(text, [patientLanguage, practiceLanguage]);
  if (lang.verdict === 'empty') return reject(REJECT_REASONS.EMPTY);
  if (lang.verdict === 'foreign') return reject(REJECT_REASONS.FOREIGN_LANGUAGE);

  // 3a. Manual: the speaker selected when this segment STARTED decides.
  if (manualMode && (boundRole === 'patient' || boundRole === 'practice')) {
    return accept(boundRole);
  }

  // 3b. Auto: the recognised session language decides.
  if (lang.language === patientLanguage) return accept('patient');
  if (lang.language === practiceLanguage) return accept('practice');

  // 4. No evidence either way ("Paracetamol 500", a name, a number). Not foreign,
  //    so not dropped. Kept WITHOUT a speaker; the interpreter hears the audio
  //    and knows the two permitted languages.
  return accept(null);
}

/**
 * Output lock for a turn without a known direction: the model's answer may be
 * in either session language, but never in a third one.
 *
 * @param {string} text
 * @param {string} patientLanguage
 * @param {string} practiceLanguage
 */
export function isOutsideSessionLanguages(text, patientLanguage, practiceLanguage) {
  return classifyUtteranceLanguage(text, [patientLanguage, practiceLanguage]).verdict === 'foreign';
}

/**
 * Marker phrases of the interpreter's own "please repeat" answer (session
 * instructions define it in German; the model sometimes renders it in the
 * target language). Used to drop an unattributed segment the model refused.
 */
const REFUSAL_MARKERS = [
  'bitte wiederholen sie die aussage',
  'ausgewählten gesprächssprachen',
  'please repeat the statement',
  'selected conversation languages',
  'veuillez répéter',
  'por favor, repita',
  'ripeta',
  'повторите',
];

/** @param {string} text */
export function isInterpreterRefusal(text) {
  const t = String(text ?? '').toLowerCase();
  if (!t.trim()) return false;
  return REFUSAL_MARKERS.some((m) => t.includes(m));
}

/**
 * The debug panel keeps every server event. Input transcripts are replaced by
 * their length: a rejected segment may be a bystander's words, and those must
 * not become visible anywhere in the app — not even in the debug view.
 *
 * @param {any} ev
 */
export function redactEventForDebug(ev) {
  if (!ev || typeof ev.type !== 'string' || !ev.type.includes('input_audio_transcription')) return ev;
  const redacted = { ...ev };
  if (typeof redacted.transcript === 'string') redacted.transcript = `‹${redacted.transcript.length} chars›`;
  if (typeof redacted.delta === 'string') redacted.delta = `‹${redacted.delta.length} chars›`;
  return redacted;
}
