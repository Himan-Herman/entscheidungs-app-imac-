import { authFetch } from "../../../api/authFetch.js";

function qs(practiceId) {
  return `practiceId=${encodeURIComponent(practiceId)}`;
}

export async function fetchDeveloperMeta(practiceId) {
  const res = await authFetch(`/api/practice/developer/meta?${qs(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchApiClients(practiceId) {
  const res = await authFetch(`/api/practice/developer/api-clients?${qs(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createApiClient(practiceId, body) {
  const res = await authFetch(`/api/practice/developer/api-clients?${qs(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function revokeApiClient(practiceId, clientId) {
  const res = await authFetch(
    `/api/practice/developer/api-clients/${encodeURIComponent(clientId)}/revoke?${qs(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchWebhookEndpoints(practiceId) {
  const res = await authFetch(`/api/practice/developer/webhook-endpoints?${qs(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createWebhookEndpoint(practiceId, body) {
  const res = await authFetch(`/api/practice/developer/webhook-endpoints?${qs(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function testWebhookEndpoint(practiceId, endpointId) {
  const res = await authFetch(
    `/api/practice/developer/webhook-endpoints/${encodeURIComponent(endpointId)}/test?${qs(practiceId)}`,
    { method: "POST" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchWebhookDeliveries(practiceId, endpointId) {
  const res = await authFetch(
    `/api/practice/developer/webhook-endpoints/${encodeURIComponent(endpointId)}/deliveries?${qs(practiceId)}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
