/**
 * Patient wearable connections — /api/patient/wearables
 *
 * Provider-neutral Phase 0: connect / disconnect a health-data source and receive
 * device measurements into "Meine Messwerte". Manual entry is untouched. No OAuth
 * secrets or tokens are stored. Import plumbing only — no diagnosis, triage, or
 * interpretation. All endpoints are per-user (ownership enforced) and gated by
 * the ENABLE_WEARABLES feature flag (which itself requires ENABLE_VITALS).
 */

import express from "express";
import { prisma } from "../lib/prisma.js";
import { isWearablesEnabled } from "../config/featureFlags.js";
import { writeAuditLog } from "../services/auditLogService.js";
import {
  WEARABLE_PROVIDERS,
  getProvider,
  isKnownProvider,
  isConnectableProvider,
  sanitizeScopes,
} from "../services/wearables/providers.js";
import { importVitalEntries, MAX_IMPORT_BATCH } from "../services/wearables/importService.js";

const router = express.Router();

function userId(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function requireFeature(_req, res, next) {
  if (!isWearablesEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

function parseScopes(row) {
  if (!row?.scopes) return [];
  try {
    const arr = JSON.parse(row.scopes);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function connectionToJson(row) {
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    scopes: parseScopes(row),
    consentAt: row.consentAt,
    lastSyncedAt: row.lastSyncedAt,
    lastError: row.lastError,
    disconnectedAt: row.disconnectedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** GET /api/patient/wearables/providers — static catalog (no user data). */
router.get("/providers", requireFeature, (_req, res) => {
  return res.json({ ok: true, providers: WEARABLE_PROVIDERS });
});

/** GET /api/patient/wearables/connections — this patient's connections. */
router.get("/connections", requireFeature, async (req, res) => {
  const uid = userId(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const rows = await prisma.wearableConnection.findMany({
      where: { userId: uid },
      orderBy: { createdAt: "asc" },
    });
    return res.json({ ok: true, connections: rows.map(connectionToJson) });
  } catch (err) {
    console.error("[wearables] GET connections error", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/**
 * POST /api/patient/wearables/connect
 * body: { provider, scopes?: string[], consentAccepted: true }
 * Records an explicit-consent connection. Re-connecting an existing provider re-activates it.
 */
router.post("/connect", requireFeature, async (req, res) => {
  const uid = userId(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

  const { provider, scopes, consentAccepted } = req.body || {};
  if (!isKnownProvider(provider)) return res.status(400).json({ ok: false, error: "unknown_provider" });
  if (!isConnectableProvider(provider)) return res.status(400).json({ ok: false, error: "provider_not_available" });
  if (consentAccepted !== true) return res.status(400).json({ ok: false, error: "consent_required" });

  const cleanScopes = sanitizeScopes(provider, scopes);
  if (cleanScopes.length === 0) return res.status(400).json({ ok: false, error: "no_valid_scopes" });

  try {
    const now = new Date();
    const row = await prisma.wearableConnection.upsert({
      where: { userId_provider: { userId: uid, provider } },
      create: {
        userId: uid,
        provider,
        status: "connected",
        scopes: JSON.stringify(cleanScopes),
        consentAt: now,
      },
      update: {
        status: "connected",
        scopes: JSON.stringify(cleanScopes),
        consentAt: now,
        disconnectedAt: null,
        lastError: null,
      },
    });
    writeAuditLog({ userId: uid, action: "wearable_connect", metadata: { provider } });
    return res.status(201).json({ ok: true, connection: connectionToJson(row) });
  } catch (err) {
    console.error("[wearables] POST connect error", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/**
 * POST /api/patient/wearables/:id/disconnect
 * Soft-disconnect: stops future imports. Already-imported measurements are kept
 * (the patient can delete them individually). Consent is withdrawable at any time.
 */
router.post("/:id/disconnect", requireFeature, async (req, res) => {
  const uid = userId(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

  const existing = await prisma.wearableConnection
    .findFirst({ where: { id: req.params.id, userId: uid } })
    .catch(() => null);
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  try {
    const row = await prisma.wearableConnection.update({
      where: { id: existing.id },
      data: { status: "disconnected", disconnectedAt: new Date() },
    });
    writeAuditLog({ userId: uid, action: "wearable_disconnect", metadata: { provider: existing.provider } });
    return res.json({ ok: true, connection: connectionToJson(row) });
  } catch (err) {
    console.error("[wearables] POST disconnect error", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/**
 * POST /api/patient/wearables/import
 * body: { provider, entries: [{ type, valuePrimary, valueSecondary?, unit?, measuredAt, notes?, externalId }] }
 * The native companion app (Apple Health / Health Connect) calls this after reading on-device.
 * Requires an active, consented connection for that provider. Idempotent + bounds-checked.
 */
router.post("/import", requireFeature, async (req, res) => {
  const uid = userId(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

  const { provider, entries, finalizeSync } = req.body || {};
  if (!isKnownProvider(provider)) return res.status(400).json({ ok: false, error: "unknown_provider" });
  if (!Array.isArray(entries)) return res.status(400).json({ ok: false, error: "invalid_entries" });
  if (entries.length === 0) return res.json({ ok: true, imported: 0, duplicates: 0, skipped: [] });
  if (entries.length > MAX_IMPORT_BATCH) return res.status(413).json({ ok: false, error: "batch_too_large", max: MAX_IMPORT_BATCH });

  const connection = await prisma.wearableConnection
    .findFirst({ where: { userId: uid, provider, status: "connected" } })
    .catch(() => null);
  if (!connection) return res.status(409).json({ ok: false, error: "not_connected" });
  if (!connection.consentAt) return res.status(409).json({ ok: false, error: "consent_required" });

  const allowedTypes = parseScopes(connection);
  if (allowedTypes.length === 0) return res.status(409).json({ ok: false, error: "no_valid_scopes" });

  try {
    const result = await importVitalEntries({ userId: uid, provider, allowedTypes, entries });

    // A sync is uploaded in several chunks. Advancing lastSyncedAt after every chunk
    // would move the next sync's start date past readings a later, failed chunk still
    // carried — they would be skipped forever. The client therefore sets finalizeSync
    // only on the last chunk, and only when every earlier chunk succeeded.
    if (finalizeSync === true) {
      await prisma.wearableConnection
        .update({ where: { id: connection.id }, data: { lastSyncedAt: new Date(), lastError: null } })
        .catch(() => {});
    }
    if (result.imported > 0) {
      writeAuditLog({
        userId: uid,
        action: "wearable_import",
        metadata: { provider, imported: result.imported, duplicates: result.duplicates },
      });
    }
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[wearables] POST import error", err);
    await prisma.wearableConnection
      .update({ where: { id: connection.id }, data: { status: "error", lastError: "import_failed" } })
      .catch(() => {});
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
