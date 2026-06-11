/**
 * Google Wallet service — Phase 4A.
 *
 * Produces a real "Add to Google Wallet" link by signing a RS256 JWT with the configured
 * service account, but ONLY when all credentials are present and valid. Without them, the
 * safe `not_configured` state is preserved (no broken/unsigned link is ever emitted).
 *
 * Credentials (issuer id, service account JSON, class id) come from env at runtime and stay
 * strictly server-side. Nothing here is logged. Uses the already-present `jsonwebtoken` dep.
 *
 * PRIVACY DECISION (see report): the visible pass face carries NO medical data — not even blood
 * type. A Google Wallet Generic pass is visible to anyone who can see the device screen, and
 * Google policy restricts health data on passes. We therefore keep all medical hints OFF the
 * pass and rely on the QR → consent-gated emergency page. Blood type can be enabled later via
 * INCLUDE_BLOOD_TYPE_ON_PASS only after an explicit policy review (and ideally a private pass).
 */
import jwt from "jsonwebtoken";
import {
  googleWalletConfig,
  parseGoogleServiceAccount,
  getEmergencyBaseUrl,
} from "./walletConfig.js";

// Conservative default: do NOT render blood type (or any medical data) on the wallet face.
const INCLUDE_BLOOD_TYPE_ON_PASS = false;

export function isGoogleWalletConfigured() {
  return googleWalletConfig().configured;
}

/** Google object/class id suffix must match [A-Za-z0-9._-]. */
function normalizeIdPart(value) {
  return String(value || "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 60) || "anon";
}

/**
 * @param {object} walletPayload  Minimal payload from sosWalletMapper (no health data beyond
 *                                an optional blood type, which is intentionally not surfaced).
 * @returns {Promise<string>}  https://pay.google.com/gp/v/save/<signed-jwt>
 */
export async function buildGoogleSaveLink(walletPayload) {
  if (!isGoogleWalletConfigured()) {
    const err = new Error("google_wallet_not_configured");
    err.code = "not_configured";
    throw err;
  }

  const serviceAccount = parseGoogleServiceAccount();
  if (!serviceAccount) {
    const err = new Error("google_wallet_not_configured");
    err.code = "not_configured";
    throw err;
  }

  const issuerId = (process.env.GOOGLE_WALLET_ISSUER_ID || "").trim();
  const classId = (process.env.GOOGLE_WALLET_CLASS_ID || "").trim();
  const objectId = `${issuerId}.sos-${normalizeIdPart(walletPayload?.subjectId)}`;

  // Generic pass object — minimal, no medical data on the visible face.
  const genericObject = {
    id: objectId,
    classId,
    genericType: "GENERIC_TYPE_UNSPECIFIED",
    hexBackgroundColor: "#b91c1c",
    cardTitle: { defaultValue: { language: "en", value: "MedScoutX SOS" } },
    header: {
      defaultValue: { language: "en", value: walletPayload?.holder || "MedScoutX SOS" },
    },
    // The barcode carries ONLY the emergency URL — never health data.
    barcode: { type: "QR_CODE", value: walletPayload?.emergencyUrl || "" },
    textModulesData: [
      {
        id: "self_reported",
        header: "Notice",
        body: "Self-reported by the user. Not medically validated by MedScoutX.",
      },
    ],
  };

  if (INCLUDE_BLOOD_TYPE_ON_PASS && walletPayload?.bloodType) {
    genericObject.textModulesData.push({
      id: "blood_type",
      header: "Blood type",
      body: walletPayload.bloodType,
    });
  }

  const base = getEmergencyBaseUrl();
  const origins = base ? [base] : [];

  const claims = {
    iss: serviceAccount.client_email,
    aud: "google",
    typ: "savetowallet",
    origins,
    payload: { genericObjects: [genericObject] },
  };

  // RS256 signature with the service account private key (server-side only).
  const token = jwt.sign(claims, serviceAccount.private_key, { algorithm: "RS256" });
  return `https://pay.google.com/gp/v/save/${token}`;
}
