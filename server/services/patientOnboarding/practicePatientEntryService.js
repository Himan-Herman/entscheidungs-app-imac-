/**
 * Practice-local patient records.
 *
 * A PracticePatientEntry is what a practice knows about someone BEFORE that
 * person has a MedScoutX account. It is owned entirely by the practice, carries
 * no account reference until an invitation is redeemed, and is never an
 * authorization subject: nothing here grants access to anything. Patient data
 * continues to be reachable only through PracticePatientLink.
 *
 * Two rules run through the whole file:
 *
 *   practiceProfileId is never taken from the caller's payload. Every read and
 *   every write is scoped by the practice the request was already authorized
 *   for, and an entry belonging to another practice is reported exactly like one
 *   that does not exist — so an id cannot be used to probe for it.
 *
 *   Nothing here looks a person up globally. No user lookup, no e-mail match, no
 *   cross-tenant search. That is what keeps a practice from learning whether an
 *   account exists, and it is why the duplicate check below is deliberately
 *   confined to the practice's own rows.
 */
import { prisma } from "../../lib/prisma.js";
import { writeRequiredAuditLog } from "../auditLogService.js";

/** Practice-local entry states. */
export const ENTRY_STATUSES = new Set(["draft", "invited", "linked", "archived"]);

/** Entry states in which a new invitation may be issued. */
export const INVITABLE_ENTRY_STATUSES = new Set(["draft", "invited"]);

/**
 * How many of the practice's own entries the duplicate check will look at.
 *
 * The comparison happens in JavaScript because it needs Unicode folding that no
 * plain index can express, so it has to be bounded. When the cap bites, the
 * result says so rather than quietly returning a short list — a duplicate
 * warning that silently stopped looking would be worse than none, because it
 * reads as "no duplicates found".
 */
const DUPLICATE_SCAN_CAP = 1000;

const MAX = { name: 120, email: 255, phone: 40, record: 64 };

/** @param {unknown} v @param {number} max */
function text(v, max) {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s || null;
}

