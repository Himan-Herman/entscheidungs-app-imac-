import express from "express";
import { requireTelemedicineFeature } from "../middleware/requireTelemedicine.js";
import {
  getTelemedicineSettings,
  patchTelemedicineSettings,
} from "../services/telemedicine/telemedicineSettingsService.js";
import {
  cancelPracticeSession,
  completePracticeSession,
  createPracticeSession,
  getPracticeSession,
  getProviderStatus,
  listPracticeSessions,
  revokeSessionLink,
  startPracticeSession,
} from "../services/telemedicine/telemedicineService.js";
import {
  telemedicineFollowupDraft,
  telemedicineInstructions,
} from "../services/telemedicine/telemedicineAiService.js";
import { getVideoAdapter } from "../services/telemedicine/videoProviderAdapter.js";

const router = express.Router();
router.use(requireTelemedicineFeature);

function uid(req) {
  return req.user?.userId || null;
}

function pid(req) {
  const id = req.query?.practiceId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "forbidden" || msg === "consent_required" || msg === "link_revoked") {
    return { status: 403, error: msg };
  }
  if (msg === "session_not_found" || msg === "practice_not_found") {
    return { status: 404, error: msg };
  }
  if (msg === "ai_not_configured") return { status: 503, error: msg };
  return { status: 500, error: "request_failed" };
}

router.get("/settings/video", async (req, res) => {
  try {
    const settings = await getTelemedicineSettings(uid(req), pid(req));
    return res.json({ ok: true, settings });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/settings/video", async (req, res) => {
  try {
    const settings = await patchTelemedicineSettings(uid(req), pid(req), req.body || {}, { req });
    return res.json({ ok: true, settings });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.get("/", async (req, res) => {
  try {
    const sessions = await listPracticeSessions(uid(req), pid(req), req.query);
    return res.json({ ok: true, sessions });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.post("/", async (req, res) => {
  try {
    const session = await createPracticeSession(uid(req), pid(req), req.body || {}, { req });
    return res.status(201).json({ ok: true, session });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.post("/ai-instructions", async (req, res) => {
  try {
    const result = await telemedicineInstructions(uid(req), pid(req), req.body || {}, { req });
    return res.json({ ok: true, ...result });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.get("/provider/status/:sessionId", async (req, res) => {
  try {
    const status = await getProviderStatus(req.params.sessionId, uid(req), true);
    return res.json({ ok: true, status });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.get("/:sessionId", async (req, res) => {
  try {
    const session = await getPracticeSession(uid(req), pid(req), req.params.sessionId);
    return res.json({ ok: true, session });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/:sessionId/start", async (req, res) => {
  try {
    const result = await startPracticeSession(uid(req), pid(req), req.params.sessionId, { req });
    return res.json({ ok: true, ...result });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/:sessionId/complete", async (req, res) => {
  try {
    const session = await completePracticeSession(uid(req), pid(req), req.params.sessionId, { req });
    return res.json({ ok: true, session });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/:sessionId/cancel", async (req, res) => {
  try {
    const session = await cancelPracticeSession(uid(req), pid(req), req.params.sessionId, { req });
    return res.json({ ok: true, session });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/:sessionId/revoke-link", async (req, res) => {
  try {
    const session = await revokeSessionLink(uid(req), pid(req), req.params.sessionId, { req });
    return res.json({ ok: true, session });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.post("/:sessionId/ai-followup-note", async (req, res) => {
  try {
    const result = await telemedicineFollowupDraft(
      uid(req),
      pid(req),
      req.params.sessionId,
      req.body || {},
      { req },
    );
    return res.json({ ok: true, ...result });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

export default router;
