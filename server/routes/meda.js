/**
 * Meda — lightweight medical literacy chat (patient area).
 * POST /api/meda/chat, GET /api/meda/status
 */

import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { createIpRateLimiter } from "../middleware/ipRateLimit.js";
import { getMedaStatus, runMedaChat } from "../services/meda/medaChatService.js";
import { AI_MODULES } from "../config/aiSafetyPolicy.js";

const router = express.Router();

const medaIpLimiter = createIpRateLimiter({
  max: 30,
  keyPrefix: "meda:ip",
  windowMs: 15 * 60 * 1000,
});

function resolveUserId(req) {
  return typeof req.user?.userId === "string" ? req.user.userId : null;
}

router.get("/status", requireAuth, (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  return res.json(getMedaStatus(userId));
});

router.post("/chat", requireAuth, medaIpLimiter, async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const locale = req.body?.patientLanguage === "en" ? "en" : "de";
  const message = req.body?.message;
  const history = Array.isArray(req.body?.history) ? req.body.history : [];

  try {
    const result = await runMedaChat(userId, { message, history, locale });

    if (!result.ok) {
      const status =
        result.code === "rate_limit_exceeded"
          ? 429
          : result.code === "meda_unavailable"
            ? 503
            : 400;
      return res.status(status).json({
        ok: false,
        error: result.code,
        quota: result.quota || getMedaStatus(userId).quota,
      });
    }

    return res.json({
      ok: true,
      reply: result.reply,
      quota: result.quota,
      refused: result.refused === true,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "meda_chat_error",
        module: AI_MODULES.MEDA,
        message: err?.message || "unknown",
      }),
    );
    return res.status(500).json({ ok: false, error: "meda_failed" });
  }
});

export default router;
