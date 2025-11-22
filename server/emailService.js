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

  const apiBase = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const verifyLink = `${apiBase}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  const subject = "Bitte E-Mail-Adresse bestätigen";
  const text = `Hallo${userName ? " " + userName : ""},

bitte bestätige deine E-Mail-Adresse:
${verifyLink}

Wenn du diese Registrierung nicht angefordert hast, kannst du diese E-Mail ignorieren.`;

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif;line-height:1.5">
      <h2>Willkommen${userName ? ", " + userName : ""} 👋</h2>
      <p>Bitte bestätige deine E-Mail-Adresse:</p>
      <p>
        <a href="${verifyLink}" style="display:inline-block;padding:12px 18px;text-decoration:none;border-radius:8px;border:1px solid #ddd">
          E-Mail jetzt bestätigen
        </a>
      </p>
      <p>Oder nutze diesen Link:<br><a href="${verifyLink}">${verifyLink}</a></p>
      <hr />
      <small>Falls du das nicht warst, ignoriere diese Nachricht.</small>
    </div>
  `;

  return sendMail(to, subject, text, html);
}
