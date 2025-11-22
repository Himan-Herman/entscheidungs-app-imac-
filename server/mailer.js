// mailer.js
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resendApiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM; // z.B. "MedScoutX <noreply@medscoutx.app>"

if (!resendApiKey) console.error("FEHLER: RESEND_API_KEY fehlt!");
if (!from) console.error("FEHLER: EMAIL_FROM fehlt!");

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendMail({ to, subject, html }) {
  if (!resend) {
    throw new Error("Resend ist nicht initialisiert (RESEND_API_KEY fehlt).");
  }

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    console.log("📧 Resend-Mail gesendet → ID:", result?.data?.id ?? "keine ID");
    return true;
  } catch (err) {
    console.error("❌ Resend-Fehler:", err?.response?.data ?? err);
    throw err;
  }
}
