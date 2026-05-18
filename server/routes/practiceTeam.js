/**
 * Practice team roles & permissions.
 * GET    /api/practice/team?practiceId=
 * GET    /api/practice/team/permissions?practiceId=
 * GET    /api/practice/team/pending-invites
 * POST   /api/practice/team/invite?practiceId=
 * POST   /api/practice/team/accept?practiceId=
 * PATCH  /api/practice/team/:membershipId/role?practiceId=
 * PATCH  /api/practice/team/:membershipId/revoke?practiceId=
 * POST   /api/practice/team/ai-permission-summary?practiceId=
 */

import express from "express";
import {
  acceptPracticeTeamInvite,
  invitePracticeTeamMember,
  listPendingInvitesForUser,
  listPracticeTeam,
  revokePracticeTeamMember,
  updatePracticeTeamMemberRole,
  getPracticePermissionsPayload,
} from "../services/practiceTeam/practiceTeamService.js";
import { generatePracticeTeamPermissionSummary } from "../services/practiceTeam/practiceTeamAiService.js";
import { getPracticeAccess } from "../utils/practiceAccess.js";
import { hasPracticePermission, PERMISSIONS } from "../utils/practicePermissions.js";

const router = express.Router();

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (
    [
      "validation_required",
      "email_invalid",
      "role_invalid",
      "user_not_found",
      "member_not_found",
      "invite_not_found",
      "invite_not_pending",
      "cannot_invite_owner",
      "cannot_change_practice_owner",
      "cannot_revoke_practice_owner",
      "cannot_revoke_self",
      "forbidden_role_escalation",
    ].includes(msg)
  ) {
    return { status: msg.startsWith("forbidden") ? 403 : 400, error: msg };
  }
  if (msg === "forbidden" || msg === "practice_not_found") {
    return { status: msg === "forbidden" ? 403 : 404, error: msg };
  }
  if (msg === "ai_not_configured") return { status: 503, error: msg };
  return { status: 500, error: "request_failed" };
}

router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "validation_required" });

  try {
    const data = await listPracticeTeam(userId, practiceId, { req });
    return res.json({ ok: true, ...data });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.get("/permissions", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "validation_required" });

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !hasPracticePermission(access.role, PERMISSIONS.TEAM_VIEW)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  return res.json({
    ok: true,
    ...getPracticePermissionsPayload(access.role),
    canManage: hasPracticePermission(access.role, PERMISSIONS.TEAM_MANAGE),
  });
});

router.get("/pending-invites", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const invites = await listPendingInvitesForUser(userId);
  return res.json({ ok: true, invites });
});

router.post("/invite", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || req.body?.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "validation_required" });

  try {
    const member = await invitePracticeTeamMember(
      userId,
      practiceId,
      {
        email: req.body?.email,
        userId: req.body?.userId,
        role: req.body?.role,
      },
      { req },
    );
    return res.status(201).json({ ok: true, member });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/accept", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || req.body?.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "validation_required" });

  try {
    const member = await acceptPracticeTeamInvite(userId, practiceId, { req });
    return res.json({ ok: true, member });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.patch("/:membershipId/role", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "validation_required" });

  const membershipId = String(req.params.membershipId || "").trim();
  if (!membershipId || membershipId.startsWith("owner-")) {
    return res.status(400).json({ ok: false, error: "cannot_change_practice_owner" });
  }

  try {
    const member = await updatePracticeTeamMemberRole(
      userId,
      membershipId,
      req.body?.role,
      { req },
    );
    return res.json({ ok: true, member });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.patch("/:membershipId/revoke", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const membershipId = String(req.params.membershipId || "").trim();
  if (!membershipId || membershipId.startsWith("owner-")) {
    return res.status(400).json({ ok: false, error: "cannot_revoke_practice_owner" });
  }

  try {
    const member = await revokePracticeTeamMember(userId, membershipId, { req });
    return res.json({ ok: true, member });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/ai-permission-summary", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || req.body?.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "validation_required" });

  try {
    const result = await generatePracticeTeamPermissionSummary(
      userId,
      practiceId,
      { locale: req.body?.locale, focusRole: req.body?.focusRole },
      { req },
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
