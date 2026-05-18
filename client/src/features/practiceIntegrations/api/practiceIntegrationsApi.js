import { authFetch } from "../../../api/authFetch.js";

function q(practiceId) {
  return `practiceId=${encodeURIComponent(practiceId)}`;
}

export async function fetchIntegrationsOverview(practiceId) {
  const res = await authFetch(`/api/practice/integrations?${q(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createIntegrationConnection(practiceId, body) {
  const res = await authFetch(`/api/practice/integrations?${q(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function testIntegrationConnection(practiceId, connectionId) {
  const res = await authFetch(
    `/api/practice/integrations/${encodeURIComponent(connectionId)}/test?${q(practiceId)}`,
    { method: "POST" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function disableIntegrationConnection(practiceId, connectionId) {
  const res = await authFetch(
    `/api/practice/integrations/${encodeURIComponent(connectionId)}/disable?${q(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createIntegrationJob(practiceId, connectionId, body) {
  const res = await authFetch(
    `/api/practice/integrations/${encodeURIComponent(connectionId)}/jobs?${q(practiceId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchIntegrationSandbox(practiceId) {
  const res = await authFetch(`/api/practice/integrations/sandbox?${q(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postFhirPreview(practiceId, body) {
  const res = await authFetch(`/api/practice/integrations/fhir/preview?${q(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postHl7Parse(practiceId, body) {
  const res = await authFetch(`/api/practice/integrations/hl7v2/parse?${q(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postAiMappingSummary(practiceId, body) {
  const res = await authFetch(
    `/api/practice/integrations/ai-mapping-summary?${q(practiceId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
