import { isPracticeApiEnabled } from "../config/featureFlags.js";
import { findApiClientByToken, touchApiClientUsed } from "../services/practiceDeveloper/practiceApiClientService.js";
import { checkPracticeApiRateLimit } from "./practiceApiRateLimit.js";
import { prisma } from "../lib/prisma.js";
import crypto from "crypto";


function hashIp(ip) {
  return crypto.createHash("sha256").update(String(ip || "")).digest("hex").slice(0, 32);
}

export async function requirePracticeApiAuth(req, res, next) {
  if (!isPracticeApiEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }

  const auth = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  const token = m?.[1]?.trim();
  if (!token) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const client = await findApiClientByToken(token);
  if (!client) {
    await logApiAudit(null, req, "api_access_denied", 401);
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }

  const limit = checkPracticeApiRateLimit(client.id);
  if (limit.limited) {
    await logApiAudit(client, req, "api_rate_limited", 429);
    return res.status(429).json({ ok: false, error: "rate_limited" });
  }

  req.practiceApi = {
    clientId: client.id,
    practiceProfileId: client.practiceProfileId,
    scopes: Array.isArray(client.scopesJson) ? client.scopesJson : [],
  };

  touchApiClientUsed(client.id).catch(() => {});
  return next();
}

export function requireApiScope(scope) {
  return (req, res, next) => {
    const scopes = req.practiceApi?.scopes || [];
    if (!scopes.includes(scope)) {
      logApiAudit(
        { id: req.practiceApi?.clientId, practiceProfileId: req.practiceApi?.practiceProfileId },
        req,
        "api_scope_denied",
        403,
      ).catch(() => {});
      return res.status(403).json({ ok: false, error: "forbidden_scope" });
    }
    return next();
  };
}

async function logApiAudit(client, req, action, statusCode) {
  if (!client?.practiceProfileId) return;
  const ip =
    (typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
      : null) || req.ip;
  await prisma.practiceApiAuditEvent.create({
    data: {
      practiceProfileId: client.practiceProfileId,
      apiClientId: client.id || null,
      action,
      endpoint: req.path,
      statusCode,
      ipHash: hashIp(ip),
    },
  });
}

export { logApiAudit };
