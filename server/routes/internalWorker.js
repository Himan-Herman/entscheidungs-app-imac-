import { Router } from "express";
import { requireWorkerCronAuth } from "../middleware/requireWorkerCronAuth.js";
import { runWorker, runWorkerProcessor } from "../worker/workerRunner.js";
import { getWorkerStatus } from "../worker/workerStatus.js";

const router = Router();

router.use(requireWorkerCronAuth);

function parseLimit(req) {
  const limitRaw = req.body?.limit ?? req.query?.limit;
  const limit = limitRaw != null ? Number(limitRaw) : undefined;
  return Number.isFinite(limit) && limit > 0 ? limit : undefined;
}

/** Combined Postgres outbox worker — Render Cron target. */
router.post("/run", async (req, res) => {
  try {
    const result = await runWorker({ limit: parseLimit(req) });
    const status = result.ok ? 200 : 207;
    return res.status(status).json(result);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "worker_run_failed",
        message: err?.message,
      }),
    );
    return res.status(500).json({ ok: false, error: "worker_failed" });
  }
});

router.get("/status", async (_req, res) => {
  try {
    const status = await getWorkerStatus();
    return res.json({ ok: true, ...status });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "worker_status_failed",
        message: err?.message,
      }),
    );
    return res.status(500).json({ ok: false, error: "status_failed" });
  }
});

/** @deprecated Prefer POST /run — kept for existing cron configs. */
router.post("/webhooks/run", async (req, res) => {
  try {
    const result = await runWorkerProcessor("webhooks", { limit: parseLimit(req) });
    return res.json(result);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "webhook_worker_run_failed",
        message: err?.message,
      }),
    );
    return res.status(500).json({ ok: false, error: "worker_failed" });
  }
});

router.post("/telemedicine/cleanup/run", async (req, res) => {
  try {
    const result = await runWorkerProcessor("telemedicine", { limit: parseLimit(req) });
    return res.json(result);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "telemedicine_cleanup_run_failed",
        message: err?.message,
      }),
    );
    return res.status(500).json({ ok: false, error: "worker_failed" });
  }
});

router.post("/jobs/run", async (req, res) => {
  try {
    const opts = { limit: parseLimit(req) };
    const [exports, ocr, exportCleanup] = await Promise.all([
      runWorkerProcessor("exports", opts),
      runWorkerProcessor("ocr", opts),
      runWorkerProcessor("exportCleanup", opts),
    ]);
    return res.json({
      ok: exports.ok && ocr.ok && exportCleanup.ok,
      processors: {
        ...exports.processors,
        ...ocr.processors,
        ...exportCleanup.processors,
      },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "background_job_worker_run_failed",
        message: err?.message,
      }),
    );
    return res.status(500).json({ ok: false, error: "worker_failed" });
  }
});

router.get("/jobs/status", async (_req, res) => {
  try {
    const status = await getWorkerStatus();
    return res.json({
      ok: true,
      exports: status.queues.exports,
      ocr: status.queues.ocr,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "background_job_status_failed",
        message: err?.message,
      }),
    );
    return res.status(500).json({ ok: false, error: "status_failed" });
  }
});

router.get("/webhooks/status", async (_req, res) => {
  try {
    const status = await getWorkerStatus();
    return res.json({ ok: true, webhooks: status.queues.webhooks });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "webhook_worker_status_failed",
        message: err?.message,
      }),
    );
    return res.status(500).json({ ok: false, error: "status_failed" });
  }
});

export default router;
