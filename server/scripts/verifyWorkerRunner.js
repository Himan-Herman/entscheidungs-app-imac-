/**
 * Worker runner + auth smoke tests.
 * Usage: node scripts/verifyWorkerRunner.js
 */

import "dotenv/config";
import { summarizeProcessorResult } from "../worker/summarizeProcessorResult.js";
import {
  isWorkerEnabled,
  isWorkerWebhooksEnabled,
  getWorkerFlagsSnapshot,
} from "../config/workerFlags.js";
import { runWorker } from "../worker/workerRunner.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const wh = summarizeProcessorResult("webhooks", {
    claimed: 2,
    delivered: 1,
    failed: 1,
    deadLetter: 0,
  });
  assert(wh.processed === 2 && wh.failed === 1, "webhook summarize");

  const tm = summarizeProcessorResult("telemedicine", {
    waitingCancelled: 1,
    plannedFailed: 1,
    revokedCancelled: 0,
    participantsCleaned: 2,
  });
  assert(tm.processed === 4, "telemedicine summarize");

  process.env.WORKER_ENABLED = "false";
  const disabled = await runWorker({ limit: 1 });
  const blob = JSON.stringify(disabled);
  assert(!/password|secret|Bearer|joinUrl|patientUserId/i.test(blob), "no sensitive keys in disabled response");
  assert(disabled.skipped === true, "master flag off skips run");
  console.log("[verify] disabled run ok");

  process.env.WORKER_ENABLED = "true";
  process.env.WORKER_WEBHOOKS_ENABLED = "false";
  process.env.WORKER_REMINDERS_ENABLED = "false";
  process.env.WORKER_EXPORTS_ENABLED = "false";
  process.env.WORKER_OCR_ENABLED = "false";
  process.env.WORKER_TELEMEDICINE_CLEANUP_ENABLED = "false";

  const allOff = await runWorker({ limit: 1 });
  assert(allOff.ok === true, "all processors disabled still ok");
  assert(allOff.processors.webhooks.skipped === true, "webhooks skipped flag");
  console.log("[verify] per-processor skip ok", getWorkerFlagsSnapshot());

  process.env.WORKER_WEBHOOKS_ENABLED = "true";
  const partial = await runWorker({ limit: 1 });
  const response = JSON.stringify(partial);
  assert(!/@"|email|symptom|diagnosis/i.test(response), "response has no PHI patterns");
  assert(partial.processors.webhooks != null, "webhooks processor present");
  console.log("[verify] partial run ok", {
    ok: partial.ok,
    processors: Object.keys(partial.processors),
  });

  if (process.env.WORKER_CRON_SECRET) {
    const base = process.env.API_BASE_URL || "http://localhost:3000";
    const noAuth = await fetch(`${base}/api/internal/worker/status`);
    assert(noAuth.status === 403 || noAuth.status === 503, "status without secret blocked");
    const withAuth = await fetch(`${base}/api/internal/worker/status`, {
      headers: { Authorization: `Bearer ${process.env.WORKER_CRON_SECRET}` },
    });
    if (withAuth.status === 200) {
      const data = await withAuth.json();
      assert(data.queues != null, "status has queues");
      assert(JSON.stringify(data).length < 50_000, "status response bounded");
      console.log("[verify] HTTP status ok");
    } else {
      console.log("[verify] skip HTTP — server returned", withAuth.status);
    }
  } else {
    console.log("[verify] skip HTTP — WORKER_CRON_SECRET not set");
  }

  console.log("[verify] worker runner ok");
}

main().catch((err) => {
  console.error("[verify] failed:", err.message);
  process.exit(1);
});
