import { authFetch } from "../../../api/authFetch.js";

/** Appointments of ONE care relationship. The link is the only scope. */
function base(linkId) {
  return `/api/patient/practice/${encodeURIComponent(linkId)}/appointments`;
}

export async function fetchScopedAppointments(linkId, { signal } = {}) {
  const res = await authFetch(base(linkId), { signal });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function confirmScopedAppointment(linkId, appointmentId, { signal } = {}) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(appointmentId)}/confirm`,
    { method: "PATCH", signal },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function cancelScopedAppointmentRequest(linkId, appointmentId, reason, { signal } = {}) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(appointmentId)}/cancel-request`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
      signal,
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
