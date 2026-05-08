import {
  PRE_VISIT_QUESTION_STEPS,
  PRE_VISIT_SESSION_KEY,
  createEmptyAnswers,
} from "./questionFlow.js";
import { normalizeAdaptiveIntakeV1 } from "../adaptive/adaptiveSessionUtils.js";

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

/**
 * Stable fingerprint for patient answers + doctor language (AI doctor-version cache).
 * @param {object} answers
 * @param {string} doctorLanguage
 */
export function computePreVisitAiFingerprint(answers, doctorLanguage) {
  const empty = createEmptyAnswers();
  const merged = {
    ...empty,
    ...(answers && typeof answers === "object" ? answers : {}),
  };
  const norm = {};
  for (const k of Object.keys(empty)) {
    norm[k] = merged[k] != null ? String(merged[k]) : "";
  }
  return JSON.stringify({
    doctorLanguage: String(doctorLanguage || "de"),
    answers: norm,
  });
}

/**
 * @param {object} session
 * @returns {boolean}
 */
export function isAiDoctorVersionFresh(session) {
  if (!session?.aiDoctorVersion || !session?.aiDoctorVersionFingerprint) {
    return false;
  }
  const dl = session.doctorLanguage || session.patientLanguage || "de";
  return (
    computePreVisitAiFingerprint(session.answers, dl) ===
    session.aiDoctorVersionFingerprint
  );
}

export function buildInitialSession(patientLanguage) {
  const empty = createEmptyAnswers();
  const stored = loadPreVisitSession();

  if (
    stored &&
    stored.answers &&
    typeof stored.answers === "object"
  ) {
    const intakeV1 = normalizeAdaptiveIntakeV1(stored.intakeV1);
    const caseTimeline =
      stored.caseTimeline && typeof stored.caseTimeline === "object"
        ? {
            relatedSessionId: String(stored.caseTimeline.relatedSessionId || ""),
            caseTopic: String(stored.caseTimeline.caseTopic || ""),
            includeInPdf: Boolean(stored.caseTimeline.includeInPdf),
            summary:
              stored.caseTimeline.summary &&
              typeof stored.caseTimeline.summary === "object"
                ? {
                    newlyMentioned: Array.isArray(
                      stored.caseTimeline.summary.newlyMentioned
                    )
                      ? stored.caseTimeline.summary.newlyMentioned
                      : [],
                    stillMentioned: Array.isArray(
                      stored.caseTimeline.summary.stillMentioned
                    )
                      ? stored.caseTimeline.summary.stillMentioned
                      : [],
                    noLongerMentioned: Array.isArray(
                      stored.caseTimeline.summary.noLongerMentioned
                    )
                      ? stored.caseTimeline.summary.noLongerMentioned
                      : [],
                    unclear: Array.isArray(stored.caseTimeline.summary.unclear)
                      ? stored.caseTimeline.summary.unclear
                      : [],
                    patientAddedNewInformation: Array.isArray(
                      stored.caseTimeline.summary.patientAddedNewInformation
                    )
                      ? stored.caseTimeline.summary.patientAddedNewInformation
                      : [],
                    patientDidNotMentionPreviouslyReportedInformation:
                      Array.isArray(
                        stored.caseTimeline.summary
                          .patientDidNotMentionPreviouslyReportedInformation
                      )
                        ? stored.caseTimeline.summary
                            .patientDidNotMentionPreviouslyReportedInformation
                        : [],
                  }
                : null,
          }
        : null;
    const patientIdentity =
      stored.patientIdentity && typeof stored.patientIdentity === "object"
        ? {
            patientName: String(stored.patientIdentity.patientName || ""),
            patientEmail: String(stored.patientIdentity.patientEmail || ""),
            patientDateOfBirth: String(
              stored.patientIdentity.patientDateOfBirth || ""
            ),
            patientGenderOrSalutation: String(
              stored.patientIdentity.patientGenderOrSalutation || ""
            ),
            patientPhone: String(stored.patientIdentity.patientPhone || ""),
          }
        : null;
    const practiceContext =
      stored.practiceContext && typeof stored.practiceContext === "object"
        ? {
            qrToken: String(stored.practiceContext.qrToken || ""),
            practiceName: String(stored.practiceContext.practiceName || ""),
            targetName: String(stored.practiceContext.targetName || ""),
            targetType: String(stored.practiceContext.targetType || ""),
            doctorName: String(stored.practiceContext.doctorName || ""),
            specialty: String(stored.practiceContext.specialty || ""),
            preferredDoctorLanguage: String(
              stored.practiceContext.preferredDoctorLanguage || ""
            ),
          }
        : null;
    const longitudinalCase = normalizeLongitudinalCase(stored.longitudinalCase);
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
      ...(stored.doctorLanguage
        ? { doctorLanguage: stored.doctorLanguage }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(
        stored,
        "selectedDoctorContactId"
      )
        ? {
            selectedDoctorContactId:
              stored.selectedDoctorContactId == null ||
              stored.selectedDoctorContactId === ""
                ? null
                : String(stored.selectedDoctorContactId),
          }
        : {}),
      ...(intakeV1 ? { intakeV1 } : {}),
      ...(caseTimeline ? { caseTimeline } : {}),
      ...(patientIdentity ? { patientIdentity } : {}),
      ...(practiceContext ? { practiceContext } : {}),
      ...(longitudinalCase ? { longitudinalCase } : {}),
    };
  }

  const longitudinalCaseFresh = normalizeLongitudinalCase(stored?.longitudinalCase);
  return {
    patientLanguage,
    answers: empty,
    stepIndex: 0,
    ...(longitudinalCaseFresh ? { longitudinalCase: longitudinalCaseFresh } : {}),
  };
}

