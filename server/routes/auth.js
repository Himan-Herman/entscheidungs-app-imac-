import express from "express";
import crypto from "crypto";

const router = express.Router();

router.get("/health", (_req, res) => res.json({ ok: true, route: "auth" }));

router.post("/register", (req, res) => {
  const { user } = req.body ?? {};
  if (!user?.email || !user?.password || !user?.first_name || !user?.last_name || !user?.date_of_birth) {
    return res.status(400).json({ error: "Pflichtfelder fehlen." });
  }
  const user_id = crypto.randomUUID();
  return res.json({ ok: true, user_id, email_verified: false });
});

export { router as authRouter }; // <— BENANNTER Export
