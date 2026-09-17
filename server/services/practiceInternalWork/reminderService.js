/**
 * Practice-internal follow-up markers on ONE patient–practice relationship.
 *
 * Same security property as the notes beside them: every statement names the
 * link AND the practice, both from the authorization decision. Nothing on the
 * patient side imports this module, so a reminder cannot reach a patient
 * response by omission.
 *
 * Creating or completing a reminder writes nothing else — no PatientInboxItem,
 * no unread counter, no thread reopen, no mail, no push. That absence is
 * asserted by tests rather than left to reviewers to notice.
 */

import { prisma } from "../../lib/prisma.js";
import {
  INTERNAL_WORK_ERRORS,
  InternalWorkError,
  assertUsableDueAt,
  assertUsableReminderTitle,
} from "./internalWorkPolicy.js";

function toJson(reminder, names) {
  return {
    id: reminder.id,
    title: reminder.title,
    dueAt: reminder.dueAt,
    completedAt: reminder.completedAt ?? null,
    createdAt: reminder.createdAt,
    createdByName: reminder.createdByUserId ? (names.get(reminder.createdByUserId) ?? null) : null,
    assignedToName: reminder.assignedToUserId ? (names.get(reminder.assignedToUserId) ?? null) : null,
  };
}

/** @param {string[]} userIds @returns {Promise<Map<string,string>>} */
async function loadNames(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  return new Map(
    users.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email]),
  );
}

/**
 * An assignee must be an ACTIVE member of the practice that owns the link.
 *
 * A user id from the request body is a claim; membership is a row. Without this
 * check a practice could point a reminder at any account in the product.
 *
 * @param {string | null | undefined} assignedToUserId
 * @param {string} practiceProfileId
 * @returns {Promise<string | null>}
 */
export async function resolveAssignee(assignedToUserId, practiceProfileId) {
  const id = String(assignedToUserId ?? "").trim();
  if (!id) return null;

  const [member, practice] = await Promise.all([
    prisma.practiceMember.findFirst({
      where: { practiceProfileId, userId: id, status: "active" },
      select: { id: true },
    }),
    // The owner is not a PracticeMember row but is unquestionably in the practice.
    prisma.practiceProfile.findFirst({
      where: { id: practiceProfileId, userId: id },
      select: { id: true },
    }),
  ]);
  if (!member && !practice) {
    throw new InternalWorkError(INTERNAL_WORK_ERRORS.ASSIGNEE_NOT_IN_PRACTICE);
  }
  return id;
}

/**
 * @param {{ linkId: string, practiceProfileId: string, status?: "open" | "completed" | "all" }} scope
 */
export async function listReminders(scope) {
  const status = scope.status ?? "all";
  const rows = await prisma.practicePatientReminder.findMany({
    where: {
      practicePatientLinkId: scope.linkId,
      practiceProfileId: scope.practiceProfileId,
      ...(status === "open" ? { completedAt: null } : {}),
      ...(status === "completed" ? { NOT: { completedAt: null } } : {}),
    },
    orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }],
    select: {
      id: true,
      title: true,
      dueAt: true,
      completedAt: true,
      createdAt: true,
      createdByUserId: true,
      assignedToUserId: true,
    },
  });
  const names = await loadNames(rows.flatMap((r) => [r.createdByUserId, r.assignedToUserId]));
  return rows.map((r) => toJson(r, names));
}

/**
 * @param {{ linkId: string, practiceProfileId: string, actorUserId: string,
 *           title: unknown, dueAt: unknown, assignedToUserId?: unknown }} input
 */
export async function createReminder(input) {
  const title = assertUsableReminderTitle(input.title);
  // The server's clock decides what "now" is, for the range check and for
  // createdAt; a client may only propose the due date itself.
  const dueAt = assertUsableDueAt(input.dueAt, new Date());
  const assignedToUserId = await resolveAssignee(input.assignedToUserId, input.practiceProfileId);

  const row = await prisma.practicePatientReminder.create({
    data: {
      practicePatientLinkId: input.linkId,
      practiceProfileId: input.practiceProfileId,
      createdByUserId: input.actorUserId,
      assignedToUserId,
      title,
      dueAt,
    },
    select: {
      id: true, title: true, dueAt: true, completedAt: true, createdAt: true,
      createdByUserId: true, assignedToUserId: true,
    },
  });
  const names = await loadNames([row.createdByUserId, row.assignedToUserId]);
  return toJson(row, names);
}

/**
 * Marks a reminder done. One atomic UPDATE bounded by link and practice, and by
 * `completedAt: null` so a second click cannot rewrite who completed it.
 *
 * Nothing is deleted: the row stays, with the time and the person recorded.
 *
 * @param {{ reminderId: string, linkId: string, practiceProfileId: string, actorUserId: string }} input
 */
export async function completeReminder(input) {
  const result = await prisma.practicePatientReminder.updateMany({
    where: {
      id: input.reminderId,
      practicePatientLinkId: input.linkId,
      practiceProfileId: input.practiceProfileId,
      completedAt: null,
    },
    data: { completedAt: new Date(), completedByUserId: input.actorUserId },
  });

  if (result.count === 0) {
    // Either it is not ours, or it was already done. Tell those apart only
    // WITHIN our own scope, so a foreign id still learns nothing.
    const mine = await prisma.practicePatientReminder.findFirst({
      where: {
        id: input.reminderId,
        practicePatientLinkId: input.linkId,
        practiceProfileId: input.practiceProfileId,
      },
      select: { id: true },
    });
    throw new InternalWorkError(
      mine ? INTERNAL_WORK_ERRORS.ALREADY_COMPLETED : INTERNAL_WORK_ERRORS.NOT_FOUND,
    );
  }

  const row = await prisma.practicePatientReminder.findFirst({
    where: {
      id: input.reminderId,
      practicePatientLinkId: input.linkId,
      practiceProfileId: input.practiceProfileId,
    },
    select: {
      id: true, title: true, dueAt: true, completedAt: true, createdAt: true,
      createdByUserId: true, assignedToUserId: true,
    },
  });
  const names = await loadNames([row.createdByUserId, row.assignedToUserId]);
  return toJson(row, names);
}
