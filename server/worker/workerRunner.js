import { isWorkerEnabled, getWorkerFlagsSnapshot } from "../config/workerFlags.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { WORKER_PROCESSORS, getWorkerProcessor } from "./processorRegistry.js";
import { summarizeProcessorResult } from "./summarizeProcessorResult.js";

let lastRunAt = null;
let lastRunSummary = null;

/**
 * @param {string} processorId
 * @param {{ limit?: number }} [opts]
 */
export async function runWorkerProcessor(processorId, opts = {}) {
  const def = getWorkerProcessor(processorId);
  if (!def) {
    throw new Error("unknown_processor");
  }
  if (!isWorkerEnabled() || !def.isEnabled()) {
    return {
      ok: true,
      skipped: true,
      processors: {
        [processorId]: { processed: 0, failed: 0, skipped: true },
      },
    };
  }

  const startedAt = Date.now();
  try {
    const raw = await def.run(opts);
    const summary = summarizeProcessorResult(processorId, raw);
    return {
      ok: true,
      durationMs: Date.now() - startedAt,
      processors: { [processorId]: { ...summary, ok: true } },
    };
  } catch (err) {
    writeAuditLog({
      actorRole: "system",
      action: "worker.processor.failed",
      entityType: "worker_processor",
      entityId: processorId,
      metadata: { error: String(err?.message || "processor_failed").slice(0, 120) },
    });
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      processors: {
        [processorId]: { ok: false, processed: 0, failed: 0, error: "processor_failed" },
      },
    };
  }
}

/**
 * Run all enabled processors sequentially; failures are isolated per processor.
 * @param {{ limit?: number }} [opts]
 */
export async function runWorker(opts = {}) {
  const runStartedAt = Date.now();

  if (!isWorkerEnabled()) {
    return {
      ok: true,
      skipped: true,
      reason: "worker_disabled",
      flags: getWorkerFlagsSnapshot(),
      processors: {},
      durationMs: 0,
      lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
    };
  }

  writeAuditLog({
    actorRole: "system",
    action: "worker.run.started",
    entityType: "worker_run",
    metadata: { limit: opts.limit ?? null },
  });

  /** @type {Record<string, unknown>} */
  const processors = {};
  const failedProcessorIds = [];

  for (const def of WORKER_PROCESSORS) {
    if (!def.isEnabled()) {
      processors[def.id] = { processed: 0, failed: 0, skipped: true, disabled: true };
      continue;
    }

    const t0 = Date.now();
    try {
      const raw = await def.run(opts);
      const summary = summarizeProcessorResult(def.id, raw);
      processors[def.id] = {
        ...summary,
        ok: true,
        durationMs: Date.now() - t0,
      };
    } catch (err) {
      failedProcessorIds.push(def.id);
      processors[def.id] = {
        ok: false,
        processed: 0,
        failed: 0,
        error: "processor_failed",
        durationMs: Date.now() - t0,
      };
      writeAuditLog({
        actorRole: "system",
        action: "worker.processor.failed",
        entityType: "worker_processor",
        entityId: def.id,
        metadata: { error: String(err?.message || "processor_failed").slice(0, 120) },
      });
      console.error(
        JSON.stringify({
          level: "error",
          event: "worker_processor_failed",
          processor: def.id,
          message: err?.message,
        }),
      );
    }
  }

  lastRunAt = new Date();
  const durationMs = Date.now() - runStartedAt;
  lastRunSummary = { processors, failedProcessorIds, durationMs };

  writeAuditLog({
    actorRole: "system",
    action: "worker.run.completed",
    entityType: "worker_run",
    metadata: {
      durationMs,
      processorCount: WORKER_PROCESSORS.length,
      failedProcessors: failedProcessorIds,
    },
  });

  return {
    ok: failedProcessorIds.length === 0,
    flags: getWorkerFlagsSnapshot(),
    processors,
    durationMs,
    lastRunAt: lastRunAt.toISOString(),
  };
}

export function getWorkerLastRunAt() {
  return lastRunAt ? lastRunAt.toISOString() : null;
}

export function getWorkerLastRunSummary() {
  return lastRunSummary;
}
