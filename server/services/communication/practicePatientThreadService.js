import { prisma } from "../../lib/prisma.js";
import { requireConsentScopeAsync } from "../careRelationship/requireConsentScope.js";
import { notifyPatientInboxOfPracticeMessage } from "./inboxNotify.js";
import { notifyPracticeInboxOfPatientMessage } from "../practiceInbox/practiceInboxNotify.js";
import {
  PRACTICE_BRANDING_SELECT,
  practiceBrandingJson,
} from "../../utils/practiceBranding.js";


/**
 * CONSENT POLICY (Phase 1' — C-2 / C-4)
 * -------------------------------------
 * The `messages` scope (consent type `secure_messaging`) is the patient's grant
 * to the PRACTICE. It is therefore asymmetric on purpose:
 *
 *   practice read   -> consent REQUIRED   (was missing before; C-2)
 *   practice write  -> consent REQUIRED
 *   practice archive/close/restore -> consent REQUIRED, because these operations
 *                      also return the conversation content
 *   patient  read   -> consent NOT required — the patient is the data subject
 *                      reading their own communication. Making their own
 *                      history disappear the moment they withdraw a grant given
 *                      to someone else would be the wrong direction, and access
 *                      is a separate question from retention.
 *   patient  write   -> consent REQUIRED, because sending creates new
 *                      processing by the practice.
 *
 * C-4 (patient reading a thread on an ended relationship) is resolved
 * DELIBERATELY, not by omission: the patient keeps read access for any link
 * state, while `linkHasConsentType` returns false for non-usable link states,
 * which already blocks the patient from WRITING into a revoked relationship.
 * Both halves are locked by tests.
 */

/** SHARED lifecycle values stored in the column. "archived" is per party and computed. */
export const THREAD_STATUSES = new Set(["open", "closed"]);
export const SENDER_TYPES = new Set(["practice", "patient", "system"]);

/** Consent type gating all practice-side access to this conversation. */
const MESSAGING_CONSENT_SCOPE = "messages";

const MAX_SUBJECT_LEN = 200;
const MAX_BODY_LEN = 8000;
const LINK_ACTIVE = new Set(["invited", "active"]);

const includeLinkPractice = {
  practiceProfile: { select: PRACTICE_BRANDING_SELECT },
};

function practiceFromProfile(profile) {
  if (!profile) return null;
  return practiceBrandingJson(profile);
}

/**
 * @param {import("@prisma/client").PracticePatientMessage} msg
 */
/**
 * One message as ONE viewer may see it.
 *
 * `ctx` is the viewer's own perspective — their party, their user id, and
 * whether the relationship still accepts writes from them. Without it the
 * message is serialised as a bystander sees it: no capabilities, and no
 * assumption that the reader is anyone in particular.
 *
 * @param {import("@prisma/client").PracticePatientMessage} msg
 * @param {{ viewer?: "patient" | "practice", actorUserId?: string | null, writable?: boolean }} [ctx]
 */
function messageToJson(msg, ctx = {}) {
  const withdrawn = Boolean(msg.withdrawnAt);
  const own = isSenderOf(msg, ctx.viewer, ctx.actorUserId);
  // Capabilities are offered only where they mean something: on one's own
  // messages. Their absence is not a refusal, it is "this question does not
  // apply to you" — and they are never the authority (see editMessage).
  const mutable = own && !withdrawn && !msg.readAt && ctx.writable === true;

  return {
    id: msg.id,
    threadId: msg.threadId,
    senderType: msg.senderType,
    senderUserId: msg.senderUserId,
    // A withdrawn message keeps its place in the conversation and loses its
    // content. The body is cleared in the database on withdrawal; leaving it
    // out here as well means a row that predates that clearing, or one changed
    // by any other path, still cannot leak through this serialiser.
    body: withdrawn ? undefined : msg.body,
    createdAt: msg.createdAt,
    readAt: msg.readAt,
    editedAt: msg.editedAt ?? null,
    withdrawnAt: msg.withdrawnAt ?? null,
    canEdit: own ? mutable : undefined,
    canWithdraw: own ? mutable : undefined,
  };
}

/**
 * Is this message the actor's OWN?
 *
 * Both halves are required. The party alone is not enough: on the practice side
 * a conversation is written by several people, and one member must not be able
 * to rewrite another's words — that would put text in a colleague's name. A
 * message whose sender was never recorded (`senderUserId` is nullable, and
 * system messages have no author at all) belongs to nobody and is therefore
 * nobody's to change.
 *
 * @param {{ senderType: string, senderUserId: string | null }} msg
 * @param {string | undefined} viewer
 * @param {string | null | undefined} actorUserId
 */
function isSenderOf(msg, viewer, actorUserId) {
  if (!viewer || !actorUserId) return false;
  if (msg.senderType !== viewer) return false;
  return Boolean(msg.senderUserId) && msg.senderUserId === actorUserId;
}

/**
 * The canonical total order of a conversation.
 *
 * `createdAt` alone is not a total order: two messages can share a timestamp,
 * and then "everything before X" and "the next page" are both ambiguous. The
 * message id breaks the tie. The SAME order is used for the timeline, the
 * cursor and the read boundary — if they disagreed, a page boundary could hide
 * a message from one of them.
 */
export const MESSAGE_ORDER_ASC = Object.freeze([
  { createdAt: "asc" },
  { id: "asc" },
]);
const MESSAGE_ORDER_DESC = Object.freeze([{ createdAt: "desc" }, { id: "desc" }]);

/**
 * "At or before this point", in the canonical order.
 *
 * @param {{ createdAt: Date, id: string }} at
 */
function messagesUpToWhere(at) {
  return [
    { createdAt: { lt: at.createdAt } },
    { createdAt: at.createdAt, id: { lte: at.id } },
  ];
}

/**
 * "Strictly before this point", for paging backwards through history.
 *
 * @param {{ createdAt: Date, id: string }} at
 */
