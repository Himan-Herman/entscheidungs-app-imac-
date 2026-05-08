/**
 * Practice integration orchestration — queues outbound webhooks via practiceWebhookService.
 * Do not log medical content, PDF payloads, or raw webhook bodies here.
 */

import { PRACTICE_WEBHOOK_EVENT_TYPES } from "../constants/practiceIntegrationWebhookEvents.js";
import { enqueuePracticeWebhook } from "./practiceWebhookService.js";

/**
 * @param {string} eventType — one of PracticeWebhookEventType
 * @param {Record<string, unknown>} payload — must include practiceProfileId; sanitized metadata only
 * @returns {Promise<{ ok: boolean; skipped?: boolean }>}
 */
export async function notifyPracticeIntegration(eventType, payload = {}) {
  if (!PRACTICE_WEBHOOK_EVENT_TYPES.includes(eventType)) {
    return { ok: false, skipped: true };
  }
  const practiceProfileId =
    typeof payload.practiceProfileId === "string"
      ? payload.practiceProfileId.trim()
      : "";
  if (!practiceProfileId) {
    return { ok: true, skipped: true };
  }
  const rest = { ...payload };
  delete rest.practiceProfileId;
  try {
    await enqueuePracticeWebhook({
      practiceProfileId,
      eventType,
      payload: rest,
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Future: time-limited portal tokens, single-use download artifacts, audit trail rows.
 * @returns {Promise<{ ok: boolean; skipped: boolean }>}
 */
export async function prepareSecureDocumentDelivery(_ctx) {
  // TODO: expiring signed URLs, portal session, AuditLog metadata — no public static PDF URLs.
  return { ok: true, skipped: true };
}

/**
 * Build a minimal webhook JSON envelope (no PHI). Callers must strip clinical fields before send.
 * @param {string} eventType
 * @param {Record<string, unknown>} safeMeta — ids, timestamps, non-sensitive labels only
 */
export function buildWebhookPayload(eventType, safeMeta = {}) {
  return {
    event: eventType,
    emittedAt: new Date().toISOString(),
    schemaVersion: 1,
    data: { ...safeMeta },
  };
}
