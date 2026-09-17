/**
 * Consent must fail CLOSED.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE INVARIANT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   No active (granted) ConsentRecord for a consent type
 *     ->  that type is NOT permitted on that link. No exception.
 *
 * Two historical mechanisms used to break this, and both are what this file
 * exists to hold shut:
 *
 *   1. A legacy fallback in `linkHasConsentType()` treated an empty
 *      `consentScopes` array as "the original three scopes" — so a link whose
 *      consents had all been WITHDRAWN still granted profile_access,
 *      medication_plan_access and secure_messaging, because withdrawing the
 *      last consent leaves exactly that state: `consentScopes: []` with a
 *      historical `consentAcceptedAt` that is never cleared.
 *
 *   2. `backfillConsentRecordsFromLink()` re-created GRANTED records for those
 *      same three types whenever the newest record was not granted — so merely
 *      OPENING the consent overview (a GET, by either side) undid a withdrawal
 *      and recorded the resurrection as `grantedByUserId = patientUserId`.
 *
 * Neither is a scenario a test can reach by accident, which is precisely why
 * they survived: every path into them looks like ordinary reading. The cases
 * below therefore assert on the two things a reader cannot see — what the gate
 * answers, and whether a read left a new grant behind.
 *
 * Runs WITHOUT a database: the shared Prisma singleton is replaced by an
 * in-memory fake, the same technique used by verifyPracticeTenantIsolation.
 * The real code path executes end to end, up to and including
 * authorizePracticePatientLink().
 */
import test from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../lib/prisma.js";
import {
  linkHasConsentType,
  backfillConsentRecordsFromLink,
  listPatientConsents,
  listPracticeLinkConsents,
} from "../services/consent/consentRecordService.js";
import { linkHasConsentScope } from "../services/careRelationship/consentScopes.js";
import { authorizePracticePatientLink } from "../services/authorization/practicePatientLinkAuthorization.js";
import { PERMISSIONS } from "../utils/practicePermissions.js";

/* ------------------------------------------------------------------ fixture */

const LINK_ID = "link-fc";
const PRACTICE = "practice-fc";
const PATIENT = "user-patient-fc";
const DOCTOR = "user-doctor-fc";
const OWNER = "user-owner-fc";

/** The three types the removed legacy fallback used to hand out for free. */
const LEGACY_TRIPLE = ["profile_access", "medication_plan_access", "secure_messaging"];

/** Everything a practice can be gated on, so a fallback cannot hide in the tail. */
const ALL_TYPES = [
  ...LEGACY_TRIPLE,
  "document_sharing",
  "vitals_access",
  "vaccinations_access",
  "health_history_access",
  "prescriptions_access",
  "data_export",
  "optional_secure_links",
];

let links = [];
let consents = [];
let created = [];
let seq = 0;

/**
 * @param {{ consentScopes?: unknown, consentAcceptedAt?: Date | null, status?: string,
 *           records?: Array<{ consentType: string, status: string, createdAt?: Date }> }} opts
 */
