import express from "express";
import { getPracticeAccess } from "../utils/practiceAccess.js";
import { hasPracticePermission, PERMISSIONS } from "../utils/practicePermissions.js";
import { listPracticeConsentOverview } from "../services/consent/practiceConsentOverviewService.js";

const router = express.Router();

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * GET /api/practice/consents/overview?practiceId=...&limit=&offset=
 * Read-only practice-side consent metadata overview.
 * Authorization: active member/owner of the practice with AUDIT_VIEW
 * (owner / admin / practice_manager). No medical content is returned.
 */
router.get("/overview", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });

  // null = practice not found OR requester is not an active member.
  // Return 404 to avoid disclosing practice existence to non-members.
  const access = await getPracticeAccess(userId, practiceId);
  if (!access) return res.status(404).json({ ok: false, error: "practice_not_found" });

  // Member of the practice but role lacks consent-oversight permission.
  if (!hasPracticePermission(access.role, PERMISSIONS.AUDIT_VIEW)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
    const offset = req.query.offset != null ? Number(req.query.offset) : undefined;
    const result = await listPracticeConsentOverview(practiceId, { limit, offset });
    return res.json({ ok: true, ...result });
  } catch (e) {
    console.error("[practice/consents/overview]", e?.message || e);
    return res.status(500).json({ ok: false, error: "consents_overview_failed" });
  }
});

export default router;
