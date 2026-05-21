import { apiFetch } from "../../../lib/api.js";

/**
 * GET /api/interpreter/invite/:token/status — public, no auth.
 * @param {string} token — from URL only; never log.
 * @returns {Promise<{
 *   ok: boolean;
 *   valid?: boolean;
 *   state?: string;
 *   practiceDisplayName?: string;
 *   communicationNotice?: string;
 *   message?: string;
 *   interpreterEnabled?: boolean;
 *   error?: string;
 * }>}
 */
export async function fetchInterpreterInviteStatus(token) {
  const t = String(token || "").trim();
  if (!t) {
    return { ok: false, error: "invalid_token" };
  }
  try {
    const res = await apiFetch(
      `/api/interpreter/invite/${encodeURIComponent(t)}/status`,
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error || "request_failed",
        state: "invalid",
        valid: false,
      };
    }
    return {
      ok: true,
      valid: data.valid === true,
      state: typeof data.state === "string" ? data.state : "invalid",
      practiceDisplayName:
        typeof data.practiceDisplayName === "string"
          ? data.practiceDisplayName
          : undefined,
      communicationNotice:
        typeof data.communicationNotice === "string"
          ? data.communicationNotice
          : undefined,
      message: typeof data.message === "string" ? data.message : undefined,
      interpreterEnabled: data.interpreterEnabled === true,
    };
  } catch {
    return { ok: false, error: "network", state: "invalid", valid: false };
  }
}

/**
 * POST /api/interpreter/invite/:token/start
 * @param {string} token
 */
export async function startInterpreterInviteSession(token) {
  const t = String(token || "").trim();
  if (!t) return { ok: false, error: "invalid_token" };
  try {
    const res = await apiFetch(
      `/api/interpreter/invite/${encodeURIComponent(t)}/start`,
      { method: "POST" },
    );
    const data = await res.json().catch(() => ({}));
    return {
      ok: data.ok !== false,
      started: data.started === true,
      valid: data.valid === true,
      state: data.state,
      practiceDisplayName: data.practiceDisplayName,
      message: data.message,
      communicationNotice: data.communicationNotice,
    };
  } catch {
    return { ok: false, error: "network" };
  }
}
