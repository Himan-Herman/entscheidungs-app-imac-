/**
 * Practice invite context — sessionStorage only (Phase 4.7).
 * Never persist raw invite tokens here.
 */

export const INTERPRETER_INVITE_CONTEXT_KEY = "medscout_interpreter_invite_context_v1";
export const INTERPRETER_POST_LOGIN_REDIRECT_KEY =
  "medscout_interpreter_post_login_redirect";

/**
 * @typedef {Object} InterpreterInviteContext
 * @property {string} practiceDisplayName
 * @property {string} validatedAt — ISO timestamp
 * @property {'practice_invite'} source
 */

/**
 * @param {InterpreterInviteContext} ctx
 */
export function saveInterpreterInviteContext(ctx) {
  try {
    sessionStorage.setItem(INTERPRETER_INVITE_CONTEXT_KEY, JSON.stringify(ctx));
  } catch {
    /* quota / private mode */
  }
}

/**
 * @returns {InterpreterInviteContext|null}
 */
export function readInterpreterInviteContext() {
  try {
    const raw = sessionStorage.getItem(INTERPRETER_INVITE_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const name = String(parsed?.practiceDisplayName || "").trim().slice(0, 120);
    if (!name) return null;
    return {
      practiceDisplayName: name,
      validatedAt:
        typeof parsed.validatedAt === "string"
          ? parsed.validatedAt
          : new Date().toISOString(),
      source: "practice_invite",
    };
  } catch {
    return null;
  }
}

export function clearInterpreterInviteContext() {
  try {
    sessionStorage.removeItem(INTERPRETER_INVITE_CONTEXT_KEY);
  } catch {
    /* ignore */
  }
}

/** In-memory invite token only — never written to storage (Phase 4). */
let ephemeralInviteToken = null;

/**
 * @param {string | undefined} token
 */
export function setEphemeralInviteToken(token) {
  const t = String(token || "").trim();
  ephemeralInviteToken = t ? t.slice(0, 256) : null;
}

/** @returns {string | null} */
export function peekEphemeralInviteToken() {
  return ephemeralInviteToken;
}

/** @returns {string | null} */
export function consumeEphemeralInviteToken() {
  const t = ephemeralInviteToken;
  ephemeralInviteToken = null;
  return t;
}

/**
 * @param {string} path — internal path only (must start with /)
 */
export function setPostLoginInterpreterRedirect(path) {
  const p = String(path || "").trim();
  if (!p.startsWith("/") || p.startsWith("//")) return;
  try {
    sessionStorage.setItem(INTERPRETER_POST_LOGIN_REDIRECT_KEY, p.slice(0, 256));
  } catch {
    /* ignore */
  }
}

/**
 * @returns {string|null}
 */
export function consumePostLoginInterpreterRedirect() {
  try {
    const p = sessionStorage.getItem(INTERPRETER_POST_LOGIN_REDIRECT_KEY);
    sessionStorage.removeItem(INTERPRETER_POST_LOGIN_REDIRECT_KEY);
    if (!p || !p.startsWith("/") || p.startsWith("//")) return null;
    return p;
  } catch {
    return null;
  }
}
