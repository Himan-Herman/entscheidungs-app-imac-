import { Router } from "express";
import { requireWorkerCronAuth } from "../middleware/requireWorkerCronAuth.js";
import { runWorkerProcessor } from "../worker/workerRunner.js";
import { getWorkerStatus } from "../worker/workerStatus.js";

const router = Router();

router.use(requireWorkerCronAuth);

/** @deprecated Prefer POST /api/internal/worker/run */
router.post("/run", async (req, res) => {
  try {
    const limitRaw = req.body?.limit ?? req.query?.limit;
    const limit = limitRaw != null ? Number(limitRaw) : undefined;
    const result = await runWorkerProcessor("reminders", {
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    });
    return res.json(result);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "reminder_worker_run_failed",
        message: err?.message,
      }),
    );
    return res.status(500).json({ ok: false, error: "worker_failed" });
  }
});

router.get("/status", async (_req, res) => {
  try {
    const status = await getWorkerStatus();
    return res.json({ ok: true, reminders: status.queues.reminders });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "reminder_worker_status_failed",
        message: err?.message,
      }),
    );
    return res.status(500).json({ ok: false, error: "status_failed" });
  }
});

export default router;
