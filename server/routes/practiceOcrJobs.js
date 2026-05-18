import express from "express";
import { requireDocumentOcrFeature } from "../middleware/requireDocumentOcr.js";
import { getPracticeAccess } from "../utils/practiceAccess.js";
import { hasPracticePermission, PERMISSIONS } from "../utils/practicePermissions.js";
import { listPracticeOcrJobs } from "../services/practiceDocument/documentOcrService.js";

const router = express.Router();

router.use(requireDocumentOcrFeature);

router.get("/jobs", async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !hasPracticePermission(access.role, PERMISSIONS.DOCUMENTS_READ)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const jobs = await listPracticeOcrJobs(practiceId);
    return res.json({ ok: true, jobs });
  } catch {
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
