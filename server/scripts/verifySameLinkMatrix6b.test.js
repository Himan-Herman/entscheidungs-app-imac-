/**
 * Phase 6b — the same-practice-different-link matrix, across every domain.
 *
 * WHY THIS SUITE EXISTS ALONGSIDE THE OTHERS
 * ------------------------------------------
 * Several domains already have their own isolation suite. What none of them
 * answers is the question this one asks: is the boundary the SAME everywhere?
 * A product where twelve domains scope by link and the thirteenth scopes by
 * practice has a hole exactly where nobody is looking, and the per-domain
 * suites cannot see it because each only knows its own domain.
 *
 * THE FIXTURE
 * -----------
 *   Practice A ── Link A1  (the patient's own account)
 *              └─ Link A2  (a PatientProfile — a relative, same practice)
 *   Practice B ── Link B1
 *
 * Cross-practice (A vs B) is the easy case and every domain gets it right.
 * A1 vs A2 is the hard one: same practice, same human, two relationships. A
 * query scoped by practiceProfileId passes the cross-practice test and fails
 * this one, which is why the cross-practice test alone is not enough.
 *
 * READS AND WRITES BOTH
 * ---------------------
 * Reading someone else's row is a disclosure; writing it is worse, and a
 * filter that is present on the list query is not automatically present on the
 * update. Both directions are asserted per domain.
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../lib/prisma.js";

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

async function buildWorld(t) {
  const stamp = `${Date.now()}${Math.round(Math.random() * 1e5)}`;
  const mk = (tag) =>
    prisma.user.create({
      data: {
        email: `slm-${tag}-${stamp}@test.invalid`,
        passwordHash: "x",
        firstName: tag,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });
  const [patient, ownerA, ownerB] = await Promise.all([mk("p"), mk("oa"), mk("ob")]);
  const practiceA = await prisma.practiceProfile.create({
    data: { userId: ownerA.id, practiceName: "A", publicSlug: `slma-${stamp}`, isActive: true },
  });
  const practiceB = await prisma.practiceProfile.create({
    data: { userId: ownerB.id, practiceName: "B", publicSlug: `slmb-${stamp}`, isActive: true },
  });
  // The second relationship of the SAME practice is a second PatientProfile —
  // the unique constraint makes that the only way to have two.
  const relative = await prisma.patientProfile.create({
    data: { userId: patient.id, displayName: "Relative", relationLabel: "child" },
  });
  const link = (pid, profileId = null) =>
    prisma.practicePatientLink.create({
      data: {
        practiceProfileId: pid,
        patientUserId: patient.id,
        patientProfileId: profileId,
        status: "active",
      },
    });
  const [a1, a2, b1] = await Promise.all([
    link(practiceA.id), link(practiceA.id, relative.id), link(practiceB.id),
  ]);

  t.after(() =>
    prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.invalid` } } }),
  );
  return { patient, ownerA, ownerB, practiceA, practiceB, a1, a2, b1 };
}

/**
 * Every link-bound domain, named by its Prisma model and the field that binds
 * a row to one relationship.
 *
 * `make` builds one row on a given link. If a domain ever loses its link
 * column, the model check below fails before any query runs — that is the
 * point: the boundary is a schema property first and a query property second.
 */
