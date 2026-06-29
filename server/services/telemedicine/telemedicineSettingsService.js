import { prisma } from "../../lib/prisma.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import {
  canManageTelemedicineSettings,
  canReadTelemedicine,
} from "../../utils/practicePermissions.js";
import { writeAuditLog } from "../auditLogService.js";
import { listProviderTypes } from "./videoProviderAdapter.js";


export async function getTelemedicineSettings(actorUserId, practiceId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canReadTelemedicine(access.role)) throw new Error("forbidden");

  let row = await prisma.practiceTelemedicineSettings.findUnique({
    where: { practiceProfileId: practiceId },
  });
  if (!row) {
    row = await prisma.practiceTelemedicineSettings.create({
      data: { practiceProfileId: practiceId },
    });
  }

  return {
    videoEnabled: row.videoEnabled,
    providerType: row.providerType,
    consentVersion: row.consentVersion,
    sandboxMode: row.sandboxMode,
    externalLinkMode: row.externalLinkMode,
    availableProviders: listProviderTypes(),
    canManage: canManageTelemedicineSettings(access.role),
  };
}

export async function patchTelemedicineSettings(actorUserId, practiceId, body, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageTelemedicineSettings(access.role)) throw new Error("forbidden");

  const data = {};
  if (body.videoEnabled !== undefined) data.videoEnabled = Boolean(body.videoEnabled);
  if (body.providerType !== undefined) data.providerType = String(body.providerType).slice(0, 32);
  if (body.consentVersion !== undefined) data.consentVersion = String(body.consentVersion).slice(0, 16);
  if (body.sandboxMode !== undefined) data.sandboxMode = Boolean(body.sandboxMode);
  if (body.externalLinkMode !== undefined) data.externalLinkMode = Boolean(body.externalLinkMode);

  const row = await prisma.practiceTelemedicineSettings.upsert({
    where: { practiceProfileId: practiceId },
    create: { practiceProfileId: practiceId, ...data },
    update: data,
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "telemedicine_settings_updated",
    practiceProfileId: practiceId,
    metadata: { fields: Object.keys(data) },
  }).catch(() => {});

  return {
    videoEnabled: row.videoEnabled,
    providerType: row.providerType,
    consentVersion: row.consentVersion,
    sandboxMode: row.sandboxMode,
    externalLinkMode: row.externalLinkMode,
  };
}
