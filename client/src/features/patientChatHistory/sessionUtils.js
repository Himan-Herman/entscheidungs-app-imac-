import { getPrimaryIntlLocale } from '../../i18n/intlLocale.js';
import {
  SESSION_STATUS_COMPLETED,
  SESSION_STATUS_DRAFT,
  SESSION_STATUS_ACTIVE,
} from "./constants.js";

/**
 * @param {import('./types.js').PatientChatSession} session
 */
export function deriveSessionStatus(session) {
  if (session.summary) return SESSION_STATUS_COMPLETED;
  const userMsgs = (session.verlauf || []).filter((m) => m.role === "user");
  if (userMsgs.length === 0) return SESSION_STATUS_DRAFT;
  return SESSION_STATUS_ACTIVE;
}

/**
 * @param {import('./types.js').PatientChatSession} session
 * @param {'de'|'en'} locale
 * @param {{ defaultSymptomTitle: string }} labels
 */
export function buildSessionTitle(session, locale, labels) {
  const firstUser = (session.verlauf || []).find((m) => m.role === "user" && m.content?.trim());
  const snippet = firstUser?.content?.trim().replace(/\s+/g, " ").slice(0, 48);

  if (session.kind === "body_map") {
    const region = session.organLabel || session.organ?.replace(/_/g, " ") || "";
    const date = formatShortDate(session.updatedAt || session.createdAt, locale);
    if (region && date) return `${region} – ${date}`;
    if (region) return region;
    return labels.defaultBodyMapTitle || "Body region";
  }

  if (snippet) {
    return snippet.length >= 48 ? `${snippet}…` : snippet;
  }
  return labels.defaultSymptomTitle;
}

function formatShortDate(iso, locale) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(getPrimaryIntlLocale(locale), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function newSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
