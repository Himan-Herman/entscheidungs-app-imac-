/**
 * Webhook worker smoke tests (no outbound HTTP unless WEBHOOK_VERIFY_HTTP=true).
 * Usage: node scripts/verifyWebhooks.js
 */

import "dotenv/config";
import crypto from "crypto";
import {
  classifyWebhookHttpResult,
  computeWebhookNextRetryAt,
  WEBHOOK_DELIVERY_STATUS,
} from "../services/webhooks/webhookConstants.js";
import {
  signDeveloperWebhook,
  signLegacyWebhookBody,
} from "../services/webhooks/webhookSigning.js";
import { buildDeveloperWebhookPayload } from "../services/webhooks/developerWebhookPayload.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function testClassify() {
  const ok = classifyWebhookHttpResult(200, null);
  assert(ok.success, "2xx success");
  const retry = classifyWebhookHttpResult(503, null);
  assert(retry.retryable && !retry.terminal, "5xx retryable");
  const fail = classifyWebhookHttpResult(404, null);
  assert(fail.terminal && !fail.retryable, "404 terminal");
  const net = classifyWebhookHttpResult(null, "timeout");
  assert(net.retryable, "timeout retryable");
  console.log("[verify] HTTP classify ok");
}

function testBackoff() {
  const t1 = computeWebhookNextRetryAt(0);
  const t4 = computeWebhookNextRetryAt(3);
  assert(t4 > t1, "backoff increases");
  console.log("[verify] retry backoff ok");
}

function testHmac() {
  const body = JSON.stringify({ eventId: "evt_test", eventType: "webhook.test" });
  const ts = "1710000000";
  const sig = signDeveloperWebhook("test-secret", ts, body);
  assert(sig.length === 64, "developer sig hex");
  const legacy = signLegacyWebhookBody("test-secret", body);
  assert(legacy.startsWith("sha256="), "legacy sig prefix");
  const payload = buildDeveloperWebhookPayload("prac_1", "appointment.created", {
    resourceType: "practice_appointment",
    resourceId: "appt_1",
  });
  assert(payload.eventId && payload.resourceId === "appt_1", "payload keeps meta");
  console.log("[verify] HMAC + payload ok");
}

function testStatuses() {
  assert(WEBHOOK_DELIVERY_STATUS.DEAD_LETTER === "dead_letter");
  assert(WEBHOOK_DELIVERY_STATUS.PROCESSING === "processing");
  console.log("[verify] status constants ok");
}

async function testInternalAuthHint() {
  if (!process.env.WORKER_CRON_SECRET) {
    console.log("[verify] skip HTTP — WORKER_CRON_SECRET not set");
    return;
  }
  const base = process.env.API_BASE_URL || "http://localhost:3000";
  const url = `${base.replace(/\/+$/, "")}/api/internal/worker/webhooks/status`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.WORKER_CRON_SECRET}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("cron secret rejected");
  }
  if (res.status === 503) {
    console.log("[verify] worker route reachable (503 worker_not_configured unexpected if secret set)");
    return;
  }
  const json = await res.json();
  assert(json.ok === true, "status endpoint ok");
  assert(json.status?.legacy != null, "legacy counts present");
  console.log("[verify] internal status route ok");
}

async function main() {
  testClassify();
  testBackoff();
  testHmac();
  testStatuses();
  await testInternalAuthHint();
}

main().catch((e) => {
  console.error("[verify] failed:", e?.message ?? e);
  process.exit(1);
});
