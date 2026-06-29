import { prisma } from "../../lib/prisma.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import {
  canManageIntegrations,
  hasPracticePermission,
  PERMISSIONS,
} from "../../utils/practicePermissions.js";
import {
  isFhirIntegrationEnabled,
  isHl7v2IntegrationEnabled,
  isIntegrationsEnabled,
  isPvsProductionEnabled,
  isPvsSandboxEnabled,
} from "../../config/featureFlags.js";
import { writeAuditLog } from "../auditLogService.js";
import {
  AUTH_TYPES,
  CONNECTION_STATUSES,
  CONNECTION_TYPES,
  DEFAULT_MAPPINGS,
  FHIR_VERSIONS,
} from "./integrationConstants.js";
import { getConnector, listConnectorDescriptors } from "./pvsConnectorRegistry.js";
import { assertIntegrationExportAllowed } from "./integrationConsentGuard.js";


function stripSecretsFromConfig(config) {
  if (!config || typeof config !== "object") return {};
  const out = { .../** @type {Record<string, unknown>} */ (config) };
  for (const key of Object.keys(out)) {
    if (/secret|token|password|apikey|api_key|credential/i.test(key)) delete out[key];
  }
  return out;
}

function connectionToJson(row, { canManage }) {
  return {
    id: row.id,
    practiceProfileId: row.practiceProfileId,
    type: row.type,
    connectorKey: row.connectorKey,
    vendorName: row.vendorName,
    status: row.status,
    baseUrl: row.baseUrl,
    authType: row.authType,
    configJson: stripSecretsFromConfig(row.configJson),
    fhirVersion: row.fhirVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    revokedAt: row.revokedAt,
    canManage,
  };
}

function flagsPayload() {
  return {
    integrationsEnabled: isIntegrationsEnabled(),
    fhirEnabled: isFhirIntegrationEnabled(),
    hl7v2Enabled: isHl7v2IntegrationEnabled(),
    sandboxEnabled: isPvsSandboxEnabled(),
    productionEnabled: isPvsProductionEnabled(),
  };
}