function messagesBeforeWhere(at) {
  return [
    { createdAt: { lt: at.createdAt } },
    { createdAt: at.createdAt, id: { lt: at.id } },
  ];
}


/**
 * @param {import("@prisma/client").PracticePatientThread & { messages?: import("@prisma/client").PracticePatientMessage[], _count?: { messages: number } }} row
 * @param {{ includeMessages?: boolean }} [opts]
 */
/**
 * @param {string} threadId
 * @param {"patient" | "practice"} unreadFromSender
 */
async function countUnreadFrom(threadId, unreadFromSender) {
  return prisma.practicePatientMessage.count({
    where: {
      threadId,
      senderType: unreadFromSender,
      readAt: null,
      // A withdrawn message has nothing left to read. Counting it would put a
      // badge on the conversation that promises the patient something new and
      // then shows them a blank. Its `readAt` is untouched all the same —
      // withdrawing is not reading (Phase 3B).
      withdrawnAt: null,
    },
  });
}

/**
 * The archive timestamp that belongs to one viewer. Never the other's, and
 * never the legacy shared column.
 *
 * @param {object} row
 * @param {"patient" | "practice"} viewer
 */
function archivedAtFor(row, viewer) {
  return viewer === "patient" ? row.patientArchivedAt : row.practiceArchivedAt;
}

/**
 * Status as THIS viewer sees it.
 *
 * `status` in the database is the shared lifecycle (open | closed). Archiving is
 * per party, so "archived" only ever exists in a response, computed for the side
 * that archived. This keeps the API contract stable — clients still receive
 * `status: "archived"` — while making it impossible for one party's tidying to
 * show up as archived for the other.
 *
 * @param {object} row
 * @param {"patient" | "practice" | undefined} viewer
 */
function statusFor(row, viewer) {
  if (viewer && archivedAtFor(row, viewer)) return "archived";
  return row.status;
}

function threadToJson(row, opts = {}) {
  // The viewer's perspective, passed down to every message so capabilities are
  // decided once and consistently.
  const ctx = {
    viewer: opts.viewer,
    actorUserId: opts.actorUserId ?? null,
    writable: opts.writable === true,
  };
  const lastMsg =
    row.messages && row.messages.length > 0
      ? row.messages[row.messages.length - 1]
      : null;
  return {
    id: row.id,
    practicePatientLinkId: row.practicePatientLinkId,
    practiceProfileId: row.practiceProfileId,
    patientUserId: row.patientUserId,
    subject: row.subject,
    status: statusFor(row, opts.viewer),
    archivedAt: opts.viewer ? archivedAtFor(row, opts.viewer) : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    closedAt: row.closedAt,
    messageCount: row._count?.messages ?? (row.messages ? row.messages.length : undefined),
    unreadCount: opts.unreadCount ?? 0,
    hasUnread: (opts.unreadCount ?? 0) > 0,
    lastMessage: lastMsg ? messageToJson(lastMsg, ctx) : null,
    messages:
      opts.includeMessages && row.messages
        ? row.messages.map((m) => messageToJson(m, ctx))
        : undefined,
    // Pagination state travels with the thread so the first render already
    // knows whether there is history above, without a second request.
    hasMoreMessages: opts.includeMessages ? Boolean(row.hasMoreMessages) : undefined,
    olderCursor: opts.includeMessages ? (row.olderCursor ?? null) : undefined,
  };
}

function trimText(text, max) {
  const v = String(text ?? "").trim();
  if (!v) return null;
  if (v.length > max) throw new Error("validation_text_too_long");
  return v;
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function assertLinkForPractice(linkId, practiceProfileId) {
  const link = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, practiceProfileId },
    include: includeLinkPractice,
  });
  if (!link) throw new Error("link_not_found");
  if (!LINK_ACTIVE.has(link.status)) throw new Error("link_not_active");
  return link;
}

/**
 * Practice-side gate: the link must belong to this practice, be usable, AND
 * carry the patient's messaging consent.
 *
 * This is the SERVICE-level half of C-2. The route guard already checks the
 * same consent, but the check lives here as well so that any future caller —
 * a job, an export, a new route — cannot reach conversation content by
 * bypassing the HTTP layer. Both layers use the same consent source of truth.
 *
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {{ actorUserId?: string, actorRole?: string }} [ctx]
 */
async function assertPracticeConsentedLink(linkId, practiceProfileId, ctx = {}) {
  const link = await assertLinkForPractice(linkId, practiceProfileId);
  await requireConsentScopeAsync(link, MESSAGING_CONSENT_SCOPE, {
    actorUserId: ctx.actorUserId,
    actorRole: ctx.actorRole || "practice",
  });
  return link;
}

/**
 * @param {string} linkId
 * @param {string} patientUserId
 */
export async function assertLinkForPatient(linkId, patientUserId) {
  const link = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, patientUserId },
    include: includeLinkPractice,
  });
  if (!link) throw new Error("link_not_found");
  if (!LINK_ACTIVE.has(link.status)) throw new Error("link_not_active");
  return link;
}

/**
 * @param {string} threadId
 * @param {string} practiceProfileId
 * @param {string} linkId
 */
async function getThreadForPractice(threadId, practiceProfileId, linkId) {
  const row = await prisma.practicePatientThread.findFirst({
    where: {
      id: threadId,
      practiceProfileId,
      practicePatientLinkId: linkId,
    },
    include: {
      _count: { select: { messages: true } },
    },
  });
  if (!row) throw new Error("thread_not_found");
  return attachNewestPage(row);
}

/**
 * @param {string} threadId
 * @param {string} patientUserId
 */
async function getThreadForPatient(threadId, patientUserId) {
  const row = await prisma.practicePatientThread.findFirst({
    where: { id: threadId, patientUserId },
    include: {
      practiceProfile: { select: PRACTICE_BRANDING_SELECT },
      _count: { select: { messages: true } },
    },
  });
  if (!row) throw new Error("thread_not_found");
  return attachNewestPage(row);
}

