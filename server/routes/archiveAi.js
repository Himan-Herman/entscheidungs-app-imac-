/**
 * POST /api/archive/ai-summary — organizational archive overview only.
 */

import express from "express";
import { generateArchiveOrganizationalSummary } from "../services/archive/archiveAiSummaryService.js";
import { writeAuditLog } from "../services/auditLogService.js";

const router = express.Router();

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

router.post("/ai-summary", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    const result = await generateArchiveOrganizationalSummary({
      locale: req.body?.locale,
      counts: req.body?.counts,
    });

    await writeAuditLog({
      userId,
      actorRole: req.body?.actorRole || "user",
      action: "archive_ai_summary_created",
      entityType: "archive_summary",
      entityId: userId,
      metadata: {
        archived: Number(req.body?.counts?.archived) || 0,
        deleted: Number(req.body?.counts?.deleted) || 0,
      },
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[archive/ai-summary]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
