// server/emailService.js
import nodemailer from "nodemailer";

export async function sendVerificationEmail(to, verifyUrl) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "Bitte E-Mail verifizieren",
    text: `Hallo,\nE-Mail jetzt bestätigen: ${verifyUrl}\nGültig 24 Stunden.`,
    html: `<p>Hallo,</p><p><a href="${verifyUrl}">E-Mail jetzt bestätigen</a></p><p>Gültig 24 Stunden.</p>`,
  });
}
