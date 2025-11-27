// src/api/authHeaders.js
export function getAuthHeaders() {
    const token = localStorage.getItem("medscout_token");
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }
  