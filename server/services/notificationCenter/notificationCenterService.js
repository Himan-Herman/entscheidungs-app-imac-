/**
 * The header's central entry point — a read-time view, not a store.
 *
 * WHAT THIS IS NOT
 *   There is no Notification table and no third inbox. PatientInboxItem and
 *   PracticeInboxItem remain the sources of truth and keep their own status
 *   vocabularies; this module only asks them a narrow question ("what is new,
 *   and what are the newest few?") on behalf of the header.
 *
 * THE TWO SIDES NEVER MEET
 *   Patient and practice have separate entry points, separate queries and
 *   separate authorization. Nothing here loads both and filters afterwards: a
 *   patient query never names PracticeInboxItem, and a practice query never
 *   names PatientInboxItem.
 *
 * THE BADGE MEANS ONE THING
 *   Unread (patient) or new (practice) inbox items. Open follow-ups are real
 *   work but they are not "unread", so they are counted separately and never
 *   folded into that number.
 */

import { prisma } from "../../lib/prisma.js";
import {
  countUnreadPatientInbox,
  listInboxItemsForPatient,
} from "../patientInbox/patientInboxService.js";
import {
  countNewPracticeInbox,
  listPracticeInboxItems,
} from "../practiceInbox/practiceInboxService.js";
import { safeInternalPath } from "../patientInbox/patientInboxTargets.js";

/** How many items the header shows. The full history lives on the inbox page. */
export const PREVIEW_LIMIT = 5;

/**
 * Where a PRACTICE inbox notice leads.
 *
 * The practice list serializer hands the stored `targetUrl` through unchanged.
 * For a header preview that is not good enough: a stored path is written once
 * and never revisited, so a renamed route leaves a dead link, and the value
 * itself has never been validated as same-origin. The patient side already
 * solved this by reconstructing known kinds at read time; the same policy is
 * applied here.
 *
 * Link-scoped destinations are built from the link the item already carries —
 * the row's own scope — so a preview can never point into another
 * relationship.
 *
 * @param {{ sourceRefType?: string, sourceRefId?: string, targetUrl?: string,
 *           practicePatientLinkId?: string, practiceProfileId?: string }} row
 * @returns {string | null}
 */
export function practiceInboxTargetUrl(row) {
  const linkId = String(row?.practicePatientLinkId ?? "").trim();
  const practiceId = String(row?.practiceProfileId ?? "").trim();

  // Anything tied to one care relationship opens that relationship, in the
  // practice context it belongs to. Both routes are real: /practice/patients
  // /:linkId and /practice/patients/:linkId/messages.
  //
  // The kinds the producers actually write are thread, data_request,
  // follow_up, practice_document, medication_plan, practice_patient_link,
  // previsit_session and telemedicine_session. Only the conversation has a
  // destination of its own; the rest belong on the patient record — and an
  // unknown future kind lands there too, rather than nowhere.
  if (linkId) {
    const q = practiceId ? `?practiceId=${encodeURIComponent(practiceId)}` : "";
    const path =
      row?.sourceRefType === "thread" || row?.sourceRefType === "message"
        ? `/practice/patients/${encodeURIComponent(linkId)}/messages`
        : `/practice/patients/${encodeURIComponent(linkId)}`;
    return `${path}${q}`;
  }

  // Not relationship-bound — the stored path is all there is, so it is used
  // only if it is a same-origin path. An absolute or protocol-relative value
  // is dropped rather than handed to the browser.
  return safeInternalPath(row?.targetUrl);
}

/**
 * The header only needs enough to name an item and go to it.
 *
 * Deliberately NOT copied from the row: message and note bodies, document or
 * medication content, and `patientUserId`. `patientLabel` is passed in by the
 * practice side only — it is the display name the same reader already sees on
 * /practice/inbox, never the account id and never the email.
 */
function toPreview(row, targetUrl, patientLabel) {
  return {
    id: row.id,
    type: row.type,
    // Titles are written neutral by the producers — no clinical wording.
    title: row.title,
    titleKey: row.titleKey ?? null,
    createdAt: row.lastActivityAt ?? row.createdAt,
    unread: row.status === "unread" || row.status === "new",
    targetUrl,
    ...(patientLabel ? { patientLabel } : {}),
  };
}

/**
 * @param {string} patientUserId
 * @returns {Promise<{ unreadInboxCount: number, items: object[], inboxPath: string }>}
 */
export async function getPatientNotificationSummary(patientUserId) {
  const [unreadInboxCount, list] = await Promise.all([
    countUnreadPatientInbox(patientUserId),
    listInboxItemsForPatient(patientUserId, { status: "unread", limit: PREVIEW_LIMIT }),
  ]);

  const rows = Array.isArray(list?.items) ? list.items : [];
  return {
    unreadInboxCount,
    // listInboxItemsForPatient already runs each row through the safe target
    // module, so the preview inherits that policy rather than repeating it.
    items: rows.slice(0, PREVIEW_LIMIT).map((r) => toPreview(r, safeInternalPath(r.targetUrl))),
    inboxPath: "/patient/inbox",
  };
}

/**
 * @param {{ practiceProfileId: string, canReadReminders: boolean }} input
 * @returns {Promise<object>} `openReminderCount` and `remindersPath` are absent
 *   unless the caller may read reminders — an absent key tells a forbidden
 *   reader nothing, where a zero would still confirm the feature exists here.
 */
export async function getPracticeNotificationSummary(input) {
  const practiceProfileId = String(input?.practiceProfileId ?? "").trim();
  if (!practiceProfileId) throw new Error("practiceId_required");

  const [newInboxCount, list, openReminderCount] = await Promise.all([
    countNewPracticeInbox(practiceProfileId),
    listPracticeInboxItems(practiceProfileId, { status: "new", limit: PREVIEW_LIMIT }),
    input?.canReadReminders
      ? prisma.practicePatientReminder.count({
          where: { practiceProfileId, completedAt: null },
        })
      : Promise.resolve(null),
  ]);

  const rows = Array.isArray(list?.items) ? list.items : [];
  return {
    newInboxCount,
    items: rows
      .slice(0, PREVIEW_LIMIT)
      .map((r) => toPreview(r, practiceInboxTargetUrl(r), r.patient?.displayName || null)),
    inboxPath: "/practice/inbox",
    ...(input?.canReadReminders
      ? {
          openReminderCount,
          // Straight to the Phase 5B surface with its own filter — the header
          // never becomes a second place to work through follow-ups.
          remindersPath: `/practice/patients?practiceId=${encodeURIComponent(
            practiceProfileId,
          )}&filter=reminders`,
        }
      : {}),
  };
}