function install(opts = {}) {
  seq = 0;
  created = [];

  links = [
    {
      id: LINK_ID,
      practiceProfileId: PRACTICE,
      patientUserId: PATIENT,
      status: opts.status ?? "active",
      consentAcceptedAt:
        opts.consentAcceptedAt === undefined ? new Date("2026-01-01") : opts.consentAcceptedAt,
      consentScopes: opts.consentScopes === undefined ? [] : opts.consentScopes,
      consentVersion: "phase1-care-v1",
      profileAccessGrantedAt: null,
      profileAccessRevokedAt: null,
    },
  ];

  consents = (opts.records ?? []).map((r, i) => ({
    id: `cr-${i}`,
    patientUserId: PATIENT,
    practiceProfileId: PRACTICE,
    practicePatientLinkId: LINK_ID,
    consentType: r.consentType,
    status: r.status,
    grantedAt: r.createdAt ?? new Date("2026-01-01"),
    revokedAt: r.status === "revoked" ? new Date("2026-02-01") : null,
    expiresAt: null,
    version: "phase1-care-v1",
    createdAt: r.createdAt ?? new Date("2026-01-01"),
    updatedAt: r.createdAt ?? new Date("2026-01-01"),
  }));

  const link = () => links[0];

  /** Only the predicates the service actually issues. */
  function matches(row, where = {}) {
    if (where.practicePatientLinkId && row.practicePatientLinkId !== where.practicePatientLinkId) {
      return false;
    }
    if (where.patientUserId && row.patientUserId !== where.patientUserId) return false;
    if (where.consentType && row.consentType !== where.consentType) return false;
    if (where.status && row.status !== where.status) return false;
    if (where.expiresAt?.lte) {
      if (!row.expiresAt || row.expiresAt > where.expiresAt.lte) return false;
    }
    if (where.id?.in && !where.id.in.includes(row.id)) return false;
    return true;
  }

  function sorted(rows, orderBy) {
    const list = [...rows];
    const clauses = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
    if (!clauses.length) return list;
    return list.sort((a, b) => {
      for (const clause of clauses) {
        const [field, dir] = Object.entries(clause)[0];
        const av = a[field];
        const bv = b[field];
        if (av === bv) continue;
        const cmp = av > bv ? 1 : -1;
        return dir === "desc" ? -cmp : cmp;
      }
      return 0;
    });
  }

  prisma.practicePatientLink = {
    findUnique: async ({ where }) => (where.id === LINK_ID ? { ...link() } : null),
    findFirst: async ({ where }) =>
      where.id && where.id !== LINK_ID ? null : { ...link() },
    findMany: async ({ where, include }) => {
      if (where?.patientUserId && where.patientUserId !== PATIENT) return [];
      const row = { ...link() };
      if (include?.practiceProfile) {
        row.practiceProfile = { id: PRACTICE, practiceName: "Praxis FC", publicSlug: "praxis-fc" };
      }
      return [row];
    },
    update: async ({ data }) => {
      Object.assign(link(), data);
      return { ...link() };
    },
  };

  prisma.practiceProfile = {
    findUnique: async ({ where }) =>
      where.id === PRACTICE ? { id: PRACTICE, userId: OWNER, practiceName: "Praxis FC" } : null,
  };

  prisma.practiceMember = {
    findUnique: async ({ where }) => {
      const { practiceProfileId, userId } = where.practiceProfileId_userId;
      if (practiceProfileId === PRACTICE && userId === DOCTOR) {
        return { practiceProfileId, userId, role: "doctor", status: "active" };
      }
      return null;
    },
  };

  prisma.consentRecord = {
    findFirst: async ({ where, orderBy }) =>
      sorted(consents.filter((c) => matches(c, where)), orderBy)[0] ?? null,
    findMany: async ({ where, orderBy, take }) => {
      const rows = sorted(consents.filter((c) => matches(c, where)), orderBy);
      return take ? rows.slice(0, take) : rows;
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const c of consents) {
        if (matches(c, where)) {
          Object.assign(c, data);
          count += 1;
        }
      }
      return { count };
    },
    create: async ({ data }) => {
      seq += 1;
      const row = { id: `new-${seq}`, createdAt: new Date(), updatedAt: new Date(), ...data };
      consents.push(row);
      created.push(row);
      return row;
    },
  };

  prisma.auditLog = { create: async () => ({}) };
}

test.beforeEach(() => install());

/** Every type the gate says yes to, for the current fixture. */
async function permitted(types = ALL_TYPES) {
  const out = [];
  for (const t of types) {
    if (await linkHasConsentType({ ...links[0] }, t)) out.push(t);
  }
  return out;
}

/** Consent types newly written as `granted` since the fixture was installed. */
function newlyGranted() {
  return created.filter((c) => c.status === "granted").map((c) => c.consentType).sort();
}

/* ------------------------------------------------------------------- case A */

test("A: no ConsentRecords at all -> every protected type is refused", async () => {
  install({ consentScopes: [], consentAcceptedAt: new Date("2026-01-01"), records: [] });

  assert.deepEqual(
    await permitted(),
    [],
    "a link with zero consent records must permit nothing",
  );
});

test("A2: a null consentScopes column is not a licence either", async () => {
  install({ consentScopes: null, consentAcceptedAt: new Date("2026-01-01"), records: [] });
  assert.deepEqual(await permitted(), []);
});

test("A3: the legacy sync helper reads an empty scopes array as empty", () => {
  const link = { consentAcceptedAt: new Date("2026-01-01"), consentScopes: [] };
  const truthy = ["profile", "medication", "messages", "documents", "vitals"].filter((s) =>
    linkHasConsentScope(link, s),
  );
  assert.deepEqual(truthy, [], "empty scopes must mean empty, not 'the original three'");
});

