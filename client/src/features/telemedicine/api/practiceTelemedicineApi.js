import { authFetch } from "../../../api/authFetch.js";

function qs(practiceId, extra = {}) {
  const p = new URLSearchParams({ practiceId, ...extra });
  return p.toString();
}

export async function fetchPracticeTelemedicineSessions(practiceId, params = {}) {
  const res = await authFetch(`/api/practice/telemedicine?${qs(practiceId, params)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticeTelemedicineSession(practiceId, sessionId) {
  const res = await authFetch(
    `/api/practice/telemedicine/${encodeURIComponent(sessionId)}?${qs(practiceId)}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function startPracticeSession(practiceId, sessionId) {
  const res = await authFetch(
    `/api/practice/telemedicine/${encodeURIComponent(sessionId)}/start?${qs(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function completePracticeSession(practiceId, sessionId) {
  const res = await authFetch(
    `/api/practice/telemedicine/${encodeURIComponent(sessionId)}/complete?${qs(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function cancelPracticeSession(practiceId, sessionId) {
  const res = await authFetch(
    `/api/practice/telemedicine/${encodeURIComponent(sessionId)}/cancel?${qs(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function revokePracticeSessionLink(practiceId, sessionId) {
  const res = await authFetch(
    `/api/practice/telemedicine/${encodeURIComponent(sessionId)}/revoke-link?${qs(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchVideoSettings(practiceId) {
  const res = await authFetch(`/api/practice/telemedicine/settings/video?${qs(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchVideoSettings(practiceId, body) {
  const res = await authFetch(`/api/practice/telemedicine/settings/video?${qs(practiceId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function telemedicineAiInstructions(practiceId, body) {
  const res = await authFetch(`/api/practice/telemedicine/ai-instructions?${qs(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function telemedicineAiFollowup(practiceId, sessionId, body) {
  const res = await authFetch(
    `/api/practice/telemedicine/${encodeURIComponent(sessionId)}/ai-followup-note?${qs(practiceId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
