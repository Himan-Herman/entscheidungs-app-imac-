import express from "express";
import { getPracticeAccess } from "../utils/practiceAccess.js";
import { hasPracticePermission, PERMISSIONS } from "../utils/practicePermissions.js";
import { getPracticePreVisitSetup } from "../services/practicePreVisitSetupService.js";

const router = express.Router();

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * GET /api/practice/pre-visit/setup?practiceId=...
 * Read-only appointment-preparation setup overview for a practice.
 * Authorization: active member/owner with BOOKING_MANAGE
 * (owner / admin / practice_manager). Returns no patient or medical content.
 */
router.get("/setup", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });

  // null = practice not found OR requester is not an active member.
  // 404 avoids disclosing practice existence to non-members.
  const access = await getPracticeAccess(userId, practiceId);
  if (!access) return res.status(404).json({ ok: false, error: "practice_not_found" });

  if (!hasPracticePermission(access.role, PERMISSIONS.BOOKING_MANAGE)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const setup = await getPracticePreVisitSetup(practiceId, access.role);
    return res.json({ ok: true, ...setup });
  } catch (e) {
    console.error("[practice/pre-visit/setup]", e?.message || e);
    return res.status(500).json({ ok: false, error: "setup_failed" });
  }
});

export default router;
