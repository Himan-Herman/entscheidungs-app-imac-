import { PrismaClient } from "@prisma/client";
import { notifyPatientInboxOfMedicationPlan } from "./inboxNotify.js";

const prisma = new PrismaClient();

export const PLAN_STATUSES = new Set(["draft", "published", "archived", "deleted"]);
const ACTIVE_PRACTICE_STATUSES = { not: "deleted" };
const LINK_ACTIVE = new Set(["invited", "active"]);

const MAX_TITLE_LEN = 200;
const MAX_NOTE_LEN = 2000;
const MAX_MED_NAME_LEN = 200;
const MAX_FIELD_LEN = 500;
const MAX_INSTRUCTIONS_LEN = 2000;
const MAX_ITEMS = 30;

const planInclude = {
  items: { orderBy: { sortOrder: "asc" } },
  practiceProfile: { select: { id: true, practiceName: true } },
};

function trimText(text, max) {
  const v = String(text ?? "").trim();
  if (!v) return null;
  if (v.length > max) throw new Error("validation_text_too_long");
  return v;
}

function parseDate(value) {
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("validation_invalid_date");
  return d;
}

/**
 * @param {unknown} raw
 */
function normalizeItems(raw) {
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_ITEMS) throw new Error("validation_too_many_items");

  return raw.map((row, index) => {
    const medicationName = trimText(row?.medicationName, MAX_MED_NAME_LEN);
    if (!medicationName) throw new Error("validation_required");

    return {
      medicationName,
      dosage: trimText(row?.dosage, MAX_FIELD_LEN),
      frequency: trimText(row?.frequency, MAX_FIELD_LEN),
      route: trimText(row?.route, MAX_FIELD_LEN),
      schedule: trimText(row?.schedule, MAX_FIELD_LEN),
      startDate: parseDate(row?.startDate),
      endDate: parseDate(row?.endDate),
      instructions: trimText(row?.instructions, MAX_INSTRUCTIONS_LEN),
      sortOrder:
        typeof row?.sortOrder === "number" && Number.isFinite(row.sortOrder)
          ? row.sortOrder
          : index,
    };
  });
}

/**
 * @param {import("@prisma/client").MedicationPlan & { items?: import("@prisma/client").MedicationPlanItem[], practiceProfile?: { id: string, practiceName: string | null } }} row
 */
function planToJson(row) {
  return {
    id: row.id,
    practicePatientLinkId: row.practicePatientLinkId,
    practiceProfileId: row.practiceProfileId,
    patientUserId: row.patientUserId,
    status: row.status,
    version: row.version,
    title: row.title,
    note: row.note,
    createdByUserId: row.createdByUserId,
    publishedAt: row.publishedAt,
    archivedAt: row.archivedAt,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    practiceName: row.practiceProfile?.practiceName ?? null,
    items: (row.items || []).map((item) => ({
      id: item.id,
      medicationName: item.medicationName,
      dosage: item.dosage,
      frequency: item.frequency,
      route: item.route,
      schedule: item.schedule,
      startDate: item.startDate,
      endDate: item.endDate,
      instructions: item.instructions,
      sortOrder: item.sortOrder,
    })),
  };
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function assertLinkForPractice(linkId, practiceProfileId) {
  const link = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, practiceProfileId },
  });
  if (!link) throw new Error("link_not_found");
  if (!LINK_ACTIVE.has(link.status)) throw new Error("link_not_active");
  return link;
}

