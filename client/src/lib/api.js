// client/src/lib/api.js
const RAW = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
export const API_BASE = RAW.replace(/\/+$/, ''); // kein trailing slash

function buildUrl(path) {
  if (typeof path !== 'string') throw new Error('apiFetch: path must be a string');
  // Wenn schon volle URL (http/https), unverändert lassen:
  if (/^https?:\/\//i.test(path)) return path;
  // sonst an API_BASE anhängen
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiFetch(path, init = {}) {
  const url = buildUrl(path);
  const isFormData = init && init.body instanceof FormData;

  const headers = {
    ...(init.headers || {})
  };
  // Content-Type NUR für JSON setzen (nicht bei FormData!)
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const resp = await fetch(url, {
    credentials: 'include',
    ...init,
    headers
  });
  
  // Fehlerhandling + JSON-Rückgabe
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status} – ${text || resp.statusText}`);
  }
  
  // Versuch JSON zu parsen, sonst leere Antwort
  try {
    return await resp.json();
  } catch {
    return {};
  }
  
}

// Bequemer Helper für Uploads
export async function apiFetchForm(path, formData, init = {}) {
  const url = buildUrl(path);
  return fetch(url, {
    method: init.method || 'POST',
    body: formData,
    credentials: 'include',
    ...init
  });
}