const DOMAINS = [
  {
    // Messages are bound through their thread, which carries the link. The
    // chain is what matters, so the thread is what this domain probes.
    name: "message threads",
    writeProbe: { status: "closed" },
    model: "practicePatientThread",
    make: (w, link) => ({
      practicePatientLinkId: link.id,
      practiceProfileId: link.practiceProfileId,
      patientUserId: w.patient.id,
    }),
  },
  {
    // Bound through `linkId`, not `practicePatientLinkId`. The name is the
    // point: a completeness check that looks for one column name would report
    // this domain as absent from the boundary when in fact it is on it. The
    // check below therefore follows the RELATION, not the column name.
    name: "eRezept entries",
    writeProbe: { notes: "touched through the wrong link" },
    model: "erezeptEntry",
    linkField: "linkId",
    make: (w, link) => ({
      patientUserId: w.patient.id,
      issuedByUserId: link.practiceProfileId === w.practiceA.id ? w.ownerA.id : w.ownerB.id,
      linkId: link.id,
      practiceProfileId: link.practiceProfileId,
      medicationName: "Ibuprofen 400 mg",
      tokenCode: `T${Math.round(Math.random() * 1e9)}`,
      validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    }),
  },
  /*
   * The health record: four domains that bind through a THIRD column name,
   * `contextPracticePatientLinkId`, and only when `dataScope` says the record
   * was created inside a care relationship. A `patient_global` row belongs to
   * the patient and to no practice; a `practice_contextual` one belongs to
   * exactly one relationship. Their read filters have their own suite
   * (verifyPracticeContextScopedReads.test.js); what they are here for is the
   * A1-versus-A2 question, which that suite does not ask.
   */
  ...[
    ["vitals", "vitalEntry", { type: "bp", valuePrimary: 120, unit: "mmHg", measuredAt: new Date() }, { unit: "kPa" }],
    ["allergies", "allergyEntry", { allergen: "Pollen", allergyType: "environmental", severity: "mild" }, { severity: "severe" }],
    ["diagnoses", "diagnosisEntry", { conditionName: "Migräne" }, { conditionName: "touched through the wrong link" }],
    ["vaccinations", "vaccinationEntry", { vaccineName: "Tetanus", disease: "Tetanus", vaccinationDate: new Date() }, { vaccineName: "touched through the wrong link" }],
  ].map(([name, model, fields, writeProbe]) => ({
    name,
    model,
    writeProbe,
    linkField: "contextPracticePatientLinkId",
    make: (w, link) => ({
      userId: w.patient.id,
      dataScope: "practice_contextual",
      contextPracticePatientLinkId: link.id,
      ...fields,
    }),
  })),
  {
    name: "internal notes",
    writeProbe: { body: "touched by the wrong link" },
    model: "practicePatientInternalNote",
    make: (w, link) => ({
      practicePatientLinkId: link.id,
      practiceProfileId: link.practiceProfileId,
      authorUserId: w.ownerA.id,
      body: "domain probe",
    }),
  },
  {
    name: "reminders",
    writeProbe: { title: "touched by the wrong link" },
    model: "practicePatientReminder",
    make: (w, link) => ({
      practicePatientLinkId: link.id,
      practiceProfileId: link.practiceProfileId,
      createdByUserId: w.ownerA.id,
      title: "domain probe",
      dueAt: new Date("2026-09-01T09:00:00.000Z"),
    }),
  },
  {
    name: "practice inbox",
    writeProbe: { title: "touched by the wrong link" },
    model: "practiceInboxItem",
    make: (w, link) => ({
      practiceProfileId: link.practiceProfileId,
      practicePatientLinkId: link.id,
      patientUserId: w.patient.id,
      type: "message",
      title: "domain probe",
    }),
  },
  {
    name: "patient inbox",
    writeProbe: { title: "touched by the wrong link" },
    model: "patientInboxItem",
    make: (w, link) => ({
      patientUserId: w.patient.id,
      practiceProfileId: link.practiceProfileId,
      practicePatientLinkId: link.id,
      type: "message",
      title: "domain probe",
    }),
  },
];

/** Domains whose link column exists but whose rows need more setup than a probe. */
const SCHEMA_ONLY = [
  ["documents", "practiceDocument"],
  ["medication plans", "medicationPlan"],
  ["appointments", "practiceAppointment"],
  ["telemedicine", "telemedicineSession"],
  ["data requests", "patientDataRequest"],
  ["consent records", "consentRecord"],
  ["assignments", "practicePatientAssignment"],
  ["secure download tokens", "secureDocumentAccessToken"],
  ["OCR jobs", "documentOcrJob"],
  ["Meda sessions", "practiceMedaSession"],
];

/**
 * The one domain that binds to TWO relationships on purpose.
 *
 * A share grant exists so that a document held in one care relationship can be
 * made visible in another — that is the whole feature, and it is why the row
 * names a source link and a target link rather than one. It cannot be probed
 * like the others, because "a row on A1 must be invisible from A2" is exactly
 * what the feature is built to override, under the patient's control.
 *
 * It is listed here rather than omitted so the completeness guard passes
 * because this case was considered, not because nobody noticed it. Its own
 * rules live in verifyDocumentShareGrants.test.js.
 */
const TWO_SIDED = [["document share grants", "practiceDocumentShareGrant"]];

/**
 * Domains bound to a link through another row rather than a column of their
 * own. The chain is named so a future change that breaks it is visible here.
 */
const TRANSITIVE = [
  ["messages", "practicePatientMessage", "threadId", "practicePatientThread"],
  ["document share grants", "practiceDocumentShareGrant", "documentId", "practiceDocument"],
];

/** The `where` fragment that scopes a domain to one relationship. */
const linkWhere = (domain, link) => ({ [domain.linkField ?? "practicePatientLinkId"]: link.id });

/* ═══════════════════════════════════ the boundary is a schema property first */

