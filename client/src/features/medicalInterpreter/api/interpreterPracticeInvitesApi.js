import { authFetch } from "../../../api/authFetch.js";

function practiceQs(practiceId) {
  const id = String(practiceId || "").trim();
  return id ? `?practiceId=${encodeURIComponent(id)}` : "";
}

/**
 * GET /api/interpreter/practice/invites
 * @param {{ practiceId?: string }} opts
 */
export async function fetchPracticeInterpreterInvites(opts = {}) {
  const qs = practiceQs(opts.practiceId);
  try {
    const res = await authFetch(`/api/interpreter/practice/invites${qs}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, invites: [], error: data?.error || "request_failed" };
    }
    return { ok: true, invites: Array.isArray(data.invites) ? data.invites : [] };
  } catch {
    return { ok: false, invites: [], error: "network" };
  }
}

/**
 * POST /api/interpreter/practice/invites
 * @param {{ practiceId?: string; displayName?: string; inviteType?: string; ttlHours?: number }} body
 */
export async function createPracticeInterpreterInvite(body = {}) {
  const qs = practiceQs(body.practiceId);
  try {
    const res = await authFetch(`/api/interpreter/practice/invites${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: body.displayName,
        inviteType: body.inviteType,
        ttlHours: body.ttlHours,
        maxUses: body.maxUses,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.error || "request_failed", message: data?.message };
    }
    return {
      ok: true,
      invite: data.invite,
      token: data.token,
      invitePath: data.invitePath,
      message: data.message,
    };
  } catch {
    return { ok: false, error: "network" };
  }
}

/**
 * POST /api/interpreter/practice/invites/:id/revoke
 * @param {{ practiceId?: string; inviteId: string }} opts
 */
export async function revokePracticeInterpreterInvite(opts) {
  const id = String(opts.inviteId || "").trim();
  const qs = practiceQs(opts.practiceId);
  try {
    const res = await authFetch(
      `/api/interpreter/practice/invites/${encodeURIComponent(id)}/revoke${qs}`,
      { method: "POST" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.error || "request_failed", message: data?.message };
    }
    return { ok: true, invite: data.invite };
  } catch {
    return { ok: false, error: "network" };
  }
}
