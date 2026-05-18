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