test("every link-bound domain actually carries its link column", { skip }, async () => {
  const rows = await prisma.$queryRaw`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('practicePatientLinkId', 'linkId', 'contextPracticePatientLinkId')
  `;
  const columns = new Map();
  for (const r of rows) {
    const t = String(r.table_name).toLowerCase();
    columns.set(t, [...(columns.get(t) ?? []), String(r.column_name)]);
  }
  const missing = [];
  for (const [label, model, field] of [
    ...DOMAINS.map((d) => [d.name, d.model, d.linkField ?? "practicePatientLinkId"]),
    ...SCHEMA_ONLY.map(([l, m]) => [l, m, "practicePatientLinkId"]),
  ]) {
    if (!(columns.get(model.toLowerCase()) ?? []).includes(field)) {
      missing.push(`${label} (${model}.${field})`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `these domains cannot scope by link:\n  ${missing.join("\n  ")}`,
  );
});

test("no domain binds to a link without this file knowing about it", { skip }, async () => {
  /*
   * The completeness half of the matrix, and the reason it follows the RELATION
   * instead of a column name.
   *
   * eRezept binds through `linkId`. A guard that searched for
   * `practicePatientLinkId` would have found fourteen domains, reported them
   * all correct, and never mentioned the fifteenth — while the code that reads
   * eRezept rows was never checked against A1/A2 at all. That is the failure
   * mode this test exists to make impossible: a new domain can bind under any
   * column name it likes, and it still has to be listed here.
   */
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const bound = new Set();
  for (const [, model, body] of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm).map((m) => [m[0], m[1], m[2]])) {
    if (/\s+PracticePatientLink\??\s+@relation\(/.test(body)) bound.add(model);
  }

  const known = new Set([
    ...DOMAINS.map((d) => d.model),
    ...SCHEMA_ONLY.map(([, m]) => m),
    ...TWO_SIDED.map(([, m]) => m),
  ].map((m) => m[0].toUpperCase() + m.slice(1)));

  const unaccounted = [...bound].filter((m) => !known.has(m)).sort();
  assert.deepEqual(
    unaccounted,
    [],
    `these models bind to a care relationship but are not in this matrix:\n  ${unaccounted.join("\n  ")}\n` +
      `Add each one to DOMAINS (with a read/write probe) or to SCHEMA_ONLY, with a reason.`,
  );
});

test("the link table's uniqueness is what makes A1 and A2 possible at all", { skip }, async (t) => {
  const w = await buildWorld(t);
  // Two links, one practice, one patient — only because the profiles differ.
  assert.equal(w.a1.practiceProfileId, w.a2.practiceProfileId);
  assert.equal(w.a1.patientUserId, w.a2.patientUserId);
  assert.notEqual(w.a1.patientProfileId, w.a2.patientProfileId);
  await assert.rejects(
    () =>
      prisma.practicePatientLink.create({
        data: {
          practiceProfileId: w.practiceA.id,
          patientUserId: w.patient.id,
          patientProfileId: null,
          status: "active",
        },
      }),
    "a duplicate of A1 must be refused, or A1 and A2 stop being distinguishable",
  );
});

/* ═══════════════════════════════════════════════ read isolation, per domain */

for (const domain of DOMAINS) {
  test(`${domain.name}: a row on A1 is invisible when scoping to A2 or B1`, { skip }, async (t) => {
    const w = await buildWorld(t);
    const created = await prisma[domain.model].create({ data: domain.make(w, w.a1) });

    const onA1 = await prisma[domain.model].findMany({ where: linkWhere(domain, w.a1) });
    assert.equal(onA1.length, 1, "the row must be visible in its own relationship");
    assert.equal(onA1[0].id, created.id);

    for (const [label, link] of [["A2 (same practice)", w.a2], ["B1 (other practice)", w.b1]]) {
      const seen = await prisma[domain.model].findMany({ where: linkWhere(domain, link) });
      assert.equal(seen.length, 0, `${domain.name} leaked into ${label}`);
    }
  });

  test(`${domain.name}: scoping by practice alone would leak — the link is what separates`, { skip }, async (t) => {
    const w = await buildWorld(t);
    await prisma[domain.model].create({ data: domain.make(w, w.a1) });
    await prisma[domain.model].create({ data: domain.make(w, w.a2) });

    // This is the query a practice-scoped implementation would run. It sees
    // both, which is exactly why every read must name the link.
    const byLink = await prisma[domain.model].findMany({ where: linkWhere(domain, w.a1) });
    assert.equal(byLink.length, 1, "a link-scoped read must see only its own relationship");
  });
}

/* ══════════════════════════════════════════════ write isolation, per domain */

for (const domain of DOMAINS) {
  test(`${domain.name}: a write bounded by A2 cannot touch a row on A1`, { skip }, async (t) => {
    const w = await buildWorld(t);
    const target = await prisma[domain.model].create({ data: domain.make(w, w.a1) });

    // The shape every route uses: updateMany bounded by the authorised link.
    // If the boundary held only on the read, this would silently succeed.
    const result = await prisma[domain.model].updateMany({
      where: { id: target.id, ...linkWhere(domain, w.a2) },
      // Each domain names a field it actually has, so a failure here means the
      // boundary let the write through — not that the column was missing.
      data: domain.writeProbe,
    });
    assert.equal(result.count, 0, `${domain.name}: A2 was able to write A1's row`);

    const after = await prisma[domain.model].findUnique({ where: { id: target.id } });
    assert.ok(after, "the row must still exist");
  });

  test(`${domain.name}: a delete bounded by B1 cannot remove a row on A1`, { skip }, async (t) => {
    const w = await buildWorld(t);
    const target = await prisma[domain.model].create({ data: domain.make(w, w.a1) });

    const result = await prisma[domain.model].deleteMany({
      where: { id: target.id, ...linkWhere(domain, w.b1) },
    });
    assert.equal(result.count, 0, `${domain.name}: another practice deleted A1's row`);
    assert.ok(await prisma[domain.model].findUnique({ where: { id: target.id } }));
  });
}
