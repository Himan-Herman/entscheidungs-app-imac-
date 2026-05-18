import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../auditLogService.js";
import {
  isIntegrationsEnabled,
  isPvsProductionEnabled,
} from "../../config/featureFlags.js";
import { canExportViaIntegrations } from "../../utils/practicePermissions.js";

const prisma = new PrismaClient();

/**
 * Ensures export/integration job is allowed — active link + data_export consent.
 * @param {{
 *   actorUserId: string,
 *   practiceId: string,
 *   practicePatientLinkId?: string | null,
 *   role: string,
 *   req?: import('express').Request,
 * }} ctx
 */
export async function assertIntegrationExportAllowed(ctx) {
  if (!isIntegrationsEnabled()) {
    throw new Error("integrations_disabled");
  }
  if (!canExportViaIntegrations(ctx.role)) {
    throw new Error("forbidden");
  }

  const linkId = ctx.practicePatientLinkId
    ? String(ctx.practicePatientLinkId).trim()
    : null;

  if (!linkId) {
    if (!isPvsProductionEnabled()) return { ok: true, sandboxMetadataOnly: true };
    throw new Error("practicePatientLinkId_required");
  }

  const link = await prisma.practicePatientLink.findFirst({
    where: {
      id: linkId,
      practiceProfileId: ctx.practiceId,
      status: "active",
    },
    select: { id: true, patientUserId: true, consentScopes: true },
  });
  if (!link) throw new Error("link_not_found");

  const consent = await prisma.consentRecord.findFirst({
    where: {
      practicePatientLinkId: linkId,
      consentType: "data_export",
      status: "granted",
    },
    orderBy: { grantedAt: "desc" },
    select: { id: true },
  });

  const legacyScopes =
    link.consentScopes && typeof link.consentScopes === "object"
      ? /** @type {Record<string, boolean>} */ (link.consentScopes)
      : {};
  const legacyExport = legacyScopes.data_export === true;

  if (!consent && !legacyExport) {
    writeAuditLog({
      req: ctx.req,
      userId: ctx.actorUserId,
      actorRole: ctx.role,
      action: "integration_export_blocked_consent",
      practiceProfileId: ctx.practiceId,
      metadata: {
        practicePatientLinkId: linkId,
        reason: "missing_data_export_consent",
      },
    }).catch(() => {});
    throw new Error("integration_consent_missing");
  }

  return { ok: true, practicePatientLinkId: linkId, patientUserId: link.patientUserId };
}
