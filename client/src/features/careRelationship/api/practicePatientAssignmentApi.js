import { authFetch } from "../../../api/authFetch.js";

function qs(practiceId) {
  return `practiceId=${encodeURIComponent(practiceId)}`;
}

export async function assignPracticePatient(linkId, practiceId, body) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/assign?${qs(practiceId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "request_failed");
  return data.link;
}

export async function unassignPracticePatient(linkId, practiceId) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/unassign?${qs(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "request_failed");
  return data.link;
}

export async function forwardPracticePatient(linkId, practiceId, body) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/forward?${qs(practiceId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "request_failed");
  return data.link;
}

export async function fetchAssignmentHistory(linkId, practiceId) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/assignment-history?${qs(practiceId)}`,
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "request_failed");
  return data.history || [];
}

export async function fetchPracticeDoctors(practiceId) {
  const res = await authFetch(`/api/practice/team/doctors?${qs(practiceId)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "request_failed");
  return data.doctors || [];
}

export async function fetchAiAssignmentSuggestion(linkId, practiceId, locale) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/ai-assignment-suggestion?${qs(practiceId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "request_failed");
  return data;
}

export async function fetchPublicPracticeDoctors(practiceId) {
  const res = await authFetch(
    `/api/practice/team/public-doctors?${qs(practiceId)}`,
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "request_failed");
  return data;
}

export async function patientSelectPracticeDoctor(practiceId, doctorUserId) {
  const res = await authFetch(
    `/api/patient/practices/${encodeURIComponent(practiceId)}/select-doctor`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorUserId: doctorUserId || null }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "request_failed");
  return data.link;
}
