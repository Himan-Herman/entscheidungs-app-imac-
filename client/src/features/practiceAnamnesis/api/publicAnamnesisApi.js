const BASE = "/api/public/anamnesis";

export async function fetchPublicAnamnesisLink(token) {
  const res = await fetch(`${BASE}/qr/${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function submitPublicAnamnesis(token, body) {
  const res = await fetch(`${BASE}/qr/${encodeURIComponent(token)}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Requests AI translation of question labels into the patient's language.
 * Only question text is forwarded — no patient data.
 *
 * @param {string} token
 * @param {{ targetLang: string, sourceLang?: string, labels: { id: string, text: string }[] }} body
 */
export async function translatePublicAnamnesisLabels(token, body) {
  const res = await fetch(`${BASE}/qr/${encodeURIComponent(token)}/translate-labels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
