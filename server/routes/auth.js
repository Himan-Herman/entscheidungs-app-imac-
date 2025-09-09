import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendVerificationEmail } from "../emailService.js";




export const authRouter = express.Router();
const prisma = new PrismaClient();

const INSURANCE_WHITELIST = new Set(["gesetzlich", "privat", "sonstiges"]);

function isMinor(dobStr) {
  const dob = new Date(dobStr);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age < 18;
}



authRouter.get("/health", (_req, res) => res.json({ ok: true, route: "auth" }));



authRouter.post("/register", async (req, res) => {
  try {
    const { user, profile = {}, consent = {}, doctors = [] } = req.body ?? {};

   
    if (!user?.email || !user?.password || !user?.first_name || !user?.last_name || !user?.date_of_birth) {
      return res.status(400).json({ error: "Pflichtfelder fehlen." });
    }

    const emailNorm = user.email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
      if (existing) {
       // Wenn noch nicht verifiziert: neuen Link schicken und ok zurückgeben
        if (!existing.emailVerified) {
          const tokenPlain = crypto.randomBytes(32).toString("hex");
          const tokenHash = crypto.createHash("sha256").update(tokenPlain).digest("hex");
          const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await prisma.user.update({
            where: { id: existing.id },
            data: { verificationTokenHash: tokenHash, verificationTokenExpires: expires },
          });
          const verifyLink = `${process.env.API_BASE_URL}/api/auth/verify?uid=${created.id}&token=${tokenPlain}`;
await sendVerificationEmail(user.email, verifyLink);

         return res.json({ ok: true, resent: true });
        }
    // bereits verifiziert → echter Konflikt
        return res.status(409).json({ ok: false, error: "EMAIL_EXISTS" });
      }
   
    const passwordHash = await bcrypt.hash(user.password, 10);

    
    const created = await prisma.user.create({
      data: {
        email: emailNorm,   // <— statt user.email
        passwordHash,
        firstName: user.first_name,
        lastName: user.last_name,
        dateOfBirth: new Date(user.date_of_birth),
        emailVerified: false,
        profile: {
          create: {
            phone: profile.phone ?? null,
            addressLine: profile.address_line ?? null,
            postalCode: profile.postal_code ?? null,
            city: profile.city ?? null,
            country: profile.country ?? null,
            insuranceType: INSURANCE_WHITELIST.has(profile.insurance_type)
              ? profile.insurance_type
              : null,
            gender: profile.gender ?? null,
          },
        },
        consent: {
          create: {
            termsAcceptedAt: consent.terms_accepted ? new Date() : null,
            privacyAcceptedAt: consent.privacy_accepted ? new Date() : null,
            medicalDisclaimerAcceptedAt: consent.medical_disclaimer_accepted ? new Date() : null,
            doctorAlertConsent: !!consent.doctor_alert_consent,
          },
        },
        doctors: {
          create: (Array.isArray(doctors) ? doctors : [])
            .slice(0, 5)
            .map((d) => ({
              name: d.name || null,
              specialty: d.specialty || null,
              clinicName: d.clinic_name || null,
              emailSecure: d.email_secure || null,
              phone: d.phone || null,
              address: d.address || null,
              allowAlerts: !!d.allow_alerts,
            })),
        },
      },
      select: { id: true },
    });

 
    const tokenPlain = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(tokenPlain).digest("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: created.id },
      data: {
        verificationTokenHash: tokenHash,
        verificationTokenExpires: expires,
      },
    });



    try {
      const verifyLink = `${process.env.API_BASE_URL}/api/auth/verify?uid=${created.id}&token=${tokenPlain}`;
      await sendVerificationEmail(user.email, verifyLink);
    } catch (err) {
      console.error("MAIL SEND FAILED:", err?.code, err?.response, err?.message);
      
      return res.status(202).json({
        ok: false,
        error: "MAIL_FAILED_CAN_RESEND",
        message: "Mailversand fehlgeschlagen. Bitte später erneut versuchen.",
      });
    }
    

return res.json({
  ok: true,
  user_id: created.id,
  email_verified: false,
});

} catch (e) {
  if (e.code === "P2002" && e.meta?.target?.includes("email")) {
    return res.status(409).json({ ok: false, error: "EMAIL_EXISTS" });
  }
  console.error("[/register]", e);
  res.status(500).json({ ok: false, error: "SERVER_ERROR" });
}
});


authRouter.get("/verify", async (req, res) => {
  const { uid, token } = req.query;
  if (!uid || !token) return res.status(400).send("Bad Request");

  const u = await prisma.user.findUnique({ where: { id: String(uid) } });
  if (!u || !u.verificationTokenHash || !u.verificationTokenExpires) {
    return res.status(400).send("Ungültiger Link.");
  }

  const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
  const valid = tokenHash === u.verificationTokenHash && u.verificationTokenExpires > new Date();

  if (!valid) return res.status(400).send("Token ungültig oder abgelaufen.");

  await prisma.user.update({
    where: { id: u.id },
    data: {
      emailVerified: true,
      verifiedAt: new Date(),
      verificationTokenHash: null,
      verificationTokenExpires: null,
    },
  });

  const appUrl = process.env.APP_BASE_URL || "http://localhost:5173";
  return res.redirect(`${appUrl}/verifiziert?ok=1`);
});

authRouter.post("/resend-verification", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "email_required" });

  const u = await prisma.user.findUnique({ where: { email } });
  if (!u || u.emailVerified) return res.json({ ok: true }); // nicht verraten

  const tokenPlain = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(tokenPlain).digest("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: u.id },
    data: { verificationTokenHash: tokenHash, verificationTokenExpires: expires },
  });

  const verifyLink = `${process.env.API_BASE_URL}/api/auth/verify?uid=${created.id}&token=${tokenPlain}`;
await sendVerificationEmail(user.email, verifyLink);


  res.json({ ok: true });
});
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  if (!u.emailVerified) {
    return res.status(403).json({
      error: "EMAIL_NOT_VERIFIED",
      needVerification: true,
    });
  }


  return res.json({ ok: true, userId: u.id });
});