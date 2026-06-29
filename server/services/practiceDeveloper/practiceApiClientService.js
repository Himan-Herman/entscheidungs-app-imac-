import { prisma } from "../../lib/prisma.js";
import { API_SCOPES } from "../../constants/practiceDeveloperApi.js";
import {
  generateAccessToken,
  hashAccessToken,
} from "../../utils/telemedicineTokens.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { canManageIntegrations } from "../../utils/practicePermissions.js";


function normalizeScopes(scopes) {
  const list = Array.isArray(scopes) ? scopes : [];
  return list.filter((s) => API_SCOPES.includes(s));
}

export async function listApiClients(actorUserId, practiceId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManageIntegrations(access.role)) throw new Error("forbidden");

  const rows = await prisma.practiceApiClient.findMany({
    where: { practiceProfileId: practiceId },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    scopes: r.scopesJson,
    lastUsedAt: r.lastUsedAt,
    createdAt: r.createdAt,
    revokedAt: r.revokedAt,
  }));
}

export async function createApiClient(actorUserId, practiceId, body) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManageIntegrations(access.role)) throw new Error("forbidden");

  const name = String(body.name || "").trim().slice(0, 120);
  if (!name) throw new Error("validation_required");

  const scopes = normalizeScopes(body.scopes);
  if (!scopes.length) throw new Error("validation_required");

  const plainToken = `msx_${generateAccessToken()}`;
  const tokenHash = hashAccessToken(plainToken);

  const row = await prisma.practiceApiClient.create({
    data: {
      practiceProfileId: practiceId,
      name,
      status: "active",
      tokenHash,
      scopesJson: scopes,
      createdByUserId: actorUserId,
    },
  });

  return {
    client: {
      id: row.id,
      name: row.name,
      status: row.status,
      scopes: row.scopesJson,
      createdAt: row.createdAt,
    },
    token: plainToken,
    tokenShownOnce: true,
  };
}

export async function revokeApiClient(actorUserId, practiceId, clientId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManageIntegrations(access.role)) throw new Error("forbidden");

  const row = await prisma.practiceApiClient.update({
    where: { id: clientId, practiceProfileId: practiceId },
    data: { status: "revoked", revokedAt: new Date() },
  });

  return { id: row.id, status: row.status };
}

export async function findApiClientByToken(plainToken) {
  const tokenHash = hashAccessToken(plainToken);
  return prisma.practiceApiClient.findFirst({
    where: { tokenHash, status: "active" },
  });
}

export async function touchApiClientUsed(clientId) {
  await prisma.practiceApiClient.update({
    where: { id: clientId },
    data: { lastUsedAt: new Date() },
  });
}