/** Lowercase, collapse hyphens/apostrophes/whitespace. Shared by both foldings. */
function baseFold(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[-'’\s]+/g, " ")
    .trim();
}

/**
 * Fold a name for COMPARISON only. Never stored, never an identity.
 *
 * The German transliteration: `Müller` → `mueller`, so it meets a `Mueller`
 * somebody typed on a keyboard without umlauts. This is the primary form.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function normalizeNameForComparison(value) {
  return baseFold(value)
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

/**
 * EVERY form a name could plausibly have been typed in, as a set.
 *
 * One folding is not enough, because the two common ways of writing an umlaut
 * without an umlaut key pull in opposite directions:
 *
 *   Müller  →  "mueller"   (transliterated, the German convention)
 *   Müller  →  "muller"    (diacritic simply dropped, what most software does)
 *
 * Collapsing to either one alone silently loses the other half of the real
 * duplicates: normalise to `mueller` and a `Muller` in the system never
 * surfaces; normalise to `muller` and a `Mueller` never does. Since a match is
 * only ever a hint for a human, comparing SETS and accepting any overlap is
 * strictly better than picking a winner — the cost of an extra hint is a
 * glance, the cost of a missed one is a duplicated patient record.
 *
 * @param {string | null | undefined} value
 * @returns {Set<string>}
 */
export function nameComparisonKeys(value) {
  const transliterated = normalizeNameForComparison(value);
  const stripped = baseFold(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss");
  return new Set([transliterated, stripped].filter(Boolean));
}

/** Do two names share any plausible spelling? */
function namesOverlap(a, b) {
  for (const key of a) if (b.has(key)) return true;
  return false;
}

/** @param {Date|string|null|undefined} d */
function dayKey(d) {
  if (!d) return null;
  const v = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(v.getTime())) return null;
  return v.toISOString().slice(0, 10);
}

/**
 * Entries in THIS practice that might be the same person.
 *
 * A hint for the person at the desk, never a constraint and never a merge. Two
 * children of one family can legitimately share a surname and a birthday, so the
 * decision belongs to someone who knows them.
 *
 * @param {{ practiceProfileId: string, givenName?: string|null, familyName?: string|null, dateOfBirth?: Date|string|null, excludeEntryId?: string|null, client?: object }} input
 * @returns {Promise<{ matches: Array<object>, scanned: number, capped: boolean }>}
 */
export async function findPossibleDuplicates(input) {
  const db = input.client ?? prisma;
  const practiceProfileId = String(input.practiceProfileId || "").trim();
  if (!practiceProfileId) throw new Error("validation_required");

  const given = nameComparisonKeys(input.givenName);
  const family = nameComparisonKeys(input.familyName);
  if (family.size === 0 && given.size === 0) return { matches: [], scanned: 0, capped: false };

  const candidates = await db.practicePatientEntry.findMany({
    where: {
      practiceProfileId,
      status: { not: "archived" },
      ...(input.excludeEntryId ? { id: { not: input.excludeEntryId } } : {}),
    },
    select: {
      id: true, givenName: true, familyName: true, dateOfBirth: true,
      status: true, practiceRecordNumber: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: DUPLICATE_SCAN_CAP,
  });

  const dob = dayKey(input.dateOfBirth);
  const matches = [];

  for (const c of candidates) {
    if (!namesOverlap(nameComparisonKeys(c.familyName), family)) continue;

    const cDob = dayKey(c.dateOfBirth);
    // Both dates known and different -> different people. Say so and move on.
    if (dob && cDob && dob !== cDob) continue;

    // Same surname AND same given name is the strong signal. A surname alone is
    // only worth mentioning when a birthday backs it up.
    const sameGiven = namesOverlap(nameComparisonKeys(c.givenName), given);
    const dobAgrees = Boolean(dob && cDob && dob === cDob);
    if (!sameGiven && !dobAgrees) continue;

    matches.push({
      id: c.id,
      givenName: c.givenName,
      familyName: c.familyName,
      dateOfBirth: c.dateOfBirth,
      status: c.status,
      practiceRecordNumber: c.practiceRecordNumber,
      reason: sameGiven && dobAgrees ? "name_and_date_of_birth"
            : sameGiven ? "name"
            : "surname_and_date_of_birth",
    });
  }

  return {
    matches,
    scanned: candidates.length,
    capped: candidates.length === DUPLICATE_SCAN_CAP,
  };
}

/** Practice-facing shape. Contains only what the practice itself entered. */
export function entryToJson(row) {
  return {
    id: row.id,
    givenName: row.givenName,
    familyName: row.familyName,
    dateOfBirth: row.dateOfBirth,
    email: row.email,
    phone: row.phone,
    practiceRecordNumber: row.practiceRecordNumber,
    status: row.status,
    linkedAt: row.linkedAt,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // The link id is deliberately absent: a practice reaches patient data
    // through the existing authorization chain, never through this record.
    isLinked: Boolean(row.linkedAt),
  };
}

/**
 * Create a practice-local record. Creates NOTHING else — no invitation, no link,
 * no account lookup.
 *
 * @param {{ practiceProfileId: string, createdByUserId?: string|null,
 *           givenName: string, familyName: string, dateOfBirth?: string|Date|null,
 *           email?: string|null, phone?: string|null, practiceRecordNumber?: string|null,
 *           req?: import('express').Request }} input
 */
export async function createPracticePatientEntry(input) {
  const practiceProfileId = String(input.practiceProfileId || "").trim();
  if (!practiceProfileId) throw new Error("validation_required");

  const givenName = text(input.givenName, MAX.name);
  const familyName = text(input.familyName, MAX.name);
  if (!givenName || !familyName) throw new Error("validation_name_required");

  let dateOfBirth = null;
  if (input.dateOfBirth) {
    const d = new Date(input.dateOfBirth);
    if (Number.isNaN(d.getTime())) throw new Error("validation_invalid_date");
    dateOfBirth = d;
  }

  // A delivery address, not an identifier: not unique, never looked up, and the
  // entry has to work entirely without it.
  const email = text(input.email, MAX.email)?.toLowerCase() ?? null;
  if (email && !email.includes("@")) throw new Error("validation_invalid_email");

  const practice = await prisma.practiceProfile.findUnique({
    where: { id: practiceProfileId },
    select: { id: true, isActive: true },
  });
  if (!practice) throw new Error("practice_not_found");

  const duplicates = await findPossibleDuplicates({
    practiceProfileId, givenName, familyName, dateOfBirth,
  });

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.practicePatientEntry.create({
      data: {
        practiceProfileId,
        givenName,
        familyName,
        dateOfBirth,
        email,
        phone: text(input.phone, MAX.phone),
        practiceRecordNumber: text(input.practiceRecordNumber, MAX.record),
        status: "draft",
        createdByUserId: input.createdByUserId ?? null,
      },
    });

    // What was recorded, never what it says: no name, no date of birth, no
    // e-mail. Only whether the optional fields were supplied at all.
    await writeRequiredAuditLog(
      {
        req: input.req,
        userId: input.createdByUserId ?? null,
        actorRole: "practice",
        action: "practice_patient_entry_created",
        entityType: "PracticePatientEntry",
        entityId: row.id,
        practiceProfileId,
        metadata: {
          hasDateOfBirth: Boolean(dateOfBirth),
          hasEmail: Boolean(email),
          possibleDuplicateCount: duplicates.matches.length,
        },
      },
      tx,
    );

    return row;
  });

  /*
   * A COUNT, never the candidates.
   *
   * The list was the obvious thing to return — the person at the desk wants to
   * see who it might be — and it is the wrong thing. It would hand back names,
   * birthdays and entry ids of OTHER people as a side effect of typing a name
   * that happens to be similar, turning a create call into a search over the
   * practice's own patient records.
   *
   * And the count says only what it can support: "there is a similar local
   * entry", never "this is the same person". Nothing is merged, nothing is
   * blocked, and the practice reaches the actual records the same way as always
   * — through the list endpoint, which is permission-checked in its own right.
   */
  return {
    entry: entryToJson(created),
    possibleDuplicateCount: duplicates.matches.length,
    duplicateScanCapped: duplicates.capped,
  };
}

