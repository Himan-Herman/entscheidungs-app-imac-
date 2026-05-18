import express from "express";
import { requireTelemedicineFeature } from "../middleware/requireTelemedicine.js";
import { getVideoAdapter } from "../services/telemedicine/videoProviderAdapter.js";
import { getProviderStatus } from "../services/telemedicine/telemedicineService.js";

const router = express.Router();
router.use(requireTelemedicineFeature);

router.post("/provider/create-room", async (req, res) => {
  try {
    const adapter = getVideoAdapter(req.body?.providerType || "sandbox");
    const room = await adapter.createRoom({ externalUrl: req.body?.externalUrl });
    if (!room.ok) return res.status(400).json({ ok: false, error: room.error });
    return res.json({
      ok: true,
      providerRoomId: room.providerRoomId,
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