function defaultLongitudinalPdfInclude() {
  return {
    caseTitle: false,
    continuitySummary: false,
    sessionsOverview: false,
    relatedReportsSummary: false,
  };
}

/** @param {unknown} raw */
export function normalizeLongitudinalCase(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const pdfIn = { ...defaultLongitudinalPdfInclude() };
  if (raw.pdfInclude && typeof raw.pdfInclude === "object") {
    for (const k of Object.keys(pdfIn)) {
      if (Object.prototype.hasOwnProperty.call(raw.pdfInclude, k)) {
        pdfIn[k] = Boolean(raw.pdfInclude[k]);
      }
    }
  }
  let continuitySummary = null;
  const cs = raw.continuitySummary;
  if (cs && typeof cs === "object") {
    continuitySummary = {
      recurringSymptoms: Array.isArray(cs.recurringSymptoms)
        ? cs.recurringSymptoms
        : [],
      recurringMedications: Array.isArray(cs.recurringMedications)
        ? cs.recurringMedications
        : [],
      recurringPatientQuestions: Array.isArray(cs.recurringPatientQuestions)
        ? cs.recurringPatientQuestions
        : [],
      recurringConcerns: Array.isArray(cs.recurringConcerns)
        ? cs.recurringConcerns
        : [],
    };
    const emptyCont =
      !continuitySummary.recurringSymptoms.length &&
      !continuitySummary.recurringMedications.length &&
      !continuitySummary.recurringPatientQuestions.length &&
      !continuitySummary.recurringConcerns.length;
    if (emptyCont) continuitySummary = null;
  }
  const out = {
    caseId: String(raw.caseId || ""),
    caseTitle: String(raw.caseTitle || ""),
    compactTimelineSnippet: String(raw.compactTimelineSnippet || ""),
    sessionsOverviewLines: Array.isArray(raw.sessionsOverviewLines)
      ? raw.sessionsOverviewLines.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 40)
      : [],
    continuitySummary,
    pdfInclude: pdfIn,
  };
  if (
    !out.caseId &&
    !out.caseTitle &&
    !out.compactTimelineSnippet &&
    !out.sessionsOverviewLines.length &&
    !out.continuitySummary
  ) {
    return null;
  }
  return out;
}

/**
 * @param {object} patch partial longitudinal case state
 */
