/**
 * SOS Wallet endpoints — Phase 3 preparation.
 *
 *   GET  /api/sos/wallet/status        — which wallet integrations are configured
 *   POST /api/sos/wallet/apple-pass    — (prepared) returns .pkpass once configured + implemented
 *   POST /api/sos/wallet/google-link   — (prepared) returns Add-to-Google-Wallet URL once ready
 *
 * Auth required (patient). Gated behind the SOS feature flag. Rate-limited at mount.
 * The wallet pass is only an access carrier: the QR encodes ONLY the emergency URL — never
 * health data. Detailed emergency data stays server-side, reachable only via the public page.
 */
import express from "express";
import { PrismaClient } from "@prisma/client";
import { isSosCardEnabled } from "../config/featureFlags.js";
import { buildEmergencyUrl } from "../services/sosCard/wallet/walletConfig.js";
import { mapSosCardToWalletPayload } from "../services/sosCard/wallet/sosWalletMapper.js";
import {
  isAppleWalletConfigured,
  buildApplePass,
} from "../services/sosCard/wallet/appleWalletService.js";
import {
  isGoogleWalletConfigured,
  buildGoogleSaveLink,
} from "../services/sosCard/wallet/googleWalletService.js";

const router = express.Router();
const prisma = new PrismaClient();

function uid(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function requireFeature(_req, res, next) {
  if (!isSosCardEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

router.use(requireFeature);

/** GET /api/sos/wallet/status */
router.get("/status", (_req, res) => {
  const appleWalletAvailable = isAppleWalletConfigured();
  const googleWalletAvailable = isGoogleWalletConfigured();
  // Generic reason only — no env var names or secrets leaked to the client.
  const reason = appleWalletAvailable || googleWalletAvailable ? undefined : "not_configured";
  return res.json({ ok: true, appleWalletAvailable, googleWalletAvailable, reason });
});

/**
 * Load the patient's card + name and build the minimal wallet payload.
 * Returns { error } string when the card or a public token is missing.
 */
async function buildPayload(userId) {
  const [card, user] = await Promise.all([
    prisma.sosCard.findUnique({ where: { patientUserId: userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } }),
  ]);
  if (!card || card.deletedAt) return { error: "no_card" };
  if (!card.publicToken) return { error: "no_public_token" };

  const emergencyUrl = buildEmergencyUrl(card.publicToken);
  const payload = mapSosCardToWalletPayload({
    card,
    firstName: user?.firstName,
    lastName: user?.lastName,
    emergencyUrl,
  });
  return { payload };
}

/** POST /api/sos/wallet/apple-pass */
router.post("/apple-pass", async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  if (!isAppleWalletConfigured()) {
    return res.status(501).json({ ok: false, error: "apple_wallet_not_configured" });
  }

  try {
    const { error, payload } = await buildPayload(userId);
    if (error) return res.status(409).json({ ok: false, error });

    const pkpass = await buildApplePass(payload);
    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", 'attachment; filename="medscoutx-sos.pkpass"');
    return res.send(pkpass);
  } catch (err) {
    if (err?.code === "not_configured") {
      return res.status(501).json({ ok: false, error: "apple_wallet_not_configured" });
    }
    if (err?.code === "not_implemented") {
      return res.status(501).json({ ok: false, error: "not_implemented" });
    }
    console.error("[sos-wallet] apple-pass error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** POST /api/sos/wallet/google-link */
router.post("/google-link", async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  if (!isGoogleWalletConfigured()) {
    return res.status(501).json({ ok: false, error: "google_wallet_not_configured" });
  }

  try {
    const { error, payload } = await buildPayload(userId);
    if (error) return res.status(409).json({ ok: false, error });

    const saveUrl = await buildGoogleSaveLink(payload);
    return res.json({ ok: true, saveUrl });
  } catch (err) {
    if (err?.code === "not_configured") {
      return res.status(501).json({ ok: false, error: "google_wallet_not_configured" });
    }
    if (err?.code === "not_implemented") {
      return res.status(501).json({ ok: false, error: "not_implemented" });
    }
    console.error("[sos-wallet] google-link error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
