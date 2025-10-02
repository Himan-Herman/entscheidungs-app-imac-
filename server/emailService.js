// emailService.js
import dotenv from "dotenv";
dotenv.config();

import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;
const from = process.env.SENDGRID_FROM;

if (!apiKey) console.error("FEHLER: SENDGRID_API_KEY fehlt in .env");
if (!from) console.error("FEHLER: SENDGRID_FROM fehlt in .env");

if (apiKey) sgMail.setApiKey(apiKey);

/**
 * Generische Mail senden
 */
export async function sendMail(to, subject, text, html) {
  const msg = {
    to,
    from, // MUSS bei SendGrid verifiziert sein (Single Sender oder Domain)
    subject,
    text: text ?? "",
    html: html ?? `<p>${text ?? ""}</p>`,
  };

  try {
    const [res] = await sgMail.send(msg);
    console.log(`📧 Mail an ${Array.isArray(to) ? to.join(", ") : to} gesendet. Status:`, res.statusCode);
    return true;
  } catch (err) {
    console.error("SendGrid Fehler:", err?.response?.body ?? err);
    throw err;
  }
}

/**
 * Verifizierungs-Mail senden
 * Übergib am besten direkt den komplette Link (link).
 * Alternativ kann (uid, token) übergeben werden.
 */
export async function sendVerificationEmail({ to, link, token, uid, userName }) {
  let verifyLink = link;
  if (!verifyLink && token && uid) {
    const apiBase = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(/\/+$/,"");
    verifyLink = `${apiBase}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  }

  if (!verifyLink) {
    throw new Error("sendVerificationEmail: missing link (or token+uid)");
  }

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
