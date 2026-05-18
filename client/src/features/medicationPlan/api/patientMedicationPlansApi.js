import { authFetch } from "../../../api/authFetch.js";

export async function fetchPatientMedicationPlans() {
  const res = await authFetch("/api/patient/medication-plans");
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPatientMedicationPlan(planId) {
  const res = await authFetch(
    `/api/patient/medication-plans/${encodeURIComponent(planId)}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function submitPatientMedicationPlanQuestion(planId) {
  const res = await authFetch(
    `/api/patient/medication-plans/${encodeURIComponent(planId)}/question`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPatientMedicationPlanAiSimple(planId, { locale } = {}) {
  const res = await authFetch(
    `/api/patient/medication-plans/${encodeURIComponent(planId)}/ai-simple-language`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
