import crypto from "crypto";
import { isWebhookHealthDataPayloadsEnabled } from "../../config/featureFlags.js";

function pseudonymizePatientId(practiceProfileId, patientUserId) {
  if (!patientUserId || isWebhookHealthDataPayloadsEnabled()) return undefined;
  return crypto
    .createHmac("sha256", String(practiceProfileId))
    .update(String(patientUserId))
    .digest("hex")
    .slice(0, 24);
}

export function buildDeveloperWebhookPayload(practiceProfileId, eventType, meta = {}) {
  const eventId = meta.eventId || crypto.randomUUID();
  return {
    eventId,
    eventType,
    occurredAt: new Date().toISOString(),
    practiceProfileId,
    resourceType: meta.resourceType || null,
    resourceId: meta.resourceId || null,
    practicePatientLinkId: meta.practicePatientLinkId || null,
    patientRef: pseudonymizePatientId(practiceProfileId, meta.patientUserId),
    schemaVersion: 1,
    test: Boolean(meta.test),
    message: meta.message || undefined,
  };
}
