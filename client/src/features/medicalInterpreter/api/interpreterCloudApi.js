/**
 * Medical Interpreter — cloud session API (Phase 3.2/3.3).
 */

import { authFetch } from "../../../api/authFetch.js";

/**
 * @param {Response} res
 */
async function parseCloudJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: data.error || "generic",
      message: data.message,
      status: res.status,
    };
  }
  return { ok: true, ...data };
}

/**
 * @param {unknown} err
 */
function networkFailure(err) {
  if (err?.message === "SESSION_EXPIRED") {
    return { ok: false, error: "unauthorized", status: 401 };
  }
  return { ok: false, error: "network" };
}

export async function fetchInterpreterCloudPreference() {
  try {
    const res = await authFetch("/api/interpreter/cloud/preference");
    return parseCloudJson(res);
  } catch (err) {
    return networkFailure(err);
  }
}

export async function grantInterpreterCloudConsent() {
  try {
    const res = await authFetch("/api/interpreter/cloud/consent/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return parseCloudJson(res);
  } catch (err) {
    return networkFailure(err);
  }
}

/**
 * @param {{ deleteCloudData?: boolean }} [opts]
 */
export async function revokeInterpreterCloudConsent(opts = {}) {
  try {
    const res = await authFetch("/api/interpreter/cloud/consent/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deleteCloudData: opts.deleteCloudData === true,
      }),
    });
    return parseCloudJson(res);
  } catch (err) {
    return networkFailure(err);
  }
}

export async function fetchInterpreterCloudConsentHistory() {
  try {
    const res = await authFetch("/api/interpreter/cloud/consent/history");
    return parseCloudJson(res);
  } catch (err) {
    return networkFailure(err);
  }
}

export async function listCloudSessions() {
  try {
    const res = await authFetch("/api/interpreter/sessions");
    return parseCloudJson(res);
  } catch (err) {
    return networkFailure(err);
  }
}

/**
 * @param {string} id — client session UUID
 */
export async function getCloudSession(id) {
  try {
    const res = await authFetch(
      `/api/interpreter/sessions/${encodeURIComponent(id)}`,
    );
    return parseCloudJson(res);
  } catch (err) {
    return networkFailure(err);
  }
}

/**
 * @param {object} session — payload from sessionToCloudPayload
 */
export async function createCloudSession(session) {
  try {
    const res = await authFetch("/api/interpreter/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
    });
    return parseCloudJson(res);
  } catch (err) {
    return networkFailure(err);
  }
}

/**
 * @param {string} id
 * @param {object} session
 */
export async function updateCloudSession(id, session) {
  try {
    const res = await authFetch(
      `/api/interpreter/sessions/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      },
    );
    return parseCloudJson(res);
  } catch (err) {
    return networkFailure(err);
  }
}

/**
 * @param {string} id
 */
export async function deleteCloudSession(id) {
  try {
    const res = await authFetch(
      `/api/interpreter/sessions/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return parseCloudJson(res);
  } catch (err) {
    return networkFailure(err);
  }
}

/**
 * Download JSON export of all cloud-backed interpreter sessions (GDPR portability).
 */
export async function downloadInterpreterCloudExport() {
  try {
    const res = await authFetch("/api/interpreter/cloud/export");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: data.error || "generic",
        message: data.message,
        status: res.status,
      };
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename =
      match?.[1] || `medscout-interpreter-cloud-export-${new Date().toISOString().slice(0, 10)}.json`;
    return { ok: true, blob, filename };
  } catch (err) {
    return networkFailure(err);
  }
}

export async function deleteAllCloudSessions() {
  try {
    const res = await authFetch("/api/interpreter/sessions", {
      method: "DELETE",
    });
    return parseCloudJson(res);
  } catch (err) {
    return networkFailure(err);
  }
}

/** @deprecated use listCloudSessions */
export const listInterpreterCloudSessions = listCloudSessions;
export const getInterpreterCloudSession = getCloudSession;
export const createInterpreterCloudSession = createCloudSession;
export const updateInterpreterCloudSession = updateCloudSession;
export const deleteInterpreterCloudSession = deleteCloudSession;
export const deleteAllInterpreterCloudSessions = deleteAllCloudSessions;
