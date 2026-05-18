import { authFetch } from "../../../api/authFetch.js";

export async function fetchPatientAppointments() {
  const res = await authFetch("/api/patient/appointments");
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function requestPatientAppointment(body) {
  const res = await authFetch("/api/patient/appointments/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function confirmPatientAppointment(appointmentId) {
  const res = await authFetch(
    `/api/patient/appointments/${encodeURIComponent(appointmentId)}/confirm`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function cancelRequestPatientAppointment(appointmentId, body = {}) {
  const res = await authFetch(
    `/api/patient/appointments/${encodeURIComponent(appointmentId)}/cancel-request`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
