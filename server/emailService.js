// emailService.js
import dotenv from "dotenv";
dotenv.config();

import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM; // z.B. "MedScoutX <noreply@medscoutx.app>"

if (!resendApiKey) console.error("FEHLER: RESEND_API_KEY fehlt in .env");
if (!from) console.error("FEHLER: EMAIL_FROM fehlt in .env");

const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Generische Mail senden (Resend)
 */
export async function sendMail(to, subject, text, html) {
  if (!resend) {
    throw new Error("Resend ist nicht initialisiert (RESEND_API_KEY fehlt).");
  }

  const message = {
    from,
    to,
    subject,
    text: text ?? "",
    html: html ?? `<p>${text ?? ""}</p>`,
  };

  try {
    const res = await resend.emails.send(message);
    console.log(
      `📧 Mail an ${Array.isArray(to) ? to.join(", ") : to} gesendet.`,
      "Resend-ID:",
      res?.data?.id ?? "keine ID"
    );
    return true;
  } catch (err) {
    console.error("Resend Fehler:", err?.response?.data ?? err);
    throw err;
  }
}

/**
 * Verifizierungs-Mail senden
 */
export async function sendVerificationEmail({ to, token, userName }) {
  if (!token) throw new Error("sendVerificationEmail: missing token");

  const appBase = (process.env.APP_BASE_URL ?? "http://localhost:5173").replace(/\/+$/, "");
  const verifyLink = `${appBase}/verify-email?token=${encodeURIComponent(token)}`;

  const subject = "MedScoutX – Bitte E-Mail-Adresse bestätigen";

  const text = `Hallo${userName ? " " + userName : ""},

vielen Dank für deine Registrierung bei MedScoutX!

Bitte bestätige deine E-Mail-Adresse über folgenden Link:
${verifyLink}

Falls du dich nicht registriert hast, kannst du diese E-Mail einfach ignorieren.`;

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif;line-height:1.5">
      <h2>Willkommen bei MedScoutX${userName ? ", " + userName : ""} 👋</h2>
      <p>Bitte bestätige deine E-Mail-Adresse, um deinen Account zu aktivieren:</p>

      <p>
        <a href="${verifyLink}" 
           style="display:inline-block;
                  padding:12px 18px;
                  text-decoration:none;
                  border-radius:8px;
                  background:#0057ff;
                  color:white;
                  font-weight:600;">
          E-Mail jetzt bestätigen
        </a>
      </p>

      <p>Direkter Link (falls der Button nicht funktioniert):<br>
      <a href="${verifyLink}">${verifyLink}</a></p>

      <hr />
      <small>Diese Nachricht wurde automatisch von MedScoutX versendet. Falls du dich nicht registriert hast, kannst du sie ignorieren.</small>
    </div>
  `;

  return sendMail(to, subject, text, html);
}
