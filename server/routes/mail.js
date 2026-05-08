// routes/mail.js
import express from "express";
import { sendMail } from "../mailer.js";   // ← HIER geändert!
import { mailSendRouteLimiter } from "../middleware/ipRateLimit.js";
import { logServerError } from "../utils/safeApiError.js";

const router = express.Router();

router.post("/send", mailSendRouteLimiter, async (req, res) => {
  const { to, subject, text, html } = req.body || {};
  if (!to || !subject) {
    return res.status(400).json({ error: "Felder 'to' und 'subject' sind erforderlich." });
  }

  try {
    await sendMail({
      to,
      subject,
      html: html ?? `<p>${text ?? ""}</p>`
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    logServerError("mail/send", e);
    res.status(500).json({ ok: false, error: "Senden fehlgeschlagen." });
  }
});

export default router;
