import { prisma } from "../../lib/prisma.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { canReadBooking, canManageBooking } from "../../utils/practicePermissions.js";
import { writeAuditLog } from "../auditLogService.js";


/** Valid bookingMode values — no external link modes. */
const ALLOWED_BOOKING_MODES = ["disabled", "medscoutx_request"];

/**
 * Serialises a PracticeBookingSettings row for API responses.
 * Never exposes internal DB ids beyond what the caller needs.
 */
function settingsToJson(row, access) {
  return {
    bookingEnabled: row.bookingEnabled,
    bookingMode: row.bookingMode,
    requestFormNote: row.requestFormNote ?? null,
    linkedAnamnesisLinkId: row.linkedAnamnesisLinkId ?? null,
    canManage: canManageBooking(access.role),
  };
}

/**
 * Returns booking settings for the practice.
 * Auto-creates a default row (bookingEnabled=false, bookingMode="disabled") if none exists yet.
 */
export async function getBookingSettings(actorUserId, practiceId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canReadBooking(access.role)) throw new Error("forbidden");

  let row = await prisma.practiceBookingSettings.findUnique({
    where: { practiceProfileId: practiceId },
  });
  if (!row) {
    row = await prisma.practiceBookingSettings.create({
      data: { practiceProfileId: practiceId },
    });
  }

  return settingsToJson(row, access);
}

/**
 * Updates booking settings for the practice.
 * Only owner / admin / practice_manager (BOOKING_MANAGE) may call this.
 *
 * Accepted body fields:
 *   bookingEnabled       Boolean
 *   bookingMode          "disabled" | "medscoutx_request"
 *   requestFormNote      string (max 300 chars) | null to clear
 *   linkedAnamnesisLinkId  string (existing link id) | null to clear
 */
export async function patchBookingSettings(actorUserId, practiceId, body, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageBooking(access.role)) throw new Error("forbidden");

  const data = {};

  if (body.bookingEnabled !== undefined) {
    data.bookingEnabled = Boolean(body.bookingEnabled);
  }

  if (body.bookingMode !== undefined) {
    const mode = String(body.bookingMode).trim();
    if (!ALLOWED_BOOKING_MODES.includes(mode)) {
      throw new Error("booking_mode_invalid");
    }
    data.bookingMode = mode;
  }

  if (Object.prototype.hasOwnProperty.call(body, "requestFormNote")) {
    if (body.requestFormNote === null || body.requestFormNote === "") {
      data.requestFormNote = null;
    } else {
      data.requestFormNote = String(body.requestFormNote).trim().slice(0, 300);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "linkedAnamnesisLinkId")) {
    if (body.linkedAnamnesisLinkId === null || body.linkedAnamnesisLinkId === "") {
      data.linkedAnamnesisLinkId = null;
    } else {
      const linkId = String(body.linkedAnamnesisLinkId).trim();
      await validateAnamnesisLink(linkId, practiceId);
      data.linkedAnamnesisLinkId = linkId;
    }
  }

  // --- Coupling rules for bookingEnabled / bookingMode ---
  // Capture original intent before any auto-fix so rules don't interfere with each other.
  const intendedEnabled = data.bookingEnabled; // true | false | undefined
  const intendedMode    = data.bookingMode;    // "disabled" | "medscoutx_request" | undefined

  if (intendedEnabled !== undefined || intendedMode !== undefined) {
    // Rule A: "medscoutx_request" requires bookingEnabled=true.
    // Fetch current row only when bookingEnabled is not being set in this request.
    if (intendedMode === "medscoutx_request" && intendedEnabled === undefined) {
      const cur = await prisma.practiceBookingSettings.findUnique({
        where:  { practiceProfileId: practiceId },
        select: { bookingEnabled: true },
      });
      if (!(cur?.bookingEnabled ?? false)) {
        throw new Error("booking_mode_conflict");
      }
    }
    if (intendedMode === "medscoutx_request" && intendedEnabled === false) {
      throw new Error("booking_mode_conflict");
    }

    // Rule B: bookingEnabled=false → force bookingMode="disabled".
    if (intendedEnabled === false) {
      data.bookingMode = "disabled";
    }

    // Rule C: bookingMode="disabled" → force bookingEnabled=false.
    if (intendedMode === "disabled") {
      data.bookingEnabled = false;
    }
  }
  // --- end coupling rules ---

  if (Object.keys(data).length === 0) {
    // Nothing to update — return current settings without a write
    const current = await getBookingSettings(actorUserId, practiceId);
    return current;
  }

  const row = await prisma.practiceBookingSettings.upsert({
    where: { practiceProfileId: practiceId },
    create: { practiceProfileId: practiceId, ...data },
    update: data,
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "booking_settings_updated",
    practiceProfileId: practiceId,
    metadata: { fields: Object.keys(data) },
  }).catch(() => {});

  return settingsToJson(row, access);
}

/**
 * Validates that a PracticeAnamnesisLink:
 *   - exists
 *   - belongs to the same practice
 *   - is active
 *   - has not expired
 *
 * Throws a named error on any violation so the route can return a clear 422.
 */
async function validateAnamnesisLink(linkId, practiceId) {
  const link = await prisma.practiceAnamnesisLink.findUnique({
    where: { id: linkId },
    select: {
      id: true,
      practiceProfileId: true,
      isActive: true,
      expiresAt: true,
    },
  });

  if (!link) throw new Error("anamnesis_link_not_found");
  if (link.practiceProfileId !== practiceId) throw new Error("anamnesis_link_not_found");
  if (!link.isActive) throw new Error("anamnesis_link_inactive");
  if (link.expiresAt !== null && link.expiresAt <= new Date()) {
    throw new Error("anamnesis_link_expired");
  }
}
