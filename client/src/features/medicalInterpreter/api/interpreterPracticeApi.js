import { authFetch } from "../../../api/authFetch.js";

/**
 * GET /api/interpreter/practice/status — B2B layer availability.
 * @param {{ practiceId?: string }} [opts]
 * @returns {Promise<{ ok: boolean; enabled?: boolean; canView?: boolean; error?: string }>}
 */
export async function fetchInterpreterPracticeStatus(opts = {}) {
  const practiceId = String(opts.practiceId || "").trim();
  const qs = practiceId
    ? `?practiceId=${encodeURIComponent(practiceId)}`
    : "";
  try {
    const res = await authFetch(`/api/interpreter/practice/status${qs}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        enabled: false,
        error: data?.error || "medical_interpreter_b2b_disabled",
      };
    }
    const practiceAccess = data.practiceAccess;
    return {
      ok: true,
      enabled: data.b2bEnabled === true || data.enabled === true,
      interpreterEnabled: data.interpreterEnabled === true,
      canView:
        practiceAccess == null
          ? true
          : practiceAccess.canView === true,
      practiceAccess: practiceAccess || null,
    };
  } catch {
    return { ok: false, enabled: false, error: "network" };
  }
}

/**
 * @param {{ practiceId: string }} opts
 */
export async function fetchPracticeInterpreterSessions(opts) {
  const practiceId = String(opts.practiceId || "").trim();
  if (!practiceId) return { ok: false, error: "practiceId_required" };
  try {
    const res = await authFetch(
      `/api/interpreter/practice/sessions?practiceId=${encodeURIComponent(practiceId)}`,
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || "request_failed", sessions: [] };
    }
    return {
      ok: true,
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      documentationLabel: data.documentationLabel,
      communicationNotice: data.communicationNotice,
    };
  } catch {
    return { ok: false, error: "network", sessions: [] };
  }
}

/**
 * @param {{ practiceId: string; linkId: string }} opts
 */
export async function fetchPracticeInterpreterSessionDetail(opts) {
  const practiceId = String(opts.practiceId || "").trim();
  const linkId = String(opts.linkId || "").trim();
  if (!practiceId || !linkId) return { ok: false, error: "validation" };
  try {
    const res = await authFetch(
      `/api/interpreter/practice/sessions/${encodeURIComponent(linkId)}?practiceId=${encodeURIComponent(practiceId)}`,
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || "request_failed", message: data.message };
    }
    return { ok: true, session: data.session };
  } catch {
    return { ok: false, error: "network" };
  }
}

/**
 * @param {{ practiceId: string; linkId: string }} opts
 */
export async function revokePracticeSessionLink(opts) {
  const practiceId = String(opts.practiceId || "").trim();
  const linkId = String(opts.linkId || "").trim();
  try {
    const res = await authFetch(
      `/api/interpreter/practice/session-links/${encodeURIComponent(linkId)}/revoke?practiceId=${encodeURIComponent(practiceId)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    );
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok !== false, error: data.error, message: data.message };
  } catch {
    return { ok: false, error: "network" };
  }
}
