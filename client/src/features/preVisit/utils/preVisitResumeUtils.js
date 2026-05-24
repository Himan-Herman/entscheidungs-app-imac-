import { PRE_VISIT_QUESTION_STEPS } from "../constants/questionFlow.js";
import {
  computePreVisitAiFingerprint,
  normalizeLongitudinalCase,
  PREVISIT_LOCALE_STORAGE_KEY,
  savePreVisitSession,
} from "../constants/preVisitSession.js";

/** @param {Record<string, unknown> | null | undefined} answers */
export function inferStepIndexFromAnswers(answers) {
  if (!answers || typeof answers !== "object") return 0;
  for (let i = 0; i < PRE_VISIT_QUESTION_STEPS.length; i += 1) {
    const key = PRE_VISIT_QUESTION_STEPS[i].key;
    const raw = answers[key];
    if (raw == null || String(raw).trim() === "") return i;
  }
  return PRE_VISIT_QUESTION_STEPS.length - 1;
}

/** @param {Record<string, unknown> | null | undefined} answers */
export function allIntakeStepsAnswered(answers) {
  if (!answers || typeof answers !== "object") return false;
  return PRE_VISIT_QUESTION_STEPS.every((step) => {
    const raw = answers[step.key];
    return raw != null && String(raw).trim() !== "";
  });
}

/**
 * @param {{ status?: string, pdfDownloaded?: boolean, aiDoctorVersion?: unknown, answers?: object }} record
 */
export function isAccountSessionCompleted(record) {
  const status = record?.status || "draft";
  if (status === "completed" || status === "pdf_created") return true;
  return record?.pdfDownloaded === true;
}

/**
 * @param {{ status?: string, pdfDownloaded?: boolean, aiDoctorVersion?: unknown, answers?: object }} record
 * @returns {{ path: string, state?: object }}
 */
export function resolveAccountSessionResumeTarget(record) {
  if (isAccountSessionCompleted(record)) {
    return { path: "/pre-visit/document", state: { fromArchive: true } };
  }

  const answers =
    record?.answers && typeof record.answers === "object" && !Array.isArray(record.answers)
      ? record.answers
      : {};

  if (record?.aiDoctorVersion != null) {
    return {
      path: "/pre-visit/document",
      state: { fromArchive: true, resumeNotice: "draftDocument" },
    };
  }

  if (allIntakeStepsAnswered(answers)) {
    return { path: "/pre-visit/review", state: { fromArchive: true } };
  }

  const stepIndex = inferStepIndexFromAnswers(answers);
  return {
    path: "/pre-visit/chat",
    state: { fromArchive: true, resumeStep: stepIndex },
  };
}

/**
 * Hydrate a server session into local workflow storage for resume/open.
 * @param {object} record
 * @param {{ resumeTarget?: { path: string, state?: object } }} [options]
 */
export function hydrateServerSessionToLocal(record, options = {}) {
  const answers =
    record.answers &&
    typeof record.answers === "object" &&
    !Array.isArray(record.answers)
      ? JSON.parse(JSON.stringify(record.answers))
      : {};
  const doctorLang = record.doctorLanguage || record.patientLanguage || "de";
  const patientLang = record.patientLanguage || "de";
  const completed = isAccountSessionCompleted(record);
  const stepIndex = completed
    ? PRE_VISIT_QUESTION_STEPS.length - 1
    : inferStepIndexFromAnswers(answers);

  const payload = {
    patientLanguage: patientLang,
    doctorLanguage: doctorLang,
    answers,
    stepIndex,
  };

  if (typeof record.id === "string" && record.id.trim()) {
    payload.cloudSessionId = record.id.trim();
  }

  if (record.aiDoctorVersion != null) {
    payload.aiDoctorVersion = record.aiDoctorVersion;
    payload.aiSafetyNotice =
      typeof record.aiSafetyNotice === "string" ? record.aiSafetyNotice : "";
    payload.aiDoctorVersionFingerprint = computePreVisitAiFingerprint(
      answers,
      doctorLang,
    );
  }

  const caseTimeline =
    answers?.caseTimeline &&
    typeof answers.caseTimeline === "object" &&
    !Array.isArray(answers.caseTimeline)
      ? answers.caseTimeline
      : null;
  if (caseTimeline) {
    payload.caseTimeline = {
      relatedSessionId: String(caseTimeline.relatedSessionId || ""),
      caseTopic: String(caseTimeline.caseTopic || ""),
      includeInPdf: Boolean(caseTimeline.includeInPdf),
      summary:
        caseTimeline.summary && typeof caseTimeline.summary === "object"
          ? caseTimeline.summary
          : null,
    };
  }

  if (record.pdfDownloaded === true || record.status === "pdf_created") {
    payload.pdfDownloaded = true;
  }

  const cid =
    typeof record.preVisitCaseId === "string" ? record.preVisitCaseId.trim() : "";
  if (cid) {
    const nl = normalizeLongitudinalCase({ caseId: cid });
    if (nl) payload.longitudinalCase = nl;
  }

  savePreVisitSession(payload);
  try {
    sessionStorage.setItem(PREVISIT_LOCALE_STORAGE_KEY, patientLang);
  } catch {
    /* ignore */
  }

  return options.resumeTarget || resolveAccountSessionResumeTarget(record);
}

export function previewFromAnswers(answers, maxLen = 140) {
  const raw =
    String(answers?.appointmentReason || "").trim() ||
    String(answers?.symptomsOwnWords || "").trim() ||
    "";
  if (!raw) return "—";
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen).trim()}…`;
}
