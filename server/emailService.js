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

  // Frontend-Basis-URL (für den Button & Link in der Mail)
  const appBase = (process.env.APP_BASE_URL ?? "http://localhost:5173").replace(/\/+$/, "");
  const verifyLink = `${appBase}/verify-email?token=${encodeURIComponent(token)}`;

  const subject = "MedScoutX – bitte bestätige deine E-Mail-Adresse";

  const text = `Hallo${userName ? " " + userName : ""},

willkommen bei MedScoutX! Bitte bestätige deine E-Mail-Adresse, indem du auf folgenden Link klickst:

${verifyLink}

Wenn du dich nicht bei MedScoutX registriert hast, kannst du diese Nachricht ignorieren.`;

  const html = `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <title>MedScoutX – E-Mail-Adresse bestätigen</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f5f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,0.06);overflow:hidden;">
            <!-- Header / Brand -->
            <tr>
              <td style="padding:20px 28px 12px 28px;border-bottom:1px solid #f0f0f0;background:linear-gradient(135deg,#0f766e,#14b8a6);color:#ffffff;">
                <div style="font-size:18px;font-weight:600;letter-spacing:0.03em;">MedScoutX</div>
                <div style="font-size:12px;opacity:0.9;margin-top:4px;">KI-gestützte medizinische Entscheidungsunterstützung</div>
              </td>
            </tr>

            <!-- Inhalt -->
            <tr>
              <td style="padding:24px 28px 8px 28px;color:#111827;font-size:15px;line-height:1.6;">
                <p style="margin:0 0 8px 0;">Hallo${userName ? " " + userName : ""} 👋</p>
                <p style="margin:0 0 16px 0;">
                  willkommen bei <strong>MedScoutX</strong>. Damit wir dein Konto aktivieren können,
                  bestätige bitte kurz deine E-Mail-Adresse.
                </p>
              </td>
            </tr>

            <!-- Button -->
            <tr>
              <td style="padding:0 28px 16px 28px;" align="center">
                <a href="${verifyLink}"
                   style="
                     display:inline-block;
                     padding:12px 24px;
                     margin:8px 0 4px 0;
                     background-color:#0f766e;
                     color:#ffffff;
                     text-decoration:none;
                     border-radius:999px;
                     font-size:15px;
                     font-weight:600;
                   ">
                  E-Mail jetzt bestätigen
                </a>
              </td>
            </tr>

            <!-- Fallback-Link -->
            <tr>
              <td style="padding:0 28px 24px 28px;color:#4b5563;font-size:13px;line-height:1.6;">
                <p style="margin:16px 0 8px 0;">
                  Falls der Button nicht funktioniert, kopiere bitte diesen Link in die
                  Adresszeile deines Browsers:
                </p>
                <p style="margin:0;word-break:break-all;">
                  <a href="${verifyLink}" style="color:#0f766e;text-decoration:none;">
                    ${verifyLink}
                  </a>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:16px 28px 20px 28px;border-top:1px solid #f0f0f0;color:#9ca3af;font-size:11px;line-height:1.5;">
                <p style="margin:0 0 4px 0;">
                  Du hast dich nicht bei MedScoutX registriert?
                  Dann kannst du diese E-Mail einfach ignorieren.
                </p>
                <p style="margin:0;">
                  © ${new Date().getFullYear()} MedScoutX – keine medizinische Notfallversorgung.
                  Im Notfall wähle bitte den Notruf (112).
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return sendMail(to, subject, text, html);
}

