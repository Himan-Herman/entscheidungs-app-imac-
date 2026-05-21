import {
  INTERPRETER_MAX_TURN_CHARS,
} from "../../config/interpreterEnv.js";
import {
  INTERPRETER_CLOUD_FORBIDDEN_KEYS,
  INTERPRETER_CLOUD_MAX_BODY_KEYS,
  INTERPRETER_CLOUD_MAX_CHARS_PER_SESSION,
  INTERPRETER_CLOUD_MAX_TURNS_PER_SESSION,
  INTERPRETER_CLOUD_SCHEMA_VERSION,
  INTERPRETER_CLOUD_SESSION_STATUSES,
  INTERPRETER_CLOUD_SPEAKERS,
  INTERPRETER_CLOUD_TURN_STATUSES,
} from "../../config/interpreterCloudEnv.js";
import {
  hasPromptInjectionRisk,
  isSupportedInterpreterLanguage,
  normalizeInterpreterLanguage,
  sanitizeInterpreterTurnText,
} from "./interpreterInputSafety.js";

const MAX_TITLE_LEN = 200;
const MAX_LABEL_LEN = 120;
const CLIENT_SESSION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TURN_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 * @param {number} max
 */
function sanitizeOptionalLabel(value, max) {
  if (value == null || value === "") return undefined;
  const s = sanitizeInterpreterTurnText(String(value)).slice(0, max);
  return s || undefined;
}

const SCOPE_ID_RE = /^[a-z0-9]{20,32}$/i;

/**
 * Optional org/practice scope ids (metadata only — no access grants).
 * @param {unknown} value
 */
function sanitizeOptionalScopeId(value) {
  if (value == null || value === "") return undefined;
  const s = String(value).trim().slice(0, 32);
  if (!SCOPE_ID_RE.test(s)) return undefined;
  return s;
}

/**
 * @param {unknown} obj
 * @param {string} path
 */
function assertNoForbiddenKeys(obj, path = "body") {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  for (const key of Object.keys(obj)) {
    if (INTERPRETER_CLOUD_FORBIDDEN_KEYS.has(key)) {
      return {
        ok: false,
        code: "validation_forbidden_field",
        message: `Field not allowed: ${path}.${key}`,
      };
    }
    const val = obj[key];
    if (val && typeof val === "object") {
      const nested = assertNoForbiddenKeys(val, `${path}.${key}`);
      if (nested) return nested;
    }
  }
  return null;
}

/**
 * @param {unknown} raw
 */
