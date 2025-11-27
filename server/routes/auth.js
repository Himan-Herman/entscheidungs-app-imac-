// routes/auth.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendVerificationEmail } from "../emailService.js";
import jwt from "jsonwebtoken";


const prisma = new PrismaClient();
const authRouter = express.Router();

const INSURANCE_WHITELIST = new Set(["gesetzlich", "privat", "sonstiges"]);

authRouter.get("/health", (_req, res) => res.json({ ok: true, route: "auth" }));

// POST /api/auth/register
authRouter.post("/register", async (req, res) => {
  try {
    const { user, profile = {}, consent = {}, doctors = [] } = req.body ?? {};

    if (
      !user?.email ||
      !user?.password ||
      !user?.first_name ||
      !user?.last_name ||
      !user?.date_of_birth
    ) {
      return res.status(400).json({ error: "Pflichtfelder fehlen." });
    }

    const emailNorm = user.email.trim().toLowerCase();

    // existiert?
    const existing = await prisma.user.findUnique({
      where: { email: emailNorm },
    });

    if (existing) {
      if (!existing.verified) {
        // neuen Token generieren
        const tokenPlain = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await prisma.user.update({
          where: { id: existing.id },
          data: {
            verifyToken: tokenPlain,
            verifyTokenExpires: expires,
          },
        });

        const apiBase = (
          process.env.API_BASE_URL ?? "http://localhost:3000"
        ).replace(/\/+$/, "");
        const verifyLink = `${apiBase}/api/auth/verify-email?token=${encodeURIComponent(
          tokenPlain
        )}`;

        // WICHTIG: token mitgeben
        await sendVerificationEmail({
          to: emailNorm,
          token: tokenPlain,
          link: verifyLink,
          userName: existing.firstName ?? undefined,
        });

        return res.json({ ok: true, resent: true });
      }
      return res.status(409).json({ ok: false, error: "EMAIL_EXISTS" });
    }

    // neuer User
    const passwordHash = await bcrypt.hash(user.password, 10);

    const created = await prisma.user.create({
      data: {
        email: emailNorm,
        passwordHash,
        firstName: user.first_name,
        lastName: user.last_name,
        dateOfBirth: new Date(user.date_of_birth),
        verified: false,
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
            medicalDisclaimerAcceptedAt: consent.medical_disclaimer_accepted
              ? new Date()
              : null,
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
      select: { id: true, firstName: true, email: true },
    });

    // Verifikations-Token setzen (Plain in verifyToken)
    const tokenPlain = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: created.id },
      data: {
        verifyToken: tokenPlain,
        verifyTokenExpires: expires,
      },
    });

    const apiBase = (
      process.env.API_BASE_URL ?? "http://localhost:3000"
    ).replace(/\/+$/, "");
    const verifyLink = `${apiBase}/api/auth/verify-email?token=${encodeURIComponent(
      tokenPlain
    )}`;

    try {
      if (process.env.EMAIL_ENABLED !== "false") {
        // WICHTIG: token mitgeben
        await sendVerificationEmail({
          to: created.email,
          token: tokenPlain,
          link: verifyLink,
          userName: created.firstName,
        });
      }
    } catch (err) {
      console.error(
        "MAIL SEND FAILED:",
        err?.code,
        err?.response?.body ?? err?.message ?? err
      );
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
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// GET /api/auth/verify-email?token=...
authRouter.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send("TOKEN_MISSING");

    // user mit gültigem Token finden
    const user = await prisma.user.findFirst({
      where: {
        verifyToken: String(token),
        verifyTokenExpires: { gt: new Date() },
      },
      select: { id: true },
    });

    const appBase = (
      process.env.APP_BASE_URL || "https://medscout.app"
    ).replace(/\/+$/, "");

    if (!user) {
      return res.redirect(`${appBase}/verified`);
    }

    // verifizieren + Token leeren
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verified: true,
        verifyToken: null,
        verifyTokenExpires: null,
      },
    });

    return res.redirect(`${appBase}/intro`);
  } catch (err) {
    console.error("[verify-email]", err);
    const appBase = (
      process.env.APP_BASE_URL || "https://medscout.app"
    ).replace(/\/+$/, "");
    return res.redirect(`${appBase}/verify-email?status=error`);
  }
});

// POST /api/auth/resend-verification
authRouter.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "email_required" });

    const emailNorm = email.trim().toLowerCase();
    const u = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (!u || u.verified) return res.json({ ok: true }); // keine Infos leaken

    const tokenPlain = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: u.id },
      data: { verifyToken: tokenPlain, verifyTokenExpires: expires },
    });

    const apiBase = (
      process.env.API_BASE_URL ?? "http://localhost:3000"
    ).replace(/\/+$/, "");
    const verifyLink = `${apiBase}/api/auth/verify-email?token=${encodeURIComponent(
      tokenPlain
    )}`;

    // WICHTIG: token mitgeben
    await sendVerificationEmail({
      to: emailNorm,
      token: tokenPlain,
      link: verifyLink,
      userName: u.firstName ?? undefined,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[resend-verification]", err?.response?.body ?? err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// POST /api/auth/login
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const emailNorm = email?.trim().toLowerCase();

  const u = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (!u) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  if (!u.verified) {
    return res
      .status(403)
      .json({ error: "EMAIL_NOT_VERIFIED", needVerification: true });
  }

  // 🔐 NEU: JWT erzeugen
  const token = jwt.sign(
    { userId: u.id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  // Nutzer-ID + Token zurückgeben
  return res.json({ ok: true, userId: u.id, token });
});

export default authRouter;
