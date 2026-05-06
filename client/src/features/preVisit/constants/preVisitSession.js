import {
  PRE_VISIT_QUESTION_STEPS,
  PRE_VISIT_SESSION_KEY,
  createEmptyAnswers,
} from "./questionFlow.js";

/** Same key as language selection screen — single source of truth */
export const PREVISIT_LOCALE_STORAGE_KEY = "medscoutx_previsit_locale";

/**
 * Canonical session payload for Pre-Visit (PDF/API later).
 */
export function loadPreVisitSession() {
  try {
    const raw = sessionStorage.getItem(PRE_VISIT_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  }
}

export function savePreVisitSession(payload) {
  try {
    sessionStorage.setItem(PRE_VISIT_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function buildInitialSession(patientLanguage) {
  const empty = createEmptyAnswers();
  const stored = loadPreVisitSession();

  if (
    stored &&
    stored.answers &&
    typeof stored.answers === "object"
  ) {
    return {
      patientLanguage: stored.patientLanguage || patientLanguage,
      answers: { ...empty, ...stored.answers },
      stepIndex:
        typeof stored.stepIndex === "number"
          ? Math.min(
              Math.max(0, stored.stepIndex),
              PRE_VISIT_QUESTION_STEPS.length - 1
            )
          : 0,
    };
  }

  return {
    patientLanguage,
    answers: empty,
    stepIndex: 0,
  };
}

const answerKeys = () => Object.keys(createEmptyAnswers());

/**
 * @param {string} fieldKey
 * @param {string} value
 * @returns {object | null} updated session or null
 */
export function updateAnswerField(fieldKey, value) {
  const s = loadPreVisitSession();
  if (!s?.answers) return null;
  if (!answerKeys().includes(fieldKey)) return null;
  const next = {
    ...s,
    answers: { ...s.answers, [fieldKey]: value },
  };
  savePreVisitSession(next);
  return next;
}

/**
 * @param {string} fieldKey
 * @returns {object | null}
 */
export function clearAnswerField(fieldKey) {
  return updateAnswerField(fieldKey, "");
}

/**
 * @param {number} stepIndex
 * @returns {object | null}
 */
export function setSessionStepIndex(stepIndex) {
  const s = loadPreVisitSession();
  if (!s) return null;
  const max = PRE_VISIT_QUESTION_STEPS.length - 1;
  const next = {
    ...s,
    stepIndex: Math.min(Math.max(0, stepIndex), max),
  };
  savePreVisitSession(next);
  return next;
}

/**
 * Wipes answers and step, keeps patient language from locale storage or session.
 * @returns {object} fresh session
 */
export function resetSessionKeepLanguage() {
  let locale = "de";
  try {
    const fromStorage = sessionStorage.getItem(PREVISIT_LOCALE_STORAGE_KEY);
    const fromSession = loadPreVisitSession()?.patientLanguage;
    locale = fromStorage || fromSession || "de";
  } catch {
    locale = loadPreVisitSession()?.patientLanguage || "de";
  }
  const fresh = {
    patientLanguage: locale,
    answers: createEmptyAnswers(),
    stepIndex: 0,
  };
  savePreVisitSession(fresh);
  return fresh;
}

/**
 * Removes intake session and selected patient language.
 */
export function clearFullSession() {
  try {
    sessionStorage.removeItem(PRE_VISIT_SESSION_KEY);
    sessionStorage.removeItem(PREVISIT_LOCALE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
