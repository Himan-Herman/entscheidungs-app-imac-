import crypto from "crypto";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export function newToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

async function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export async function sendVerifyMail(email, token) {
  const url = `${process.env.API_BASE_URL}/api/auth/verify?token=${token}&email=${encodeURIComponent(email)}`;
  const transporter = await getTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Bitte E-Mail verifizieren",
    html: `<p>Hallo,</p><p><a href="${url}">E-Mail jetzt bestätigen</a></p><p>Gültig 24 Stunden.</p>`,
  });
}

export async function issueVerification(userId, email) {
  const { token, hash } = newToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await prisma.user.update({
    where: { id: userId },
    data: { verificationTokenHash: hash, verificationTokenExpires: expires },
  });
  await sendVerifyMail(email, token);
}
