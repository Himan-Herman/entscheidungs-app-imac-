import { authFetch } from "../../../api/authFetch.js";

function q(practiceId) {
  return `practiceId=${encodeURIComponent(practiceId)}`;
}

export async function fetchAppointments(practiceId, params = {}) {
  const sp = new URLSearchParams({ practiceId, ...params });
  const res = await authFetch(`/api/practice/calendar/appointments?${sp}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createAppointment(practiceId, body) {
  const res = await authFetch(`/api/practice/calendar/appointments?${q(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchAppointment(practiceId, appointmentId, body) {
  const res = await authFetch(
    `/api/practice/calendar/appointments/${encodeURIComponent(appointmentId)}?${q(practiceId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function cancelAppointment(practiceId, appointmentId, body = {}) {
  const res = await authFetch(
    `/api/practice/calendar/appointments/${encodeURIComponent(appointmentId)}/cancel?${q(practiceId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function rescheduleAppointment(practiceId, appointmentId, body) {
  const res = await authFetch(
    `/api/practice/calendar/appointments/${encodeURIComponent(appointmentId)}/reschedule?${q(practiceId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchAppointmentStatus(practiceId, appointmentId, status) {
  const res = await authFetch(
    `/api/practice/calendar/appointments/${encodeURIComponent(appointmentId)}/status?${q(practiceId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchAppointmentTypes(practiceId) {
  const res = await authFetch(`/api/practice/calendar/appointment-types?${q(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchAvailability(practiceId) {
  const res = await authFetch(`/api/practice/calendar/availability?${q(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createAvailability(practiceId, body) {
  const res = await authFetch(`/api/practice/calendar/availability?${q(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function deleteAvailability(practiceId, availabilityId) {
  const res = await authFetch(
    `/api/practice/calendar/availability/${encodeURIComponent(availabilityId)}?${q(practiceId)}`,
    { method: "DELETE" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
