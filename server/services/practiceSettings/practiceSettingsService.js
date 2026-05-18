import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../auditLogService.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { hasPracticePermission, PERMISSIONS } from "../../utils/practicePermissions.js";
import {
  containsForbiddenMarketingClaims,
  isAccentColorAccessible,
  normalizeAccentColor,
  practiceBrandingJson,
  practiceLogoUrl,
} from "../../utils/practiceBranding.js";
import { practiceLogoStorage } from "./practiceLogoStorage.js";
import {
  normalizeInsuranceTriState,
  normalizeOrganizationType,
  organizationProfileExtras,
  parseAccessibility,
  parseJsonStringArray,
  stringifyJsonArray,
} from "../../utils/practiceOrganizationJson.js";

const prisma = new PrismaClient();

const ALLOWED_LANGS = new Set([
  "de",
  "en",
  "fr",
  "es",
  "it",
  "pt",
  "tr",
  "ar",
  "fa",
  "pl",
  "nl",
]);

function normalizeOpt(v, max = 300) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

function isValidEmail(v) {
  if (!v || typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function parseSupportedLanguages(raw) {
  if (raw === undefined || raw === null) return undefined;
  if (Array.isArray(raw)) {
    const codes = raw
      .map((x) => String(x).trim().toLowerCase())
      .filter((c) => ALLOWED_LANGS.has(c));
    return codes.length ? codes.join(",") : null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  const codes = s
    .split(/[,;\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter((c) => ALLOWED_LANGS.has(c));
  if (!codes.length) throw new Error("supportedLanguages_invalid");
  return [...new Set(codes)].join(",");
}

/**
 * @param {import('@prisma/client').PracticeProfile} row
 * @param {{ role: string, canManage: boolean }} access
 */
export function settingsToJson(row, access) {
  const langs = row.supportedLanguages
    ? row.supportedLanguages.split(",").map((x) => x.trim()).filter(Boolean)
    : row.preferredDoctorLanguage
      ? [row.preferredDoctorLanguage]
      : ["de"];

  return {
    id: row.id,
    practiceName: row.practiceName,
    publicSlug: row.publicSlug,
    specialty: row.specialty,
    description: row.description,
    website: row.website,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    postalCode: row.postalCode,
    country: row.country,
    preferredDoctorLanguage: row.preferredDoctorLanguage,
    supportedLanguages: langs,
    openingHours: row.openingHours,
    patientIntroText: row.patientIntroText,
    displayNameForPatients: row.displayNameForPatients,
    accentColor: normalizeAccentColor(row.accentColor),
    logoUrl: practiceLogoUrl(row),
    hasUploadedLogo: Boolean(row.logoStorageKey),
    isActive: row.isActive,
    role: access.role,
    canManage: access.canManage,
    branding: practiceBrandingJson(row),
    organization: organizationProfileExtras(row),
    updatedAt: row.updatedAt,
  };
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 */
export async function getPracticeSettings(actorUserId, practiceId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");

  const canManage = hasPracticePermission(access.role, PERMISSIONS.SETTINGS_MANAGE);
  const row = access.practice;

  return settingsToJson(row, { role: access.role, canManage });
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {Record<string, unknown>} body
 * @param {{ req?: import('express').Request }} ctx
 */
export async function patchPracticeSettings(actorUserId, practiceId, body, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!hasPracticePermission(access.role, PERMISSIONS.SETTINGS_MANAGE)) {
    throw new Error("forbidden");
  }

  const b = body || {};
  const data = {};
  const changedFields = [];

  if (Object.prototype.hasOwnProperty.call(b, "practiceName")) {
    const v = normalizeOpt(b.practiceName, 200);
    if (!v) throw new Error("practiceName_required");
    if (containsForbiddenMarketingClaims(v)) throw new Error("marketing_claim_forbidden");
    data.practiceName = v;
    changedFields.push("practiceName");
  }
  if (Object.prototype.hasOwnProperty.call(b, "specialty")) {
    data.specialty = normalizeOpt(b.specialty, 160);
    changedFields.push("specialty");
  }
  if (Object.prototype.hasOwnProperty.call(b, "description")) {
    const v = normalizeOpt(b.description, 2000);
    if (v && containsForbiddenMarketingClaims(v)) throw new Error("marketing_claim_forbidden");
    data.description = v;
    changedFields.push("description");
  }
  if (Object.prototype.hasOwnProperty.call(b, "website")) {
    data.website = normalizeOpt(b.website, 500);
    changedFields.push("website");
  }
  if (Object.prototype.hasOwnProperty.call(b, "phone")) {
    data.phone = normalizeOpt(b.phone, 80);
    changedFields.push("phone");
  }
  if (Object.prototype.hasOwnProperty.call(b, "email")) {
    const v = normalizeOpt(b.email, 254);
    if (v && !isValidEmail(v)) throw new Error("email_invalid");
    data.email = v ? v.toLowerCase() : null;
    changedFields.push("email");
  }
  if (Object.prototype.hasOwnProperty.call(b, "address")) {
    data.address = normalizeOpt(b.address, 500);
    changedFields.push("address");
  }
  if (Object.prototype.hasOwnProperty.call(b, "city")) {
    data.city = normalizeOpt(b.city, 120);
    changedFields.push("city");
  }
  if (Object.prototype.hasOwnProperty.call(b, "postalCode")) {
    data.postalCode = normalizeOpt(b.postalCode, 20);
    changedFields.push("postalCode");
  }
  if (Object.prototype.hasOwnProperty.call(b, "country")) {
    data.country = normalizeOpt(b.country, 80);
    changedFields.push("country");
  }
  if (Object.prototype.hasOwnProperty.call(b, "preferredDoctorLanguage")) {
    const v = normalizeOpt(b.preferredDoctorLanguage, 12);
    if (!v || !ALLOWED_LANGS.has(v)) throw new Error("preferredDoctorLanguage_invalid");
    data.preferredDoctorLanguage = v;
    changedFields.push("preferredDoctorLanguage");
  }
  if (Object.prototype.hasOwnProperty.call(b, "supportedLanguages")) {
    data.supportedLanguages = parseSupportedLanguages(b.supportedLanguages);
    changedFields.push("supportedLanguages");
  }
  if (Object.prototype.hasOwnProperty.call(b, "openingHours")) {
    data.openingHours = normalizeOpt(b.openingHours, 600);
    changedFields.push("openingHours");
  }
  if (Object.prototype.hasOwnProperty.call(b, "patientIntroText")) {
    const v = normalizeOpt(b.patientIntroText, 1200);
    if (v && containsForbiddenMarketingClaims(v)) throw new Error("marketing_claim_forbidden");
    data.patientIntroText = v;
    changedFields.push("patientIntroText");
  }
  if (Object.prototype.hasOwnProperty.call(b, "displayNameForPatients")) {
    const v = normalizeOpt(b.displayNameForPatients, 200);
    if (v && containsForbiddenMarketingClaims(v)) throw new Error("marketing_claim_forbidden");
    data.displayNameForPatients = v;
    changedFields.push("displayNameForPatients");
  }
  if (Object.prototype.hasOwnProperty.call(b, "accentColor")) {
    const raw = b.accentColor;
    if (raw === null || raw === "") {
      data.accentColor = null;
    } else {
      const normalized = normalizeAccentColor(raw);
      if (!normalized || !isAccentColorAccessible(normalized)) {
        throw new Error("accentColor_invalid");
      }
      data.accentColor = normalized;
    }
    changedFields.push("accentColor");
  }
  if (Object.prototype.hasOwnProperty.call(b, "logoUrl") && !access.practice.logoStorageKey) {
    data.logoUrl = normalizeOpt(b.logoUrl, 500);
    changedFields.push("logoUrl");
  }
  if (Object.prototype.hasOwnProperty.call(b, "organizationType")) {
    data.organizationType = normalizeOrganizationType(b.organizationType);
    changedFields.push("organizationType");
  }
  if (Object.prototype.hasOwnProperty.call(b, "specialties")) {
    data.specialtiesJson = stringifyJsonArray(parseJsonStringArray(b.specialties));
    changedFields.push("specialties");
  }
  if (Object.prototype.hasOwnProperty.call(b, "stateRegion")) {
    data.stateRegion = normalizeOpt(b.stateRegion, 120);
    changedFields.push("stateRegion");
  }
  for (const key of [
    "acceptsPublicInsurance",
    "acceptsPrivateInsurance",
    "acceptsSelfPay",
  ]) {
    if (Object.prototype.hasOwnProperty.call(b, key)) {
      data[key] = normalizeInsuranceTriState(b[key]);
      changedFields.push(key);
    }
  }
  for (const key of [
    "emergencyCareAvailable",
    "onlineAppointmentsAvailable",
    "videoConsultationAvailable",
  ]) {
    if (Object.prototype.hasOwnProperty.call(b, key)) {
      data[key] = b[key] === null ? null : Boolean(b[key]);
      changedFields.push(key);
    }
  }
  if (Object.prototype.hasOwnProperty.call(b, "accessibility")) {
    const acc = parseAccessibility(b.accessibility);
    data.accessibilityJson = acc ? JSON.stringify(acc) : null;
    changedFields.push("accessibility");
  }

  if (!Object.keys(data).length) throw new Error("validation_required");

  const row = await prisma.practiceProfile.update({
    where: { id: practiceId },
    data,
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    practiceProfileId: practiceId,
    action: "practice_settings_updated",
    entityType: "PracticeProfile",
    entityId: practiceId,
    metadata: { fields: changedFields },
  });

  return settingsToJson(row, { role: access.role, canManage: true });
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {{ buffer: Buffer, mimeType: string }} file
 * @param {{ req?: import('express').Request }} ctx
 */
export async function uploadPracticeLogo(actorUserId, practiceId, file, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!hasPracticePermission(access.role, PERMISSIONS.SETTINGS_MANAGE)) {
    throw new Error("forbidden");
  }

  const storageKey = await practiceLogoStorage.putLogo({
    practiceProfileId: practiceId,
    buffer: file.buffer,
    mimeType: file.mimeType,
  });

  if (access.practice.logoStorageKey) {
    await practiceLogoStorage.deleteLogo(access.practice.logoStorageKey);
  }

  const row = await prisma.practiceProfile.update({
    where: { id: practiceId },
    data: {
      logoStorageKey: storageKey,
      logoMimeType: file.mimeType,
      logoUrl: null,
    },
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    practiceProfileId: practiceId,
    action: "practice_logo_uploaded",
    entityType: "PracticeProfile",
    entityId: practiceId,
    metadata: {},
  });

  return settingsToJson(row, { role: access.role, canManage: true });
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {{ req?: import('express').Request }} ctx
 */
export async function deletePracticeLogo(actorUserId, practiceId, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!hasPracticePermission(access.role, PERMISSIONS.SETTINGS_MANAGE)) {
    throw new Error("forbidden");
  }

  await practiceLogoStorage.deleteLogo(access.practice.logoStorageKey);

  const row = await prisma.practiceProfile.update({
    where: { id: practiceId },
    data: {
      logoStorageKey: null,
      logoMimeType: null,
    },
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    practiceProfileId: practiceId,
    action: "practice_logo_deleted",
    entityType: "PracticeProfile",
    entityId: practiceId,
    metadata: {},
  });

  return settingsToJson(row, { role: access.role, canManage: true });
}

/**
 * @param {string} practiceId
 */
export async function getPracticeLogoFile(practiceId) {
  const row = await prisma.practiceProfile.findUnique({
    where: { id: practiceId },
    select: { logoStorageKey: true, logoMimeType: true },
  });
  if (!row?.logoStorageKey) return null;
  const buffer = await practiceLogoStorage.getLogo(row.logoStorageKey);
  return { buffer, mimeType: row.logoMimeType || "image/png" };
}

/**
 * Patient branding when an active link exists.
 * @param {string} patientUserId
 * @param {string} practiceId
 */
export async function getPatientPracticeBranding(patientUserId, practiceId) {
  const link = await prisma.practicePatientLink.findFirst({
    where: {
      practiceProfileId: practiceId,
      patientUserId,
      status: { in: ["invited", "active"] },
    },
    select: { id: true },
  });
  if (!link) throw new Error("forbidden");

  const row = await prisma.practiceProfile.findUnique({
    where: { id: practiceId },
    select: {
      id: true,
      practiceName: true,
      displayNameForPatients: true,
      logoUrl: true,
      logoStorageKey: true,
      logoMimeType: true,
      accentColor: true,
      patientIntroText: true,
      specialty: true,
      isActive: true,
    },
  });
  if (!row || !row.isActive) throw new Error("practice_not_found");

  return practiceBrandingJson(row);
}