export function setLongitudinalCaseData(patch) {
  const s = loadPreVisitSession();
  if (!s) return null;
  const prev = normalizeLongitudinalCase(s.longitudinalCase) || {
    caseId: "",
    caseTitle: "",
    compactTimelineSnippet: "",
    sessionsOverviewLines: [],
    continuitySummary: null,
    pdfInclude: defaultLongitudinalPdfInclude(),
  };
  const pdfMerge = {
    ...prev.pdfInclude,
    ...(patch.pdfInclude && typeof patch.pdfInclude === "object"
      ? patch.pdfInclude
      : {}),
  };
  const nextLc = {
    caseId:
      patch.caseId !== undefined ? String(patch.caseId || "") : prev.caseId,
    caseTitle:
      patch.caseTitle !== undefined
        ? String(patch.caseTitle || "")
        : prev.caseTitle,
    compactTimelineSnippet:
      patch.compactTimelineSnippet !== undefined
        ? String(patch.compactTimelineSnippet || "")
        : prev.compactTimelineSnippet,
    sessionsOverviewLines:
      patch.sessionsOverviewLines !== undefined
        ? Array.isArray(patch.sessionsOverviewLines)
          ? patch.sessionsOverviewLines
              .map((x) => String(x || "").trim())
              .filter(Boolean)
              .slice(0, 40)
          : prev.sessionsOverviewLines
        : prev.sessionsOverviewLines,
    continuitySummary:
      patch.continuitySummary !== undefined
        ? patch.continuitySummary
        : prev.continuitySummary,
    pdfInclude: pdfMerge,
  };
  const normalized = normalizeLongitudinalCase(nextLc);
  const next = { ...s, ...(normalized ? { longitudinalCase: normalized } : {}) };
  if (!normalized) delete next.longitudinalCase;
  savePreVisitSession(next);
  return next;
}

/**
 * Start a blank follow-up preparation while preserving case linkage & optional compact snippet.
 */
