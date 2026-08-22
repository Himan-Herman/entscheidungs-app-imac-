import express from "express";
import { requireTelemedicineFeature } from "../middleware/requireTelemedicine.js";
import { getVideoAdapter } from "../services/telemedicine/videoProviderAdapter.js";
import { getProviderStatus } from "../services/telemedicine/telemedicineService.js";

const router = express.Router();
router.use(requireTelemedicineFeature);

/**
 * POST /provider/create-room
 *
 * Creates a provider room and reports whether that worked. It no longer returns
 * the room id: for the sandbox provider that id alone reconstructs the meeting
 * URL, and this endpoint is reachable by any authenticated user — it checks the
 * feature flag and nothing else, no practice membership and no permission.
 *
 * FINDING, recorded rather than acted on in this phase: the endpoint has no
 * caller anywhere in the client, and it can be invoked repeatedly to mint
 * rooms. Removing it, or gating it behind practice membership, is a decision
 * about the provider surface — see the Phase 2G.3 report.
 */
router.post("/provider/create-room", async (req, res) => {
  try {
    const adapter = getVideoAdapter(req.body?.providerType || "sandbox");
    const room = await adapter.createRoom({ externalUrl: req.body?.externalUrl });
    if (!room.ok) return res.status(400).json({ ok: false, error: room.error });
    return res.json({
      ok: true,
      hasJoinLink: true,
    });
  } catch {
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

router.get("/provider/status/:sessionId", async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
    const status = await getProviderStatus(req.params.sessionId, userId, false);
    return res.json({ ok: true, status });
  } catch (e) {
    return res.status(404).json({ ok: false, error: e?.message || "not_found" });
  }
});

export default router;