/**
 * One entry, scoped to the authorized practice in the SAME query.
 *
 * Not "load then check": a two-step version leaks existence through timing and
 * invites a later refactor that forgets the second step. Missing and
 * not-yours are the same answer.
 *
 * @param {string} entryId
 * @param {string} practiceProfileId
 */
export async function getPracticePatientEntry(entryId, practiceProfileId) {
  const id = String(entryId || "").trim();
  const pid = String(practiceProfileId || "").trim();
  if (!id || !pid) throw new Error("validation_required");

  const row = await prisma.practicePatientEntry.findFirst({
    where: { id, practiceProfileId: pid },
  });
  if (!row) throw new Error("entry_not_found");
  return entryToJson(row);
}

/**
 * @param {string} practiceProfileId
 * @param {{ status?: string, q?: string, limit?: number, offset?: number, includeArchived?: boolean }} [opts]
 */
export async function listPracticePatientEntries(practiceProfileId, opts = {}) {
  const pid = String(practiceProfileId || "").trim();
  if (!pid) throw new Error("validation_required");

  const status = ENTRY_STATUSES.has(opts.status) ? opts.status : undefined;
  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 50));
  const offset = Math.max(0, Number(opts.offset) || 0);
  const q = text(opts.q, 120);

  const where = {
    practiceProfileId: pid,
    ...(status ? { status } : opts.includeArchived ? {} : { status: { not: "archived" } }),
    ...(q
      ? {
          OR: [
            { familyName: { contains: q, mode: "insensitive" } },
            { givenName: { contains: q, mode: "insensitive" } },
            { practiceRecordNumber: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.practicePatientEntry.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.practicePatientEntry.count({ where }),
  ]);

  return { entries: rows.map(entryToJson), total, limit, offset };
}

/**
 * Archive an entry.
 *
 * There is no delete here, and that is the point. `linkedAt` is set once a claim
 * succeeded and never cleared, so an entry that was ever a care relationship
 * stays provable even after the link row itself went away with the patient's
 * account. Archiving keeps the record and its audit trail; deleting would
 * destroy both.
 *
 * Entries that were NEVER linked are a different question — the rules for those
 * are still an open product and legal decision, so this file deliberately offers
 * no hard delete for them either. A UI label saying "remove" is not a mandate to
 * erase.
 *
 * @param {{ entryId: string, practiceProfileId: string, actorUserId?: string|null, req?: import('express').Request }} input
 */
export async function archivePracticePatientEntry(input) {
  const id = String(input.entryId || "").trim();
  const pid = String(input.practiceProfileId || "").trim();
  if (!id || !pid) throw new Error("validation_required");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.practicePatientEntry.findFirst({
      where: { id, practiceProfileId: pid },
    });
    if (!existing) throw new Error("entry_not_found");
    if (existing.status === "archived") throw new Error("entry_already_archived");

    const now = new Date();

    // Archiving ends the invitation too: leaving a live credential pointing at a
    // shelved record would let someone still connect to it.
    await tx.practicePatientInvitation.updateMany({
      where: { practicePatientEntryId: id, status: "pending" },
      data: { status: "revoked", revokedAt: now, revokedByUserId: input.actorUserId ?? null },
    });

    const row = await tx.practicePatientEntry.update({
      where: { id },
      data: { status: "archived", archivedAt: now, updatedAt: now },
    });

    await writeRequiredAuditLog(
      {
        req: input.req,
        userId: input.actorUserId ?? null,
        actorRole: "practice",
        action: "practice_patient_entry_archived",
        entityType: "PracticePatientEntry",
        entityId: id,
        practiceProfileId: pid,
        metadata: { previousStatus: existing.status, wasLinked: Boolean(existing.linkedAt) },
      },
      tx,
    );

    return entryToJson(row);
  });
}