/**
 * Returns THE communication channel of a care relationship, creating it if this
 * is the first contact. Never creates a second one.
 *
 * Concurrency: the database decides, not this function. A plain
 * "SELECT, and CREATE if absent" would let two simultaneous requests — the
 * classic case of patient and practice opening communication at the same
 * moment — both see "absent" and both insert. Here the unique index on
 * `practicePatientLinkId` rejects the loser with P2002, and we return the row
 * the winner created. The leading read is only an optimisation for the common
 * case; correctness rests entirely on the constraint.
 *
 * @param {{ id: string, practiceProfileId: string, patientUserId: string }} link
 * @param {{ subject?: string | null }} [opts]
 * @returns {Promise<import("@prisma/client").PracticePatientThread>}
 */
export async function ensureCommunicationChannel(link, opts = {}) {
  const subject = opts.subject != null ? trimText(opts.subject, MAX_SUBJECT_LEN) : null;

  const existing = await prisma.practicePatientThread.findUnique({
    where: { practicePatientLinkId: link.id },
  });
  if (existing) {
    // A later opener never retitles an existing channel; the first subject
    // stands, and an untitled channel may still be given one.
    if (subject && !existing.subject) {
      return prisma.practicePatientThread.update({
        where: { id: existing.id },
        data: { subject },
      });
    }
    return existing;
  }

  try {
    return await prisma.practicePatientThread.create({
      data: {
        practicePatientLinkId: link.id,
        practiceProfileId: link.practiceProfileId,
        patientUserId: link.patientUserId,
        subject,
        status: "open",
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    if (err?.code === "P2002") {
      const raced = await prisma.practicePatientThread.findUnique({
        where: { practicePatientLinkId: link.id },
      });
      if (raced) return raced;
    }
    throw err;
  }
}

/**
 * Practice opens communication on a care relationship.
 *
 * Kept under its historical name because the route contract is unchanged, but
 * it no longer creates a thread per call: it resolves the single channel and
 * appends a message to it. Calling it twice yields one channel with two
 * messages, never two channels.
 *
 * @param {{ linkId: string, practiceProfileId: string, subject?: string, body: string, senderUserId: string }} input
 */
export async function createThread(input) {
  const link = await assertPracticeConsentedLink(
    input.linkId,
    input.practiceProfileId,
    { actorUserId: input.senderUserId, actorRole: "practice" },
  );

  const body = trimText(input.body, MAX_BODY_LEN);
  if (!body) throw new Error("validation_required");

  const channel = await ensureCommunicationChannel(link, { subject: input.subject });

  const { deduped } = await appendMessage({
    threadId: channel.id,
    senderType: "practice",
    senderUserId: input.senderUserId,
    body,
    clientRequestId: input.clientRequestId,
  });

  // A retry must be a no-op, not a repeat: touching the channel again would
  // bump it in every list, and notifying again would put a second entry in the
  // patient's inbox for a message they already have.
  const thread = deduped
    ? await loadThreadWithMessages(channel.id)
    : await reopenAndTouch(channel.id, "practice");

  if (!deduped) await notifyPatientInboxOfPracticeMessage(thread);
  return threadToJson(thread, { includeMessages: true, viewer: "practice" });
}

/**
 * Maximum length of a caller-supplied idempotency key. Long enough for a UUID
 * or a ULID, short enough that it can never become a smuggling channel.
 */
const MAX_CLIENT_REQUEST_ID_LEN = 64;

/**
 * Normalizes an idempotency key. Anything blank means "no key given", which
 * disables deduplication for that send rather than silently grouping unrelated
 * messages under an empty string.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeClientRequestId(value) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  if (v.length > MAX_CLIENT_REQUEST_ID_LEN) throw new Error("validation_text_too_long");
  return v;
}

/**
 * Appends ONE message to an already-authorized channel, at most once per
 * logical send action.
 *
 * This is deliberately a separate invariant from ensureCommunicationChannel():
 *
 *   channel  — one per PracticePatientLink, forever
 *   message  — one per (channel, clientRequestId)
 *
 * Retry safety rests on the unique index, not on a prior read: a retry that
 * arrives while the first insert is still in flight would pass any
 * check-then-insert. The loser gets P2002 and receives the message the winner
 * wrote, so the caller sees the same success either way.
 *
 * Without a key the old behaviour is kept exactly — every call appends.
 * Deduplication is by intent, never by content: the same text under a new key
 * is a new message.
 *
 * @param {{ threadId: string, senderType: "practice"|"patient"|"system", senderUserId?: string|null, body: string, clientRequestId?: string|null }} input
 * @returns {Promise<{ message: import("@prisma/client").PracticePatientMessage, deduped: boolean }>}
 */
export async function appendMessage(input) {
  const clientRequestId = normalizeClientRequestId(input.clientRequestId);

  const data = {
    threadId: input.threadId,
    senderType: input.senderType,
    senderUserId: input.senderUserId ?? null,
    body: input.body,
    clientRequestId,
  };

  if (!clientRequestId) {
    return { message: await prisma.practicePatientMessage.create({ data }), deduped: false };
  }

  try {
    return { message: await prisma.practicePatientMessage.create({ data }), deduped: false };
  } catch (err) {
    if (err?.code !== "P2002") throw err;
    const existing = await prisma.practicePatientMessage.findFirst({
      where: { threadId: input.threadId, clientRequestId },
    });
    if (!existing) throw err;
    return { message: existing, deduped: true };
  }
}

/**
 * Brings the channel back into the active view after new activity and returns it.
 *
 * `closed` and `archived` are view states, never locks: with one permanent
 * channel per relationship, a terminal state would end the ability to
 * communicate at all. New activity therefore always reopens.
 *
 * @param {string} threadId
 */
/**
 * Reads the channel with its messages WITHOUT changing anything — the read-only
 * counterpart of reopenAndTouch(), used when a send turned out to be a
 * deduplicated retry.
 *
 * @param {string} threadId
 */
/**
 * How many messages the first view of a conversation carries.
 *
 * The timeline used to load in full, which is fine for three messages and not
 * for a relationship that has run for two years. Older messages are fetched on
 * demand through listThreadMessagesPage().
 */
export const INITIAL_MESSAGE_PAGE_SIZE = 50;

/**
 * A thread with its NEWEST page of messages, in canonical order.
 *
 * Fetched newest-first and reversed for rendering: the page a reader opens on
 * is the cheap one, whatever the length of the history behind it.
 */
/**
 * Fills a thread row with its NEWEST page of messages.
 *
 * Every path that hands a thread to a client goes through here. Loading the
 * whole conversation was never a scoping fault — the rows were the right ones —
 * but a channel that has run for years is not a payload, and the client only
 * ever renders one page of it anyway.
 *
 * `hasMoreMessages` and `olderCursor` come from the same query as the page, so
 * "is there more" can never disagree with what was actually returned.
 */
async function attachNewestPage(row, limit = INITIAL_MESSAGE_PAGE_SIZE) {
  const newest = await prisma.practicePatientMessage.findMany({
    where: { threadId: row.id },
    orderBy: MESSAGE_ORDER_DESC,
    take: limit + 1,
  });
  const hasMore = newest.length > limit;
  const page = hasMore ? newest.slice(0, limit) : newest;

  row.messages = page.slice().reverse();
  row.hasMoreMessages = hasMore;
  row.olderCursor = page.length > 0 ? page[page.length - 1].id : null;
  return row;
}

async function loadThreadWithMessages(threadId, limit = INITIAL_MESSAGE_PAGE_SIZE) {
  const [thread, newest] = await Promise.all([
    prisma.practicePatientThread.findUnique({
      where: { id: threadId },
      include: { _count: { select: { messages: true } } },
    }),
    prisma.practicePatientMessage.findMany({
      where: { threadId },
      orderBy: MESSAGE_ORDER_DESC,
      take: limit + 1,
    }),
  ]);
  if (!thread) return null;

  const hasMore = newest.length > limit;
  const page = hasMore ? newest.slice(0, limit) : newest;

  thread.messages = page.slice().reverse();
  thread.hasMoreMessages = hasMore;
  thread.olderCursor = page.length > 0 ? page[page.length - 1].id : null;
  return thread;
}

async function reopenAndTouch(threadId, senderType) {
  // Each archive field is cleared by its OWN rule, never as a blanket action:
  //
  //   recipient's field — new content must never stay hidden in a list the
  //                       recipient archived; that would silently lose a message
  //                       and, for the practice, a work item.
  //   sender's field    — engaging with a conversation brings it back into your
  //                       own view. You just acted on it.
  //
  // The legacy shared `archivedAt` is deliberately NOT touched: it is evidence
  // of an old, unattributed archive and no longer steers anything.
  const data = {
    status: "open",
    closedAt: null,
    updatedAt: new Date(),
  };
  if (senderType === "patient" || senderType === "practice") {
    data.patientArchivedAt = null;
    data.practiceArchivedAt = null;
  }

  const row = await prisma.practicePatientThread.update({
    where: { id: threadId },
    data,
    include: {
      _count: { select: { messages: true } },
    },
  });
  return attachNewestPage(row);
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function listThreadsForPractice(linkId, practiceProfileId, opts = {}) {
  await assertPracticeConsentedLink(linkId, practiceProfileId, opts);
  const rows = await prisma.practicePatientThread.findMany({
    where: {
      practicePatientLinkId: linkId,
      practiceProfileId,
      // Practice list reads ONLY the practice column. A patient tidying their
      // own list can never remove a conversation from this work queue.
      ...(opts.includeArchived ? {} : { practiceArchivedAt: null }),
    },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const out = [];
  for (const r of rows) {
    const unreadCount = await countUnreadFrom(r.id, "patient");
    const withLast = {
      ...r,
      messages: r.messages?.length ? [r.messages[0]] : [],
    };
    out.push(threadToJson(withLast, { unreadCount, viewer: "practice" }));
  }
  return out;
}

/**
 * @param {string} patientUserId
 */
export async function listThreadsForPatient(patientUserId, opts = {}) {
  const uid = String(patientUserId || "").trim();
  if (!uid) throw new Error("validation_required");

  const rows = await prisma.practicePatientThread.findMany({
    where: {
      patientUserId: uid,
      // Patient list reads ONLY the patient column.
      ...(opts.includeArchived ? {} : { patientArchivedAt: null }),
    },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      practiceProfile: { select: PRACTICE_BRANDING_SELECT },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const out = [];
  for (const r of rows) {
    const unreadCount = await countUnreadFrom(r.id, "practice");
    const base = threadToJson(
      {
        ...r,
        messages: r.messages?.length ? [r.messages[0]] : [],
      },
      { unreadCount, viewer: "patient" },
    );
    out.push({
      ...base,
      practice: r.practiceProfile
        ? practiceFromProfile(r.practiceProfile)
        : null,
    });
  }
  return out;
}

/**
 * @param {string} threadId
 * @param {string} practiceProfileId
 * @param {string} linkId
 */
export async function getThread(threadId, practiceProfileId, linkId, ctx = {}) {
  await assertPracticeConsentedLink(linkId, practiceProfileId, ctx);
  const row = await getThreadForPractice(threadId, practiceProfileId, linkId);
  return threadToJson(row, {
    includeMessages: true,
    viewer: "practice",
    actorUserId: ctx.actorUserId ?? null,
    // The caller states it, because only the route knows whether the member
    // holds the permission to write in this conversation at all.
    writable: ctx.writable === true,
  });
}

/**
 * The ONE communication channel of one care relationship, for the patient who
 * owns that relationship — the read side of the Phase 2C practice context.
 *
 * Scoping: the caller supplies a linkId, never a practiceId or patientId. The
 * link is resolved against the SESSION's own user id, so a link belonging to
 * somebody else simply does not match and is reported as `link_not_found` —
 * indistinguishable from a link that does not exist, per the established
 * convention.
 *
 * READ-ONLY, in two senses:
 *   - it never marks anything read (Phase 1' C-3: acknowledgement is explicit),
 *   - it never CREATES the channel. A relationship without a conversation yet
 *     returns `channel: null`, which the UI shows as an empty state. Creating on
 *     GET would be exactly the kind of side effect this codebase removed.
 *
 * Consent: unchanged from Phase 1'. The patient is the data subject reading
 * their own communication, so no consent gate applies to this read; writing
 * still requires it (see addMessageFromPatient).
 *
 * @param {string} linkId
 * @param {string} patientUserId
 * @returns {Promise<{ link: object, channel: object | null }>}
 */
export async function getChannelForPatientLink(linkId, patientUserId) {
  const lid = String(linkId || "").trim();
  const uid = String(patientUserId || "").trim();
  if (!lid || !uid) throw new Error("validation_required");

  // Ownership decides, not a client-supplied tenant. The link must be THIS
  // patient's; the relationship state is returned so the caller can distinguish
  // "you may look" from "you may act" without a second round trip.
  const link = await prisma.practicePatientLink.findFirst({
    where: { id: lid, patientUserId: uid },
    include: includeLinkPractice,
  });
  if (!link) throw new Error("link_not_found");

  // One channel per link is a database invariant since Phase 2A, so this is a
  // unique lookup rather than a list — the API shape cannot drift back to many.
  const channelRow = await prisma.practicePatientThread.findUnique({
    where: { practicePatientLinkId: link.id },
    select: { id: true },
  });

  // Bounded, like every other entry point into a timeline: a relationship that
  // has run for years must not have to be transferred in full to be opened.
  const row = channelRow ? await loadThreadWithMessages(channelRow.id) : null;

  const unreadCount = row ? await countUnreadFrom(row.id, "practice") : 0;

  return {
    link: {
      id: link.id,
      status: link.status,
      practice: link.practiceProfile ? practiceFromProfile(link.practiceProfile) : null,
    },
    channel: row
      ? threadToJson(row, {
          includeMessages: true,
          unreadCount,
          viewer: "patient",
          actorUserId: uid,
          // "You may look" and "you may act" are different questions. Only an
          // active relationship still accepts a change to what was said in it.
          writable: LINK_ACTIVE.has(link.status),
        })
      : null,
  };
}

/**
 * @param {string} threadId
 * @param {string} patientUserId
 */
export async function getThreadForPatientUser(threadId, patientUserId, ctx = {}) {
  const row = await getThreadForPatient(threadId, patientUserId);
  return {
    ...threadToJson(row, {
      includeMessages: true,
      viewer: "patient",
      actorUserId: patientUserId,
      writable: ctx.writable === true,
    }),
    practice: row.practiceProfile
      ? practiceFromProfile(row.practiceProfile)
      : null,
  };
}

/**
 * @param {{ threadId: string, practiceProfileId: string, linkId: string, senderUserId: string, body: string }} input
 */
export async function addMessageFromPractice(input) {
  await assertPracticeConsentedLink(input.linkId, input.practiceProfileId, {
    actorUserId: input.senderUserId,
    actorRole: "practice",
  });

  const thread = await getThreadForPractice(
    input.threadId,
    input.practiceProfileId,
    input.linkId,
  );

  const body = trimText(input.body, MAX_BODY_LEN);
  if (!body) throw new Error("validation_required");

  const { deduped } = await appendMessage({
    threadId: thread.id,
    senderType: "practice",
    senderUserId: input.senderUserId,
    body,
    clientRequestId: input.clientRequestId,
  });

  // Writing reopens: see reopenAndTouch(). A closed or archived channel is put
  // away, not locked — with one channel per relationship a terminal state would
  // permanently end the ability to communicate. A deduplicated retry changes
  // nothing at all.
  const updated = deduped
    ? await loadThreadWithMessages(thread.id)
    : await reopenAndTouch(thread.id, "practice");

  if (!deduped) await notifyPatientInboxOfPracticeMessage(updated);
  // Reaching this line means the consent and permission gates above passed, so
  // the relationship demonstrably accepts writes from this actor.
  return threadToJson(updated, {
    includeMessages: true,
    viewer: "practice",
    actorUserId: input.senderUserId,
    writable: true,
  });
}

/**
 * @param {{ threadId: string, patientUserId: string, body: string }} input
 */
export async function addMessageFromPatient(input) {
  const thread = await getThreadForPatient(input.threadId, input.patientUserId);

  const link = await prisma.practicePatientLink.findUnique({
    where: { id: thread.practicePatientLinkId },
  });
  if (!link) throw new Error("consent_required");
  await requireConsentScopeAsync(link, "messages", {
    actorUserId: input.patientUserId,
    actorRole: "patient",
  });

  const body = trimText(input.body, MAX_BODY_LEN);
  if (!body) throw new Error("validation_required");

  const { deduped } = await appendMessage({
    threadId: thread.id,
    senderType: "patient",
    senderUserId: input.patientUserId,
    body,
    clientRequestId: input.clientRequestId,
  });

  // Writing reopens — same rule as the practice side. A deduplicated retry
  // changes nothing and raises no second notification.
  const updated = deduped
    ? await loadThreadWithMessages(thread.id)
    : await reopenAndTouch(thread.id, "patient");

  if (!deduped) await notifyPracticeInboxOfPatientMessage(updated);

  return {
    ...threadToJson(updated, {
      includeMessages: true,
      viewer: "patient",
      actorUserId: input.patientUserId,
      writable: true,
    }),
    practice: thread.practiceProfile
      ? practiceFromProfile(thread.practiceProfile)
      : null,
  };
}

/**
 * Mark messages from the other party as read.
 * @param {string} threadId
 * @param {"practice" | "patient"} viewer
 * @param {{ practiceProfileId?: string, linkId?: string, patientUserId?: string }} scope
 */
/**
 * Resolves a caller-supplied message id to a position in THIS thread.
 *
 * Returns null when no boundary was given. Throws when the id names a message
 * that is not in this thread — silently ignoring it would turn a foreign id
 * into a whole-thread acknowledgement, which is the failure this exists to
 * prevent.
 *
 * @param {string} threadId
 * @param {unknown} throughMessageId
 */
async function resolveReadBoundary(threadId, throughMessageId) {
  const id = String(throughMessageId ?? "").trim();
  if (!id) return null;

  const at = await prisma.practicePatientMessage.findFirst({
    where: { id, threadId },
    select: { id: true, createdAt: true },
  });
  if (!at) throw new Error("message_not_in_thread");
  return at;
}

/**
 * One page of a conversation, newest-last, bounded.
 *
 * Cursor pagination rather than offset: a conversation grows at the end while
 * it is being read, and an offset would shift under the reader and duplicate or
 * skip messages. The cursor is a position in the canonical order, so it stays
 * correct however many messages arrive in between.
 *
 * `before` names the OLDEST message already held by the caller; the page
 * returned is the one immediately older than it.
 *
 * @param {string} threadId a thread the caller is already authorized for
 * @param {{ before?: string | null, limit?: number }} [opts]
 */
export async function listThreadMessagesPage(threadId, opts = {}) {
  // A missing, unparseable or non-positive limit means "use the default".
  // Clamping a negative to 1 would technically be bounded and would also hand
  // back a single message to a caller that asked for nonsense.
  const requested = Number(opts.limit);
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.min(100, Math.floor(requested))
      : INITIAL_MESSAGE_PAGE_SIZE;

  const cursor = opts.before
    ? await prisma.practicePatientMessage.findFirst({
        where: { id: String(opts.before).trim(), threadId },
        select: { id: true, createdAt: true },
      })
    : null;
  if (opts.before && !cursor) throw new Error("message_not_in_thread");

  // One row more than asked for, so "is there more" is answered by the same
  // query instead of a second count that could disagree with it.
  const rows = await prisma.practicePatientMessage.findMany({
    where: {
      threadId,
      ...(cursor ? { OR: messagesBeforeWhere(cursor) } : {}),
    },
    orderBy: MESSAGE_ORDER_DESC,
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    // Rendered oldest-first; fetched newest-first so the newest page is the
    // cheap one.
    messages: page.slice().reverse().map((m) => messageToJson(m, opts.ctx ?? {})),
    // The oldest message on this page: pass it back as `before` for the next.
    olderCursor: page.length > 0 ? page[page.length - 1].id : null,
    hasMore,
    limit,
  };
}

/* ==================================== Editing and withdrawing (Phase 3B) */

/**
 * Drops any stored translation of a message that has just changed.
 *
 * Imported lazily so the messaging service does not take a hard dependency on
 * the translation feature: a deployment that never enables it still loads this
 * module, and a failure here must never turn a completed edit into an error.
 * The guarantee that a withdrawn message cannot be read through a translation
 * does not rest on this — the translation lookup refuses a withdrawn message on
 * its own. This is about not keeping the copy.
 *
 * @param {string} messageId
 */
async function forgetTranslationsOf(messageId) {
  try {
    const { purgeMessageTranslations } = await import(
      "../messageTranslation/messageTranslationService.js"
    );
    await purgeMessageTranslations(messageId);
  } catch (err) {
    console.error("[messaging/forgetTranslations]", err?.message ?? err);
  }
}

/**
 * Does the relationship behind this thread still accept writes?
 *
 * Reading a conversation and changing what was said in it are different rights.
 * A relationship that has ended stays readable — the history does not vanish —
 * but nothing in it may be rewritten, so the capability has to ask the link,
 * not the thread.
 *
 * @param {{ practicePatientLinkId: string }} thread
 */
async function relationshipAcceptsWrites(thread) {
  const link = await prisma.practicePatientLink.findUnique({
    where: { id: thread.practicePatientLinkId },
    select: { status: true },
  });
  return Boolean(link && LINK_ACTIVE.has(link.status));
}

/**
 * Whether a relationship in this state still accepts writes.
 *
 * Exported so routes answer the capability question with the SAME set the
 * mutation condition uses; two lists that drift apart would show controls that
 * the server then refuses.
 */
export function relationshipIsWritable(status) {
  return LINK_ACTIVE.has(String(status || ""));
}

/**
 * One message as its own sender may see it — used by the edit and withdraw
 * routes, which answer with a single message rather than a whole thread.
 */
export function messageForViewer(msg, ctx) {
  return messageToJson(msg, ctx);
}

/**
 * Whether a message may still be changed is decided by ONE query.
 *
 * A read is a write on the recipient's side, and it can land at any moment. So
 * "check, then change" is not a rule here — between the check and the change
 * the recipient may have read the message, and the change would then be made
 * against a fact that is no longer true. Every condition therefore lives in the
 * WHERE clause of the mutation itself, and the database decides in one
 * statement:
 *
 *   - `id` + `threadId`  — the message belongs to THIS authorized conversation
 *   - `senderType`       — the actor's party wrote it
 *   - `senderUserId`     — and this exact person did
 *   - `readAt: null`     — the other side has not read it
 *   - `withdrawnAt: null`— it has not already been withdrawn
 *
 * If the recipient's read commits first, the update matches nothing and loses.
 * That is the intended outcome: the read wins, never the mutation.
 *
 * @param {object} where the full condition, already assembled by the caller
 * @param {object} data what to change
 * @returns {Promise<number>} how many rows the database actually changed
 */
async function mutateMessageIfStillMutable(where, data) {
  const { count } = await prisma.practicePatientMessage.updateMany({ where, data });
  return count;
}

/**
 * Explains a refusal WITHOUT having decided it.
 *
 * The decision was already made by the update above; this only reads back the
 * actor's own message to say why nothing changed. It is scoped to messages the
 * actor actually sent, so a message belonging to someone else — or to another
 * conversation — is indistinguishable from one that does not exist, and no
 * "already read" is ever disclosed about a stranger's message.
 */
async function explainMessageRefusal(scopeWhere) {
  const own = await prisma.practicePatientMessage.findFirst({
    where: scopeWhere,
    select: { id: true, readAt: true, withdrawnAt: true },
  });
  if (!own) return new Error("message_not_found");
  if (own.withdrawnAt) return new Error("message_withdrawn");
  if (own.readAt) return new Error("message_already_read");
  // Nothing left to explain: the row is mutable now, so it changed between the
  // update and this read. Treating that as "already read" would be a guess.
  return new Error("message_not_mutable");
}

/**
 * The identity half of the condition — who is allowed to touch this row at all.
 */
function ownMessageWhere(threadId, messageId, actor) {
  return {
    id: String(messageId || "").trim(),
    threadId,
    senderType: actor.senderType,
    senderUserId: actor.senderUserId,
  };
}

/**
 * The relationship half — folded into the SAME statement.
 *
 * Editing and withdrawing are writes, and the existing policy is that an ended
 * relationship stays readable but accepts no writes. That policy is enforced by
 * the consent gate the callers already run; repeating its state here as a
 * condition of the update means a relationship that ends mid-request cannot be
 * written to either. No new rule, one more thing that cannot slip through.
 */
const ACTIVE_RELATIONSHIP_WHERE = {
  thread: { is: { practicePatientLink: { is: { status: { in: [...LINK_ACTIVE] } } } } },
};

/**
 * Runs the caller's existing write gate before a message mutation.
 *
 * Deliberately the SAME gate that sending goes through: whoever may not write a
 * new message in this conversation may not rewrite an old one either. No second
 * consent rule is defined here.
 */
async function assertMayMutateMessages(threadId, ctx) {
  const thread = await prisma.practicePatientThread.findUnique({
    where: { id: threadId },
    select: { practicePatientLinkId: true },
  });
  if (!thread) throw new Error("thread_not_found");
  const link = await prisma.practicePatientLink.findUnique({
    where: { id: thread.practicePatientLinkId },
  });
  if (!link) throw new Error("link_not_found");
  await requireConsentScopeAsync(link, "messages", ctx);
}

/**
 * Replaces the text of one's own message while it is still unread.
 *
 * The message keeps its id, its `createdAt` and its `clientRequestId`: it is the
 * same message with different words, not a new one. Nothing is appended to the
 * conversation, so cursors stay valid and the message does not move.
 *
 * The previous text is overwritten. No version of it is kept anywhere — there is
 * no history table in this phase, and message bodies are never written to the
 * audit log.
 *
 * @param {{ threadId: string, messageId: string, actor: { senderType: "patient"|"practice", senderUserId: string }, body: string }} input
 */
export async function editMessage(input) {
  await assertMayMutateMessages(input.threadId, input.ctx ?? {});

  const body = trimText(input.body, MAX_BODY_LEN);
  // An edit down to nothing is not an edit. Removing a message is what
  // withdrawing is for, and it leaves a visible trace instead of a blank line.
  if (!body) throw new Error("validation_required");

  const scope = ownMessageWhere(input.threadId, input.messageId, input.actor);
  const changed = await mutateMessageIfStillMutable(
    { ...scope, readAt: null, withdrawnAt: null, ...ACTIVE_RELATIONSHIP_WHERE },
    { body, editedAt: new Date() },
  );
  if (changed !== 1) throw await explainMessageRefusal(scope);
  // A translation is a translation OF a particular wording. Once the wording
  // has changed, every stored one describes text nobody can see any more.
  await forgetTranslationsOf(scope.id);

  return prisma.practicePatientMessage.findUnique({ where: { id: scope.id } });
}

/**
 * Withdraws one's own message while it is still unread.
 *
 * The row survives as a timeline event — a message id that simply vanished
 * would tear a hole in a conversation someone has already paginated through,
 * and the other side would be left wondering what disappeared. What does not
 * survive is the text: `body` is cleared in the same statement that sets
 * `withdrawnAt`.
 *
 * This is removal from the conversation, not erasure from the system: the row,
 * its timestamps and its authorship remain. It is also final — nothing here can
 * bring the text back, and a second withdrawal is refused rather than treated
 * as a fresh one.
 *
 * `readAt` is deliberately left alone. Withdrawing is not reading, and marking
 * it read to tidy the state would put a false fact in the record.
 */
export async function withdrawMessage(input) {
  await assertMayMutateMessages(input.threadId, input.ctx ?? {});

  const scope = ownMessageWhere(input.threadId, input.messageId, input.actor);
  const changed = await mutateMessageIfStillMutable(
    { ...scope, readAt: null, withdrawnAt: null, ...ACTIVE_RELATIONSHIP_WHERE },
    { body: "", withdrawnAt: new Date() },
  );
  if (changed !== 1) throw await explainMessageRefusal(scope);
  // The body was just cleared; a stored translation of it would be the same
  // sentence in another language, sitting in a table.
  await forgetTranslationsOf(scope.id);

  return prisma.practicePatientMessage.findUnique({ where: { id: scope.id } });
}

export async function markThreadRead(threadId, viewer, scope) {
  let thread;
  if (viewer === "practice") {
    await assertPracticeConsentedLink(scope.linkId, scope.practiceProfileId, scope);
    thread = await getThreadForPractice(
      threadId,
      scope.practiceProfileId,
      scope.linkId,
    );
  } else {
    thread = await getThreadForPatient(threadId, scope.patientUserId);
  }

  // Carried into the answer so the timeline the client re-renders keeps its
  // per-message capabilities instead of silently losing them on every read.
  const answerCtx = {
    viewer,
    actorUserId: viewer === "practice" ? scope.actorUserId ?? null : scope.patientUserId,
    writable: await relationshipAcceptsWrites(thread),
  };

  const otherSender = viewer === "practice" ? "patient" : "practice";
  const now = new Date();

  /*
   * The acknowledgement is BOUNDED (Phase 3A).
   *
   * It used to mark every unread incoming message in the thread. That was
   * indistinguishable from a thread-level read state and it had a real race: a
   * message arriving between the client rendering the timeline and the
   * acknowledgement reaching the server was marked read although nobody had
   * seen it. Once "edit only while unread" exists, that race silently closes
   * the sender's window.
   *
   * The caller therefore names the last message it actually displayed, and only
   * messages up to and including that point are marked. The boundary is
   * resolved against THIS thread, so an id from another conversation cannot
   * move any read state — it simply does not resolve.
   *
   * Omitting the boundary keeps the old whole-thread behaviour, which the
   * practice inbox and the older clients still rely on.
   */
  const boundary = await resolveReadBoundary(thread.id, scope?.throughMessageId);

  // Idempotent and atomic by construction: the `readAt: null` predicate is part
  // of the UPDATE, so a repeated or concurrent acknowledgement neither
  // overwrites the original timestamp nor needs a read-then-write round trip.
  // This is the same conditional-update shape that a later
  // "edit/withdraw only while unread" rule will use, from the other side.
  await prisma.practicePatientMessage.updateMany({
    where: {
      threadId: thread.id,
      // Never the viewer's own messages: reading your own text is not a receipt.
      senderType: otherSender,
      readAt: null,
      ...(boundary ? { OR: messagesUpToWhere(boundary) } : {}),
    },
    data: { readAt: now },
  });

  if (viewer === "practice") {
    return getThread(threadId, scope.practiceProfileId, scope.linkId, {
      ...scope,
      writable: answerCtx.writable && scope.writable === true,
    });
  }
  return getThreadForPatientUser(threadId, scope.patientUserId, {
    writable: answerCtx.writable,
  });
}

/**
 * @param {string} threadId
 * @param {string} practiceProfileId
 * @param {string} linkId
 */
export async function closeThread(threadId, practiceProfileId, linkId, ctx = {}) {
  await assertPracticeConsentedLink(linkId, practiceProfileId, ctx);
  const existing = await getThreadForPractice(threadId, practiceProfileId, linkId);
  if (existing.status === "archived") throw new Error("thread_archived");

  const now = new Date();
  const row = await prisma.practicePatientThread.update({
    where: { id: threadId },
    data: {
      status: "closed",
      closedAt: existing.closedAt || now,
      updatedAt: now,
    },
    include: {
      _count: { select: { messages: true } },
    },
  });
  await attachNewestPage(row);
  return threadToJson(row, { includeMessages: true, viewer: "practice" });
}

/**
 * @param {string} threadId
 * @param {string} practiceProfileId
 * @param {string} linkId
 */
export async function archiveThreadForPractice(threadId, practiceProfileId, linkId, ctx = {}) {
  await assertPracticeConsentedLink(linkId, practiceProfileId, ctx);
  const existing = await getThreadForPractice(threadId, practiceProfileId, linkId);
  // Only the practice column. `status`, `patientArchivedAt` and the legacy
  // `archivedAt` are untouched — the patient's view is none of this action's
  // business, and `updatedAt` is not bumped either, because archiving is a view
  // preference and must not re-sort the other side's list.
  const row = await prisma.practicePatientThread.update({
    where: { id: existing.id },
    data: { practiceArchivedAt: new Date() },
    include: {
      _count: { select: { messages: true } },
    },
  });
  await attachNewestPage(row);
  return threadToJson(row, { includeMessages: true, viewer: "practice" });
}

/**
 * @param {string} threadId
 * @param {string} practiceProfileId
 * @param {string} linkId
 */
export async function restoreThreadForPractice(threadId, practiceProfileId, linkId, ctx = {}) {
  await assertPracticeConsentedLink(linkId, practiceProfileId, ctx);
  const existing = await getThreadForPractice(threadId, practiceProfileId, linkId);
  if (!existing.practiceArchivedAt) throw new Error("thread_not_archived");
  const row = await prisma.practicePatientThread.update({
    where: { id: existing.id },
    data: { practiceArchivedAt: null },
    include: {
      _count: { select: { messages: true } },
    },
  });
  await attachNewestPage(row);
  return threadToJson(row, { includeMessages: true, viewer: "practice" });
}

/**
 * @param {string} threadId
 * @param {string} patientUserId
 */
export async function archiveThreadForPatient(threadId, patientUserId) {
  const existing = await getThreadForPatient(threadId, patientUserId);
  // Only the patient column — the practice's work queue is untouched.
  const row = await prisma.practicePatientThread.update({
    where: { id: existing.id },
    data: { patientArchivedAt: new Date() },
    include: {
      practiceProfile: { select: PRACTICE_BRANDING_SELECT },
      _count: { select: { messages: true } },
    },
  });
  await attachNewestPage(row);
  return {
    ...threadToJson(row, { includeMessages: true, viewer: "patient" }),
    practice: row.practiceProfile
      ? practiceFromProfile(row.practiceProfile)
      : null,
  };
}

/**
 * @param {string} threadId
 * @param {string} patientUserId
 */
export async function restoreThreadForPatient(threadId, patientUserId) {
  const existing = await getThreadForPatient(threadId, patientUserId);
  if (!existing.patientArchivedAt) throw new Error("thread_not_archived");
  const row = await prisma.practicePatientThread.update({
    where: { id: existing.id },
    data: { patientArchivedAt: null },
    include: {
      practiceProfile: { select: PRACTICE_BRANDING_SELECT },
      _count: { select: { messages: true } },
    },
  });
  await attachNewestPage(row);
  return {
    ...threadToJson(row, { includeMessages: true, viewer: "patient" }),
    practice: row.practiceProfile
      ? practiceFromProfile(row.practiceProfile)
      : null,
  };
}
