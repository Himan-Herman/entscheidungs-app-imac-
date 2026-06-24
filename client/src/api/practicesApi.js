import { authFetch } from "./authFetch.js";

export { practiceDisplayName } from "./practiceDisplayName.js";

export async function fetchPractices() {
  const res = await authFetch("/api/practices");
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Creates "Medscout Klinik" when the account has no practice yet. */
export async function ensureDemoPractice() {
  const res = await authFetch("/api/practices/ensure-demo", { method: "POST" });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