async function ensureDefaultMappings(practiceId) {
  const count = await prisma.integrationMapping.count({
    where: { practiceProfileId: practiceId },
  });
  if (count > 0) return;
  await prisma.integrationMapping.createMany({
    data: DEFAULT_MAPPINGS.map((m) => ({
      practiceProfileId: practiceId,
      sourceType: m.sourceType,
      targetType: m.targetType,
      mappingJson: m.mappingJson,
      version: m.version,
      active: true,
    })),
  });
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 */
export async function getIntegrationsOverview(actorUserId, practiceId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  const canManage = canManageIntegrations(access.role);
  if (!canManage) throw new Error("forbidden");

  await ensureDefaultMappings(practiceId);

  const [connections, mappings, recentJobs] = await Promise.all([
    prisma.integrationConnection.findMany({
      where: { practiceProfileId: practiceId, revokedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.integrationMapping.findMany({
      where: { practiceProfileId: practiceId },
      orderBy: { sourceType: "asc" },
    }),
    prisma.integrationJob.findMany({
      where: { practiceProfileId: practiceId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    practiceId,
    practiceName: access.practice.practiceName,
    canManage,
    flags: flagsPayload(),
    connectors: listConnectorDescriptors(),
    connections: connections.map((c) => connectionToJson(c, { canManage })),
    mappings: mappings.map((m) => ({
      id: m.id,
      sourceType: m.sourceType,
      targetType: m.targetType,
      mappingJson: m.mappingJson,
      version: m.version,
      active: m.active,
      connectionId: m.connectionId,
    })),
    recentJobs: recentJobs.map(jobToJson),
  };
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {Record<string, unknown>} body
 * @param {{ req?: import('express').Request }} ctx
 */
export async function createIntegrationConnection(actorUserId, practiceId, body, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageIntegrations(access.role)) throw new Error("forbidden");

  const type = String(body.type || "custom").trim();
  const connectorKey = String(body.connectorKey || "custom_placeholder").trim();
  if (!isIntegrationsEnabled() && !isPvsSandboxEnabled()) {
    throw new Error("integrations_disabled");
  }
  if (!isIntegrationsEnabled() && connectorKey !== "pvs_sandbox") {
    throw new Error("integrations_disabled");
  }
  if (!CONNECTION_TYPES.has(type)) throw new Error("invalid_type");

  let status = String(body.status || "disabled").trim();
  if (status === "active" && !isPvsProductionEnabled()) {
    status = "sandbox";
  }
  if (!CONNECTION_STATUSES.has(status)) status = "disabled";

  const authType = String(body.authType || "none").trim();
  if (!AUTH_TYPES.has(authType)) throw new Error("invalid_auth_type");

  const fhirVersion = String(body.fhirVersion || "R4").trim();
  if (fhirVersion && !FHIR_VERSIONS.has(fhirVersion)) throw new Error("invalid_fhir_version");

  const row = await prisma.integrationConnection.create({
    data: {
      practiceProfileId: practiceId,
      type,
      connectorKey,
      vendorName: body.vendorName ? String(body.vendorName).slice(0, 120) : null,
      status,
      baseUrl: body.baseUrl ? String(body.baseUrl).slice(0, 500) : null,
      authType,
      configJson: stripSecretsFromConfig(body.configJson),
      fhirVersion,
      createdByUserId: actorUserId,
    },
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "integration_connection_created",
    practiceProfileId: practiceId,
    metadata: { connectionId: row.id, type, connectorKey, status },
  }).catch(() => {});

  return connectionToJson(row, { canManage: true });
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {string} connectionId
 * @param {Record<string, unknown>} body
 * @param {{ req?: import('express').Request }} ctx
 */
export async function patchIntegrationConnection(
  actorUserId,
  practiceId,
  connectionId,
  body,
  ctx = {},
) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageIntegrations(access.role)) throw new Error("forbidden");
  if (!isIntegrationsEnabled()) throw new Error("integrations_disabled");

  const existing = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, practiceProfileId: practiceId, revokedAt: null },
  });
  if (!existing) throw new Error("connection_not_found");

  /** @type {Record<string, unknown>} */
  const data = {};
  if (body.vendorName !== undefined) data.vendorName = String(body.vendorName || "").slice(0, 120) || null;
  if (body.baseUrl !== undefined) data.baseUrl = String(body.baseUrl || "").slice(0, 500) || null;
  if (body.configJson !== undefined) data.configJson = stripSecretsFromConfig(body.configJson);
  if (body.fhirVersion !== undefined) {
    const v = String(body.fhirVersion || "R4");
    if (!FHIR_VERSIONS.has(v)) throw new Error("invalid_fhir_version");
    data.fhirVersion = v;
  }
  if (body.status !== undefined) {
    let status = String(body.status);
    if (status === "active" && !isPvsProductionEnabled()) status = "sandbox";
    if (!CONNECTION_STATUSES.has(status)) throw new Error("invalid_status");
    data.status = status;
  }

  const row = await prisma.integrationConnection.update({
    where: { id: connectionId },
    data,
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "integration_connection_updated",
    practiceProfileId: practiceId,
    metadata: { connectionId, fields: Object.keys(data) },
  }).catch(() => {});

  return connectionToJson(row, { canManage: true });
}

export async function disableIntegrationConnection(actorUserId, practiceId, connectionId, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageIntegrations(access.role)) throw new Error("forbidden");

  const row = await prisma.integrationConnection.updateMany({
    where: { id: connectionId, practiceProfileId: practiceId },
    data: { status: "disabled", revokedAt: new Date() },
  });
  if (!row.count) throw new Error("connection_not_found");

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "integration_connection_disabled",
    practiceProfileId: practiceId,
    metadata: { connectionId },
  }).catch(() => {});

  return { ok: true };
}

export async function testIntegrationConnection(actorUserId, practiceId, connectionId, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageIntegrations(access.role)) throw new Error("forbidden");

  const conn = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, practiceProfileId: practiceId, revokedAt: null },
  });
  if (!conn) throw new Error("connection_not_found");

  const connector = getConnector(conn.connectorKey);
  const result = await connector.testConnection({
    connection: conn,
    sandbox: conn.status === "sandbox" || !isPvsProductionEnabled(),
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "integration_connection_tested",
    practiceProfileId: practiceId,
    metadata: { connectionId, ok: Boolean(result?.ok) },
  }).catch(() => {});

  return { ok: Boolean(result?.ok), result, sandbox: !isPvsProductionEnabled() };
}

