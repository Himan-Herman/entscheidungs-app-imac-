import { authFetch } from "../../../api/authFetch.js";

function qs(practiceId, extra = {}) {
  const q = new URLSearchParams({ practiceId, ...extra });
  return q.toString();
}

export async function fetchPracticeTeam(practiceId) {
  const res = await authFetch(`/api/practice/team?${qs(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticeTeamPermissions(practiceId) {
  const res = await authFetch(`/api/practice/team/permissions?${qs(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPendingTeamInvites() {
  const res = await authFetch("/api/practice/team/pending-invites");
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function invitePracticeTeamMember(practiceId, body) {
  const res = await authFetch(`/api/practice/team/invite?${qs(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function acceptPracticeTeamInvite(practiceId) {
  const res = await authFetch(`/api/practice/team/accept?${qs(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchPracticeTeamRole(practiceId, membershipId, role) {
  const res = await authFetch(
    `/api/practice/team/${encodeURIComponent(membershipId)}/role?${qs(practiceId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function revokePracticeTeamMember(practiceId, membershipId) {
  const res = await authFetch(
    `/api/practice/team/${encodeURIComponent(membershipId)}/revoke?${qs(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticeTeamAiSummary(practiceId, body) {
  const res = await authFetch(`/api/practice/team/ai-permission-summary?${qs(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
