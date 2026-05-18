import { authFetch } from "../../../api/authFetch.js";

function qPractice(practiceId) {
  return new URLSearchParams({ practiceId }).toString();
}

function base(linkId) {
  return `/api/practice/patients/${encodeURIComponent(linkId)}/medication-plans`;
}

export async function fetchPracticeMedicationPlans(linkId, practiceId) {
  const res = await authFetch(`${base(linkId)}?${qPractice(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createPracticeMedicationPlan(linkId, practiceId, payload) {
  const res = await authFetch(`${base(linkId)}?${qPractice(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticeMedicationPlan(linkId, practiceId, planId) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(planId)}?${qPractice(practiceId)}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function updatePracticeMedicationPlan(linkId, practiceId, planId, payload) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(planId)}?${qPractice(practiceId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function publishPracticeMedicationPlan(linkId, practiceId, planId) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(planId)}/publish?${qPractice(practiceId)}`,
    { method: "POST" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function archivePracticeMedicationPlan(linkId, practiceId, planId) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(planId)}/archive?${qPractice(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function deletePracticeMedicationPlan(linkId, practiceId, planId) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(planId)}/delete?${qPractice(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticeMedicationPlanAiFormat(
  linkId,
  practiceId,
  planId,
  { locale } = {},
) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(planId)}/ai-format?${qPractice(practiceId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