function parseIsoDate(raw) {
  if (raw == null || raw === "") return undefined;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * @param {unknown} turn
 * @param {number} index
 */
function normalizeTurn(turn, index) {
  if (!turn || typeof turn !== "object") {
    return {
      ok: false,
      code: "validation_invalid_turn",
      message: `Invalid turn at index ${index}.`,
    };
  }

  const forbidden = assertNoForbiddenKeys(turn, `turns[${index}]`);
  if (forbidden) return forbidden;

  const turnId = String(turn.turnId || "").trim();
  if (!TURN_ID_RE.test(turnId)) {
    return {
      ok: false,
      code: "validation_invalid_turn_id",
      message: `Invalid turnId at index ${index}.`,
    };
  }

  const speaker = String(turn.speaker || "").trim().toLowerCase();
  if (!INTERPRETER_CLOUD_SPEAKERS.has(speaker)) {
    return {
      ok: false,
      code: "validation_invalid_speaker",
      message: `Invalid speaker at index ${index}.`,
    };
  }

  const sourceLanguage = normalizeInterpreterLanguage(turn.sourceLanguage);
  const targetLanguage = normalizeInterpreterLanguage(turn.targetLanguage);
  if (!sourceLanguage || !targetLanguage) {
    return {
      ok: false,
      code: "validation_invalid_language",
      message: `Invalid language at index ${index}.`,
    };
  }

  const status = String(turn.status || "").trim().toLowerCase();
  if (!INTERPRETER_CLOUD_TURN_STATUSES.has(status)) {
    return {
      ok: false,
      code: "validation_invalid_turn_status",
      message: `Invalid turn status at index ${index}.`,
    };
  }

  const originalText = sanitizeInterpreterTurnText(turn.originalText).slice(
    0,
    INTERPRETER_MAX_TURN_CHARS,
  );
  if (!originalText) {
    return {
      ok: false,
      code: "validation_empty_turn",
      message: `Turn text required at index ${index}.`,
    };
  }

  if (hasPromptInjectionRisk(originalText)) {
    return {
      ok: false,
      code: "validation_unsafe_content",
      message: "Turn text could not be stored.",
    };
  }

  const translatedText =
    turn.translatedText != null
      ? sanitizeInterpreterTurnText(turn.translatedText).slice(
          0,
          INTERPRETER_MAX_TURN_CHARS,
        )
      : undefined;
  const simplifiedText =
    turn.simplifiedText != null
      ? sanitizeInterpreterTurnText(turn.simplifiedText).slice(
          0,
          INTERPRETER_MAX_TURN_CHARS,
        )
      : undefined;

  let confidence;
  if (turn.confidence != null) {
    const c = String(turn.confidence).trim().toLowerCase();
    if (c === "high" || c === "medium" || c === "low") confidence = c;
  }

  const createdAt = parseIsoDate(turn.createdAt);
  if (createdAt === null) {
    return {
      ok: false,
      code: "validation_invalid_date",
      message: `Invalid createdAt at index ${index}.`,
    };
  }

  const editedAtRaw = parseIsoDate(turn.editedAt);

  /** @type {Record<string, unknown>} */
  const normalized = {
    turnId,
    speaker,
    sourceLanguage,
    targetLanguage,
    originalText,
    status,
    createdAt: (createdAt || new Date()).toISOString(),
  };

  if (translatedText) normalized.translatedText = translatedText;
  if (simplifiedText) normalized.simplifiedText = simplifiedText;
  if (confidence) normalized.confidence = confidence;
  if (editedAtRaw) normalized.editedAt = editedAtRaw.toISOString();

  if (turn.translationDirection != null) {
    const dir = sanitizeInterpreterTurnText(turn.translationDirection).slice(
      0,
      32,
    );
    if (dir) normalized.translationDirection = dir;
  }
  if (turn.translationUncertain === true) {
    normalized.translationUncertain = true;
  }
  if (turn.terminologyWarning === true) normalized.terminologyWarning = true;
  if (turn.unclearSource === true) normalized.unclearSource = true;

  return { ok: true, turn: normalized };
}

/**
 * @param {unknown} turns
 */
export function normalizeCloudTurns(turns) {
  if (!Array.isArray(turns)) {
    return {
      ok: false,
      code: "validation_invalid_turns",
      message: "turns must be an array.",
    };
  }
  if (turns.length > INTERPRETER_CLOUD_MAX_TURNS_PER_SESSION) {
    return {
      ok: false,
      code: "validation_too_many_turns",
      message: "Too many turns in this session.",
    };
  }

  /** @type {Record<string, unknown>[]} */
  const normalized = [];
  let charCount = 0;
  const seenTurnIds = new Set();

  for (let i = 0; i < turns.length; i += 1) {
    const result = normalizeTurn(turns[i], i);
    if (!result.ok) return result;
    const t = result.turn;
    const tid = String(t.turnId);
    if (seenTurnIds.has(tid)) {
      return {
        ok: false,
        code: "validation_duplicate_turn_id",
        message: "Duplicate turnId in session.",
      };
    }
    seenTurnIds.add(tid);
    charCount +=
      String(t.originalText).length +
      String(t.translatedText || "").length +
      String(t.simplifiedText || "").length;
    if (charCount > INTERPRETER_CLOUD_MAX_CHARS_PER_SESSION) {
      return {
        ok: false,
        code: "validation_session_too_large",
        message: "Session text exceeds allowed size.",
      };
    }
    normalized.push(t);
  }

  return { ok: true, turns: normalized, turnCount: normalized.length, charCount };
}

/**
 * @param {unknown} body
 * @param {{ requireClientSessionId?: boolean }} [opts]
 */
export function validateInterpreterCloudSessionBody(body, opts = {}) {
  const forbidden = assertNoForbiddenKeys(body, "body");
  if (forbidden) return forbidden;

  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, code: "validation_invalid_body", message: "Invalid body." };
  }

  if (Object.keys(body).length > INTERPRETER_CLOUD_MAX_BODY_KEYS) {
    return {
      ok: false,
      code: "validation_too_many_fields",
      message: "Request contains too many fields.",
    };
  }

  if (body.cloudStorageConsent !== true) {
    return {
      ok: false,
      code: "interpreter_cloud_consent_required",
      message: "Cloud storage consent is required.",
      statusCode: 403,
    };
  }

  const clientSessionId = String(
    body.sessionId || body.clientSessionId || "",
  ).trim();
  if (opts.requireClientSessionId !== false && !CLIENT_SESSION_ID_RE.test(clientSessionId)) {
    return {
      ok: false,
      code: "validation_invalid_session_id",
      message: "Invalid sessionId.",
    };
  }

  const status = String(body.status || "").trim().toLowerCase();
  if (!INTERPRETER_CLOUD_SESSION_STATUSES.has(status)) {
    return {
      ok: false,
      code: "validation_invalid_status",
      message: "Invalid session status.",
    };
  }

  const patientLanguage = normalizeInterpreterLanguage(body.patientLanguage);
  const doctorLanguage = normalizeInterpreterLanguage(body.doctorLanguage);
  if (!patientLanguage || !doctorLanguage) {
    return {
      ok: false,
      code: "validation_invalid_language",
      message: "Invalid session languages.",
    };
  }

  const turnsResult = normalizeCloudTurns(body.turns);
  if (!turnsResult.ok) return turnsResult;

  const schemaVersion =
    typeof body.schemaVersion === "number"
      ? body.schemaVersion
      : INTERPRETER_CLOUD_SCHEMA_VERSION;
  if (schemaVersion !== INTERPRETER_CLOUD_SCHEMA_VERSION) {
    return {
      ok: false,
      code: "validation_unsupported_schema",
      message: "Unsupported schema version.",
    };
  }

  const endedAt = parseIsoDate(body.endedAt);
  if (endedAt === null && body.endedAt != null && body.endedAt !== "") {
    return {
      ok: false,
      code: "validation_invalid_date",
      message: "Invalid endedAt.",
    };
  }

  const appointmentDateTime = parseIsoDate(body.appointmentDateTime);
  if (
    appointmentDateTime === null &&
    body.appointmentDateTime != null &&
    body.appointmentDateTime !== ""
  ) {
    return {
      ok: false,
      code: "validation_invalid_date",
      message: "Invalid appointmentDateTime.",
    };
  }

  return {
    ok: true,
    session: {
      clientSessionId,
      status,
      patientLanguage,
      doctorLanguage,
      organizationId: sanitizeOptionalScopeId(body.organizationId),
      practiceProfileId: sanitizeOptionalScopeId(body.practiceProfileId),
      conversationTitle: sanitizeOptionalLabel(
        body.conversationTitle,
        MAX_TITLE_LEN,
      ),
      doctorName: sanitizeOptionalLabel(body.doctorName, MAX_LABEL_LEN),
      practiceName: sanitizeOptionalLabel(body.practiceName, MAX_LABEL_LEN),
      specialty: sanitizeOptionalLabel(body.specialty, MAX_LABEL_LEN),
      appointmentDateTime: appointmentDateTime || undefined,
      profileConsentUsed: body.profileConsentUsed === true,
      cloudStorageConsent: true,
      schemaVersion,
      endedAt: endedAt || undefined,
      turns: turnsResult.turns,
      turnCount: turnsResult.turnCount,
      charCount: turnsResult.charCount,
    },
  };
}

/**
 * @param {string} clientSessionId
 */
export function validateClientSessionIdParam(clientSessionId) {
  const id = String(clientSessionId || "").trim();
  if (!CLIENT_SESSION_ID_RE.test(id)) {
    return {
      ok: false,
      code: "validation_invalid_session_id",
      message: "Invalid session id.",
    };
  }
  return { ok: true, clientSessionId: id };
}

export { isSupportedInterpreterLanguage };