export function jobToJson(job) {
  return {
    id: job.id,
    connectionId: job.connectionId,
    practiceProfileId: job.practiceProfileId,
    type: job.type,
    direction: job.direction,
    status: job.status,
    resourceType: job.resourceType,
    practicePatientLinkId: job.practicePatientLinkId,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    failedAt: job.failedAt,
    errorCode: job.errorCode,
    createdAt: job.createdAt,
  };
}

export async function listIntegrationJobs(actorUserId, practiceId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageIntegrations(access.role) && !hasPracticePermission(access.role, PERMISSIONS.INTEGRATIONS_EXPORT)) {
    throw new Error("forbidden");
  }
  const jobs = await prisma.integrationJob.findMany({
    where: { practiceProfileId: practiceId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return jobs.map(jobToJson);
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {string} connectionId
 * @param {Record<string, unknown>} body
 * @param {{ req?: import('express').Request }} ctx
 */
export async function createIntegrationJob(actorUserId, practiceId, connectionId, body, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");

  const jobType = String(body.type || "test").trim();
  const direction = String(body.direction || "outbound").trim();
  const linkId = body.practicePatientLinkId
    ? String(body.practicePatientLinkId).trim()
    : null;

  if (jobType === "export" || jobType === "import") {
    await assertIntegrationExportAllowed({
      actorUserId,
      practiceId,
      practicePatientLinkId: linkId,
      role: access.role,
      req: ctx.req,
    });
  } else if (!canManageIntegrations(access.role)) {
    throw new Error("forbidden");
  }

  const conn = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, practiceProfileId: practiceId, revokedAt: null },
  });
  if (!conn) throw new Error("connection_not_found");

  if (conn.status === "active" && !isPvsProductionEnabled()) {
    throw new Error("production_sync_disabled");
  }
  if (jobType === "sync") {
    throw new Error("auto_sync_disabled");
  }

  const job = await prisma.integrationJob.create({
    data: {
      connectionId,
      practiceProfileId: practiceId,
      type: jobType,
      direction,
      status: "running",
      resourceType: body.resourceType ? String(body.resourceType).slice(0, 64) : null,
      practicePatientLinkId: linkId,
      startedAt: new Date(),
    },
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "integration_job_started",
    practiceProfileId: practiceId,
    metadata: { jobId: job.id, connectionId, type: jobType, direction },
  }).catch(() => {});

  let errorCode = null;
  let finalStatus = "completed";
  try {
    const connector = getConnector(conn.connectorKey);
    if (jobType === "export" || jobType === "test") {
      await connector.export({
        sandbox: true,
        fhirVersion: conn.fhirVersion || "R4",
        samplePatient: { linkId: linkId || "sandbox", displayName: "Sandbox Patient" },
      });
    }
  } catch (err) {
    finalStatus = "failed";
    errorCode = String(err?.message || "job_failed").slice(0, 64);
  }

  const completed = await prisma.integrationJob.update({
    where: { id: job.id },
    data: {
      status: finalStatus,
      completedAt: finalStatus === "completed" ? new Date() : undefined,
      failedAt: finalStatus === "failed" ? new Date() : undefined,
      errorCode,
    },
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: finalStatus === "completed" ? "integration_job_completed" : "integration_job_failed",
    practiceProfileId: practiceId,
    metadata: { jobId: job.id, status: finalStatus, errorCode },
  }).catch(() => {});

  return jobToJson(completed);
}

export async function getIntegrationJob(actorUserId, practiceId, jobId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageIntegrations(access.role) && !hasPracticePermission(access.role, PERMISSIONS.INTEGRATIONS_EXPORT)) {
    throw new Error("forbidden");
  }
  const job = await prisma.integrationJob.findFirst({
    where: { id: jobId, practiceProfileId: practiceId },
  });
  if (!job) throw new Error("job_not_found");
  return jobToJson(job);
}

export { assertIntegrationExportAllowed };
