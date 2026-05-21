import { authFetch } from "../../../api/authFetch.js";

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: data.error || "request_failed",
      message: data.message,
      status: res.status,
    };
  }
  return { ok: true, ...data };
}

/**
 * @param {string} token
 * @param {Record<string, unknown>} sessionBody
 */
export async function grantPracticeShareViaInviteToken(token, sessionBody) {
  const t = String(token || "").trim();
  if (!t) return { ok: false, error: "invalid_token" };
  try {
    const res = await authFetch(
      `/api/interpreter/invite/${encodeURIComponent(t)}/consent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionBody),
      },
    );
    return parseJson(res);
  } catch {
    return { ok: false, error: "network" };
  }
}

/**
 * @param {string} practiceProfileId
 * @param {Record<string, unknown>} sessionBody
 * @param {string} [inviteId]
 */
export async function grantPracticeShareConsent(practiceProfileId, sessionBody, inviteId) {
  try {
    const res = await authFetch("/api/interpreter/sharing/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        practiceProfileId,
        inviteId,
        ...sessionBody,
      }),
    });
    return parseJson(res);
  } catch {
    return { ok: false, error: "network" };
  }
}

/**
 * @param {string} linkId
 * @param {{ deleteSharedCopy?: boolean }} [opts]
 */
export async function revokePracticeShare(linkId, opts = {}) {
  try {
    const res = await authFetch(
      `/api/interpreter/sharing/${encodeURIComponent(linkId)}/revoke`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deleteSharedCopy: opts.deleteSharedCopy === true,
        }),
      },
    );
    return parseJson(res);
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function fetchPatientPracticeShares() {
  try {
    const res = await authFetch("/api/interpreter/sharing");
    return parseJson(res);
  } catch {
    return { ok: false, error: "network" };
  }
}
