// routes/mail.js
import express from "express";
import { sendMail } from "../emailService.js";

const router = express.Router();

router.post("/send", async (req, res) => {
  const { to, subject, text, html } = req.body || {};
  if (!to || !subject) return res.status(400).json({ error: "Felder 'to' und 'subject' sind erforderlich." });
  try {
    await sendMail(to, subject, text, html);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Mail-Fehler:", e?.response?.body ?? e);
    res.status(500).json({ ok: false, error: "Senden fehlgeschlagen." });
  }
});

export default router;
