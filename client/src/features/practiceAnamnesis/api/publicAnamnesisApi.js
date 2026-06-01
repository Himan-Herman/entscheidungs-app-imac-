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