async function nextVersionForLink(practicePatientLinkId) {
  const agg = await prisma.medicationPlan.aggregate({
    where: { practicePatientLinkId },
    _max: { version: true },
  });
  return (agg._max.version ?? 0) + 1;
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {string} createdByUserId
 * @param {{ title?: string, items?: unknown[] }} [payload]
 */
export async function createDraftMedicationPlan(
  linkId,
  practiceProfileId,
  createdByUserId,
  payload = {},
) {
  const link = await assertLinkForPractice(linkId, practiceProfileId);
  const items = normalizeItems(payload.items || []);
  const title = trimText(payload.title, MAX_TITLE_LEN);
  const version = await nextVersionForLink(linkId);

  const plan = await prisma.$transaction(async (tx) => {
    const created = await tx.medicationPlan.create({
      data: {
        practicePatientLinkId: link.id,
        practiceProfileId: link.practiceProfileId,
        patientUserId: link.patientUserId,
        status: "draft",
        version,
        title,
        note,
        createdByUserId,
      },
    });

    if (items.length > 0) {
      await tx.medicationPlanItem.createMany({
        data: items.map((item) => ({
          ...item,
          medicationPlanId: created.id,
        })),
      });
    }

    return tx.medicationPlan.findUnique({
      where: { id: created.id },
      include: planInclude,
    });
  });

  return planToJson(plan);
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {string} planId
 */
export async function getMedicationPlanByLink(linkId, practiceProfileId, planId) {
  await assertLinkForPractice(linkId, practiceProfileId);
  const plan = await prisma.medicationPlan.findFirst({
    where: {
      id: planId,
      practicePatientLinkId: linkId,
      practiceProfileId,
      status: ACTIVE_PRACTICE_STATUSES,
    },
    include: planInclude,
  });
  if (!plan) throw new Error("plan_not_found");
  return planToJson(plan);
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function listMedicationPlansForPracticePatient(
  linkId,
  practiceProfileId,
) {
  await assertLinkForPractice(linkId, practiceProfileId);
  const rows = await prisma.medicationPlan.findMany({
    where: { practicePatientLinkId: linkId, practiceProfileId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      practiceProfile: { select: { id: true, practiceName: true } },
    },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(planToJson);
}

/**
 * @param {string} patientUserId
 */
export async function listMedicationPlansForPatient(patientUserId) {
  const rows = await prisma.medicationPlan.findMany({
    where: { patientUserId, status: "published" },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      practiceProfile: { select: { id: true, practiceName: true } },
    },
    orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
  });
  return rows.map(planToJson);
}

/**
 * @param {string} planId
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {{ title?: string, items?: unknown[] }} payload
 */
export async function updateDraftMedicationPlan(
  planId,
  linkId,
  practiceProfileId,
  payload,
) {
  await assertLinkForPractice(linkId, practiceProfileId);
  const existing = await prisma.medicationPlan.findFirst({
    where: {
      id: planId,
      practicePatientLinkId: linkId,
      practiceProfileId,
    },
  });
  if (!existing) throw new Error("plan_not_found");
  if (existing.status !== "draft") throw new Error("plan_not_editable");

  const items = normalizeItems(payload.items ?? []);
  const title =
    payload.title !== undefined
      ? trimText(payload.title, MAX_TITLE_LEN)
      : existing.title;
  const note =
    payload.note !== undefined
      ? trimText(payload.note, MAX_NOTE_LEN)
      : existing.note;

  const plan = await prisma.$transaction(async (tx) => {
    await tx.medicationPlanItem.deleteMany({
      where: { medicationPlanId: planId },
    });

    if (items.length > 0) {
      await tx.medicationPlanItem.createMany({
        data: items.map((item) => ({
          ...item,
          medicationPlanId: planId,
        })),
      });
    }

    await tx.medicationPlan.update({
      where: { id: planId },
      data: { title, note },
    });

    return tx.medicationPlan.findUnique({
      where: { id: planId },
      include: planInclude,
    });
  });

  return planToJson(plan);
}

/**
 * @param {string} planId
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function publishMedicationPlan(planId, linkId, practiceProfileId) {
  await assertLinkForPractice(linkId, practiceProfileId);
  const existing = await prisma.medicationPlan.findFirst({
    where: {
      id: planId,
      practicePatientLinkId: linkId,
      practiceProfileId,
    },
    include: { items: true },
  });
  if (!existing) throw new Error("plan_not_found");
  if (existing.status !== "draft") throw new Error("plan_not_publishable");
  if (!existing.items.length) throw new Error("validation_required");

  const plan = await prisma.medicationPlan.update({
    where: { id: planId },
    data: {
      status: "published",
      publishedAt: new Date(),
    },
    include: planInclude,
  });

  const json = planToJson(plan);
  await notifyPatientInboxOfMedicationPlan({
    id: plan.id,
    patientUserId: plan.patientUserId,
    practiceProfileId: plan.practiceProfileId,
    practicePatientLinkId: plan.practicePatientLinkId,
  });

  return json;
}

/**
 * @param {string} planId
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function archiveMedicationPlan(planId, linkId, practiceProfileId) {
  await assertLinkForPractice(linkId, practiceProfileId);
  const existing = await prisma.medicationPlan.findFirst({
    where: {
      id: planId,
      practicePatientLinkId: linkId,
      practiceProfileId,
    },
  });
  if (!existing) throw new Error("plan_not_found");
  if (existing.status === "archived") throw new Error("plan_already_archived");

  const plan = await prisma.medicationPlan.update({
    where: { id: planId },
    data: {
      status: "archived",
      archivedAt: new Date(),
    },
    include: planInclude,
  });

  return planToJson(plan);
}

/**
 * Soft-delete a plan (removes from active views).
 * @param {string} planId
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {string} deletedByUserId
 */
export async function deleteMedicationPlan(
  planId,
  linkId,
  practiceProfileId,
  deletedByUserId,
) {
  await assertLinkForPractice(linkId, practiceProfileId);
  const existing = await prisma.medicationPlan.findFirst({
    where: {
      id: planId,
      practicePatientLinkId: linkId,
      practiceProfileId,
      status: ACTIVE_PRACTICE_STATUSES,
    },
  });
  if (!existing) throw new Error("plan_not_found");
  if (existing.status === "deleted") throw new Error("plan_already_deleted");

  const now = new Date();
  const plan = await prisma.medicationPlan.update({
    where: { id: planId },
    data: {
      status: "deleted",
      deletedAt: now,
      deletedByUserId,
    },
    include: planInclude,
  });

  return planToJson(plan);
}

/**
 * @param {string} planId
 * @param {string} patientUserId
 */
export async function getMedicationPlanForPatient(planId, patientUserId) {
  const plan = await prisma.medicationPlan.findFirst({
    where: {
      id: planId,
      patientUserId,
      status: "published",
    },
    include: planInclude,
  });
  if (!plan) throw new Error("plan_not_found");
  return planToJson(plan);
}
