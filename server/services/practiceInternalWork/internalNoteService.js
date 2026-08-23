/**
 * Practice-internal notes on ONE patient–practice relationship.
 *
 * THE SECURITY PROPERTY IS THE QUERY, NOT A FILTER
 *   Every read and every write names `practicePatientLinkId` AND
 *   `practiceProfileId` in its WHERE clause, both taken from the authorization
 *   decision rather than from the request. There is no "load then compare":
 *   a note belonging to another link or another practice is not fetched and
 *   then rejected, it is never selected.
 *
 *   Nothing on the patient side imports this module. That is what keeps notes
 *   invisible to patients — not a flag, not a serializer, not the UI.
 */

import { prisma } from "../../lib/prisma.js";
import {
  INTERNAL_WORK_ERRORS,
  InternalWorkError,
  assertUsableNoteBody,
} from "./internalWorkPolicy.js";

/** Fields a practice client actually needs. No tenant ids, no raw user ids. */
function toJson(note, authorName) {
  return {
    id: note.id,
    body: note.body,
    createdAt: note.createdAt,
    editedAt: note.editedAt ?? null,
    authorName,
    // Lets the UI decide whether to offer an edit control, without shipping the
    // author's user id to the browser.
    canEdit: note.__canEdit === true,
  };
}

/**
 * One query for every author on the page, so a long list stays two queries.
 *
 * @param {string[]} userIds
 * @returns {Promise<Map<string, string>>}
 */
async function loadAuthorNames(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  return new Map(
    users.map((u) => [
      u.id,
      [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email,
    ]),
  );
}

/**
 * @param {{ linkId: string, practiceProfileId: string, actorUserId: string }} scope
 */
export async function listInternalNotes(scope) {
  const notes = await prisma.practicePatientInternalNote.findMany({
    where: {
      practicePatientLinkId: scope.linkId,
      practiceProfileId: scope.practiceProfileId,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      body: true,
      authorUserId: true,
      editedAt: true,
      createdAt: true,
    },
  });

  const names = await loadAuthorNames(notes.map((n) => n.authorUserId));
  return notes.map((n) =>
    toJson(
      { ...n, __canEdit: Boolean(n.authorUserId) && n.authorUserId === scope.actorUserId },
      n.authorUserId ? (names.get(n.authorUserId) ?? null) : null,
    ),
  );
}

/**
 * @param {{ linkId: string, practiceProfileId: string, actorUserId: string, body: unknown }} input
 */
export async function createInternalNote(input) {
  const body = assertUsableNoteBody(input.body);

  const note = await prisma.practicePatientInternalNote.create({
    data: {
      practicePatientLinkId: input.linkId,
      practiceProfileId: input.practiceProfileId,
      authorUserId: input.actorUserId,
      body,
    },
    select: { id: true, body: true, authorUserId: true, editedAt: true, createdAt: true },
  });

  const names = await loadAuthorNames([note.authorUserId]);
  return toJson({ ...note, __canEdit: true }, names.get(note.authorUserId) ?? null);
}

/**
 * Edits a note the actor wrote themselves.
 *
 * One atomic UPDATE bounded by link, practice AND author: a foreign note is not
 * found rather than refused, so no id can be probed. Editing someone else's
 * note is not a permission this phase grants to anyone.
 *
 * @param {{ noteId: string, linkId: string, practiceProfileId: string, actorUserId: string, body: unknown }} input
 */
export async function updateOwnInternalNote(input) {
  const body = assertUsableNoteBody(input.body);

  const result = await prisma.practicePatientInternalNote.updateMany({
    where: {
      id: input.noteId,
      practicePatientLinkId: input.linkId,
      practiceProfileId: input.practiceProfileId,
      authorUserId: input.actorUserId,
    },
    data: { body, editedAt: new Date() },
  });
  if (result.count === 0) throw new InternalWorkError(INTERNAL_WORK_ERRORS.NOT_FOUND);

  const note = await prisma.practicePatientInternalNote.findFirst({
    where: {
      id: input.noteId,
      practicePatientLinkId: input.linkId,
      practiceProfileId: input.practiceProfileId,
    },
    select: { id: true, body: true, authorUserId: true, editedAt: true, createdAt: true },
  });
  const names = await loadAuthorNames([note?.authorUserId]);
  return toJson({ ...note, __canEdit: true }, names.get(note?.authorUserId) ?? null);
}