/* ------------------------------------------------------------------- case B */

test("B: consents that existed and were all withdrawn -> everything refused", async () => {
  // This is the exact state a full withdrawal leaves behind: the records are
  // revoked, syncLinkScopesFromRecords() has emptied consentScopes, and
  // consentAcceptedAt still carries the original acceptance date because
  // nothing ever clears it.
  install({
    consentScopes: [],
    consentAcceptedAt: new Date("2026-01-01"),
    records: LEGACY_TRIPLE.map((consentType) => ({ consentType, status: "revoked" })),
  });

  assert.deepEqual(
    await permitted(),
    [],
    "withdrawal must hold even though consentAcceptedAt is still set",
  );
});

/* ------------------------------------------------------------------- case C */

test("C: patient opens the consent overview after withdrawing -> still refused, nothing re-granted", async () => {
  install({
    consentScopes: [],
    consentAcceptedAt: new Date("2026-01-01"),
    records: LEGACY_TRIPLE.map((consentType) => ({ consentType, status: "revoked" })),
  });

  const rows = await listPatientConsents(PATIENT);

  assert.deepEqual(newlyGranted(), [], "a read must not create a consent");
  assert.deepEqual(
    rows.filter((r) => r.status === "granted").map((r) => r.consentType),
    [],
    "the overview must not report a withdrawn consent as granted",
  );
  assert.deepEqual(await permitted(), [], "and access must still be refused afterwards");
});

/* ------------------------------------------------------------------- case D */

test("D: practice opens the consent overview after withdrawal -> still refused, nothing re-granted", async () => {
  install({
    consentScopes: [],
    consentAcceptedAt: new Date("2026-01-01"),
    records: LEGACY_TRIPLE.map((consentType) => ({ consentType, status: "revoked" })),
  });

  const rows = await listPracticeLinkConsents(LINK_ID, PRACTICE);

  assert.deepEqual(newlyGranted(), [], "a practice-side read must not create a consent either");
  assert.deepEqual(
    rows.filter((r) => r.status === "granted").map((r) => r.consentType),
    [],
  );
  assert.deepEqual(await permitted(), []);
});

test("D2: backfill called directly can never overwrite a withdrawal", async () => {
  // Guards the helper itself, not just its callers — a future caller must not
  // be able to reintroduce the resurrection by wiring it up again.
  install({
    consentScopes: [],
    consentAcceptedAt: new Date("2026-01-01"),
    records: LEGACY_TRIPLE.map((consentType) => ({ consentType, status: "revoked" })),
  });

  await backfillConsentRecordsFromLink({ ...links[0] });

  assert.deepEqual(newlyGranted(), [], "backfill must not resurrect a revoked consent");
});

test("D3: backfill does not invent scopes the patient never recorded", async () => {
  // No records at all AND no scopes: there is nothing to migrate, so a backfill
  // has nothing to write. The old code wrote the three legacy types here.
  install({ consentScopes: [], consentAcceptedAt: new Date("2026-01-01"), records: [] });

  await backfillConsentRecordsFromLink({ ...links[0] });

  assert.deepEqual(newlyGranted(), [], "an empty scopes array is not a licence to backfill");
});

/* ------------------------------------------------------------------- case E */

test("E: a genuine active consent still permits its own type, and only that one", async () => {
  install({
    consentScopes: ["vitals"],
    consentAcceptedAt: new Date("2026-01-01"),
    records: [{ consentType: "vitals_access", status: "granted" }],
  });

  assert.deepEqual(await permitted(), ["vitals_access"]);
});

/* ------------------------------------------------------------------- case F */

test("F: partial withdrawal leaves exactly the consent that was kept", async () => {
  install({
    consentScopes: ["profile"],
    consentAcceptedAt: new Date("2026-01-01"),
    records: [
      { consentType: "profile_access", status: "granted" },
      { consentType: "medication_plan_access", status: "revoked" },
      { consentType: "secure_messaging", status: "revoked" },
    ],
  });

  assert.deepEqual(await permitted(), ["profile_access"]);
});

/* ------------------------------------------------------------------- case G */

test("G: several records of one type -> the newest decides, and a withdrawal wins", async () => {
  install({
    consentScopes: [],
    consentAcceptedAt: new Date("2026-01-01"),
    records: [
      { consentType: "profile_access", status: "granted", createdAt: new Date("2026-01-01") },
      { consentType: "profile_access", status: "revoked", createdAt: new Date("2026-03-01") },
    ],
  });

  assert.deepEqual(
    await permitted(),
    [],
    "a stale granted row must not outvote the later withdrawal",
  );
});