export function resetSessionForCaseFollowUp({
  patientLanguage: plIn,
  caseId,
  caseTitle,
  compactTimelineSnippet = "",
  continuitySummary = null,
}) {
  let locale = "de";
  try {
    const fromStorage = sessionStorage.getItem(PREVISIT_LOCALE_STORAGE_KEY);
    const fromSession = loadPreVisitSession()?.patientLanguage;
    locale = plIn || fromStorage || fromSession || "de";
  } catch {
    locale = plIn || loadPreVisitSession()?.patientLanguage || "de";
  }
  const fresh = {
    patientLanguage: locale,
    doctorLanguage: locale,
    answers: createEmptyAnswers(),
    stepIndex: 0,
    longitudinalCase: normalizeLongitudinalCase({
      caseId: String(caseId || ""),
      caseTitle: String(caseTitle || ""),
      compactTimelineSnippet: String(compactTimelineSnippet || ""),
      continuitySummary,
      pdfInclude: defaultLongitudinalPdfInclude(),
      sessionsOverviewLines: [],
    }),
  };
  savePreVisitSession(fresh);
  try {
    sessionStorage.setItem(PREVISIT_LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
  return fresh;
}

/**
 * Optional patient identity block used only for document assignment in Pre-Visit.
 * Values are stored in session only after explicit user input.
 * @param {{
 *  patientName: string,
 *  patientEmail: string,
 *  patientDateOfBirth: string,
 *  patientGenderOrSalutation: string,
 *  patientPhone: string
 * }} patch
 */
export function setOptionalPatientIdentity(patch) {
  const s = loadPreVisitSession();
  if (!s) return null;
  const current =
    s.patientIdentity && typeof s.patientIdentity === "object"
      ? s.patientIdentity
      : {};
  const next = {
    ...s,
    patientIdentity: {
      patientName: String(patch.patientName ?? current.patientName ?? ""),
      patientEmail: String(patch.patientEmail ?? current.patientEmail ?? ""),
      patientDateOfBirth: String(
        patch.patientDateOfBirth ?? current.patientDateOfBirth ?? ""
      ),
      patientGenderOrSalutation: String(
        patch.patientGenderOrSalutation ??
          current.patientGenderOrSalutation ??
          ""
      ),
      patientPhone: String(patch.patientPhone ?? current.patientPhone ?? ""),
    },
  };
  savePreVisitSession(next);
  return next;
}

export function setCaseTimelineData(patch) {
  const s = loadPreVisitSession();
  if (!s) return null;
  const current =
    s.caseTimeline && typeof s.caseTimeline === "object" ? s.caseTimeline : {};
  const next = {
    ...s,
    caseTimeline: {
      relatedSessionId: String(
        patch.relatedSessionId ?? current.relatedSessionId ?? ""
      ),
      caseTopic: String(patch.caseTopic ?? current.caseTopic ?? ""),
      includeInPdf: Boolean(
        patch.includeInPdf ?? current.includeInPdf ?? false
      ),
      summary:
        patch.summary === undefined
          ? current.summary ?? null
          : patch.summary,
    },
  };
  savePreVisitSession(next);
  return next;
}

export function setPracticeContext(patch) {
  const s = loadPreVisitSession();
  const base = s && typeof s === "object" ? s : buildInitialSession("de");
  const current =
    base.practiceContext && typeof base.practiceContext === "object"
      ? base.practiceContext
      : {};
  const preferredDoctorLanguage = String(
    patch?.preferredDoctorLanguage ?? current.preferredDoctorLanguage ?? ""
  ).trim();
  const next = {
    ...base,
    practiceContext: {
      qrToken: String(patch?.qrToken ?? current.qrToken ?? ""),
      practiceName: String(patch?.practiceName ?? current.practiceName ?? ""),
      targetName: String(patch?.targetName ?? current.targetName ?? ""),
      targetType: String(patch?.targetType ?? current.targetType ?? ""),
      doctorName: String(patch?.doctorName ?? current.doctorName ?? ""),
      specialty: String(patch?.specialty ?? current.specialty ?? ""),
      preferredDoctorLanguage,
    },
  };
  if (preferredDoctorLanguage) {
    next.doctorLanguage = preferredDoctorLanguage;
  }
  savePreVisitSession(next);
  return next;
}

/**
 * @param {string} code Language id (e.g. de, en)
 */
export function setDoctorLanguage(code) {
  const s = loadPreVisitSession();
  if (!s) return null;
  const next = { ...s, doctorLanguage: code };
  savePreVisitSession(next);
  return next;
}

/**
 * Persist selected doctor contact id for Pre-Visit document flow (local session only).
 * @param {string | null} contactId server doctor contact id or null to clear
 */
export function setSelectedDoctorContact(contactId) {
  const s = loadPreVisitSession();
  if (!s) return null;
  const next = {
    ...s,
    selectedDoctorContactId:
      contactId === null || contactId === undefined || contactId === ""
        ? null
        : String(contactId),
  };
  savePreVisitSession(next);
  return next;
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
  const s = loadPreVisitSession();
  if (!s?.answers) return null;
  if (!answerKeys().includes(fieldKey)) return null;
  const next = {
    ...s,
    answers: { ...s.answers, [fieldKey]: "" },
  };
  if (next.intakeV1 && Object.prototype.hasOwnProperty.call(next.intakeV1, fieldKey)) {
    const v1 = { ...next.intakeV1 };
    delete v1[fieldKey];
    next.intakeV1 = Object.keys(v1).length > 0 ? v1 : undefined;
  }
  savePreVisitSession(next);
  return next;
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
 * Restores an archived snapshot into the active session (sessionStorage).
 * Aligns patient locale storage so chat/document strings stay consistent.
 * @param {{ patientLanguage?: string, doctorLanguage?: string, answers: object }} item
 * @returns {boolean}
 */
export function hydrateSessionFromArchiveItem(item) {
  if (!item?.answers || typeof item.answers !== "object") return false;
  const completedStep = PRE_VISIT_QUESTION_STEPS.length - 1;
  savePreVisitSession({
    patientLanguage: item.patientLanguage || "de",
    doctorLanguage:
      item.doctorLanguage || item.patientLanguage || "de",
    answers: JSON.parse(JSON.stringify(item.answers)),
    stepIndex: completedStep,
  });
  try {
    sessionStorage.setItem(
      PREVISIT_LOCALE_STORAGE_KEY,
      item.patientLanguage || "de",
    );
  } catch {
    /* ignore */
  }
  return true;
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
