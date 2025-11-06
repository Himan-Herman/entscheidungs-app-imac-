// client/src/lib/api.js
// Universelle Fetch-Hilfsfunktionen für MedScout

// Automatisch passende API-Base ermitteln
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://api.medscout.app"; // Fallback für Vercel / Deployment

// Hilfsfunktion für vollständige URL
function buildUrl(path) {
  if (typeof path !== "string") {
    throw new Error("apiFetch: path must be a string");
  }
  // Wenn bereits vollständige URL vorhanden:
  if (/^https?:\/\//i.test(path)) return path;
  // sonst anhängen
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Standard-Fetch für JSON (z. B. Chat, Threads, Auth etc.)
 * @param {string} path - Pfad oder vollständige URL
 * @param {object} [init] - Fetch-Optionen
 */
export async function apiFetch(path, init = {}) {
  const url = buildUrl(path);
  const isFormData = init && init.body instanceof FormData;

  const headers = { ...(init.headers || {}) };
  // Nur Content-Type setzen, wenn KEINE FormData
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...init,
    headers,
    // KEINE Cookies nötig → CORS-Fehler vermeiden
    credentials: "omit",
  });

  // Fehlermeldung abfangen
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} – ${text || res.statusText}`);
  }

  try {
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Spezieller Fetch für Datei-Uploads (z. B. Bilder)
 * @param {string} path - API-Endpunkt
 * @param {FormData} formData - zu sendende Datei-Daten
 * @param {object} [init] - zusätzliche Fetch-Optionen
 */
export async function apiFetchForm(path, formData, init = {}) {
  const url = buildUrl(path);

  const res = await fetch(url, {
    method: init.method || "POST",
    body: formData,
    credentials: "omit",
    ...init,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload error ${res.status}: ${text || res.statusText}`);
  }

  return res.json();
}

// API_BASE zur Kontrolle exportieren
export { API_BASE };