/* ------------------------------------------------------------------- case H */

test("H: consenting again after a withdrawal works", async () => {
  // The fix must close the fail-open without closing the door on a patient who
  // changes their mind back.
  install({
    consentScopes: ["messages"],
    consentAcceptedAt: new Date("2026-01-01"),
    records: [
      { consentType: "secure_messaging", status: "granted", createdAt: new Date("2026-01-01") },
      { consentType: "secure_messaging", status: "revoked", createdAt: new Date("2026-02-01") },
      { consentType: "secure_messaging", status: "granted", createdAt: new Date("2026-04-01") },
    ],
  });

  assert.deepEqual(await permitted(), ["secure_messaging"]);
});

test("H2: a re-grant is honoured through the HTTP authorization path too", async () => {
  install({
    consentScopes: ["secure_messaging"],
    consentAcceptedAt: new Date("2026-01-01"),
    records: [
      { consentType: "secure_messaging", status: "revoked", createdAt: new Date("2026-02-01") },
      { consentType: "secure_messaging", status: "granted", createdAt: new Date("2026-04-01") },
    ],
  });

  const decision = await authorizePracticePatientLink({
    actorUserId: DOCTOR,
    linkId: LINK_ID,
    requiredPermission: PERMISSIONS.PATIENT_LINKS_READ,
    requiredConsentType: "secure_messaging",
  });

  assert.equal(decision.ok, true, "a real re-consent must restore access");
});

/* ------------------------------------- the whole authorization path, not the helper */

test("authorization refuses every consent-gated type when no consent stands", async () => {
  // The point of going through authorizePracticePatientLink() rather than the
  // helper: a fix that repairs linkHasConsentType() but leaves a second
  // fallback somewhere in the chain would still pass the cases above.
  install({ consentScopes: [], consentAcceptedAt: new Date("2026-01-01"), records: [] });

  const allowed = [];
  for (const consentType of ALL_TYPES) {
    const decision = await authorizePracticePatientLink({
      actorUserId: DOCTOR,
      linkId: LINK_ID,
      requiredPermission: PERMISSIONS.PATIENT_LINKS_READ,
      requiredConsentType: consentType,
    });
    if (decision.ok) allowed.push(consentType);
  }

  assert.deepEqual(allowed, [], "no consent record must mean no access, at the route boundary");
});

test("authorization refuses after a full withdrawal", async () => {
  install({
    consentScopes: [],
    consentAcceptedAt: new Date("2026-01-01"),
    records: LEGACY_TRIPLE.map((consentType) => ({ consentType, status: "revoked" })),
  });

  for (const consentType of LEGACY_TRIPLE) {
    const decision = await authorizePracticePatientLink({
      actorUserId: DOCTOR,
      linkId: LINK_ID,
      requiredPermission: PERMISSIONS.PATIENT_LINKS_READ,
      requiredConsentType: consentType,
    });
    assert.equal(decision.ok, false, `${consentType} must be refused after withdrawal`);
    assert.equal(decision.reason, "consent_required");
  }
});

test("a permission the role does not hold is still refused before consent is consulted", async () => {
  // Ordering guard: consent is not the only gate, and relaxing one must not
  // quietly stand in for the other.
  install({
    consentScopes: ["vitals"],
    consentAcceptedAt: new Date("2026-01-01"),
    records: [{ consentType: "vitals_access", status: "granted" }],
  });

  const decision = await authorizePracticePatientLink({
    actorUserId: "user-nobody-fc",
    linkId: LINK_ID,
    requiredPermission: PERMISSIONS.PATIENT_LINKS_READ,
    requiredConsentType: "vitals_access",
  });

  assert.equal(decision.ok, false);
  assert.equal(decision.reason, "link_not_found");
});

/* ------------------------------------------------------- link state still gates */

test("an ended relationship refuses regardless of the records on it", async () => {
  install({
    consentScopes: ["vitals"],
    consentAcceptedAt: new Date("2026-01-01"),
    status: "revoked",
    records: [{ consentType: "vitals_access", status: "granted" }],
  });

  assert.equal(await linkHasConsentType({ ...links[0] }, "vitals_access"), false);
});
