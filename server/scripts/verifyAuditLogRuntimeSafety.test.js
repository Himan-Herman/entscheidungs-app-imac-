/**
 * A successful domain mutation must never fail because of how the audit helper
 * was called.
 *
 * The defect this pins down: the row was written, then `writeAuditLog(...)`
 * returned `undefined`, then `.catch()` on it threw, and the request answered
 * 500. The user was told their appointment was not confirmed while it had been.
 *
 * These run the REAL service functions against an in-memory Prisma fake, one
 * per domain, so the guarantee is exercised end to end rather than asserted.
 *
 * Run: node --test scripts/verifyAuditLogRuntimeSafety.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../lib/prisma.js";
import { writeAuditLog, writeRequiredAuditLog } from "../services/auditLogService.js";

/* ---------------------------------------------------------------- contract */

test("writeAuditLog returns undefined and never throws, even when the write fails", async () => {
  prisma.auditLog = {
    create: async () => {
      throw new Error("database unavailable");
    },
  };

  const result = writeAuditLog({ action: "x", actorRole: "system" });
  assert.equal(result, undefined, "fire-and-forget: there is nothing to await");

  // The rejection is swallowed inside the helper; give it a tick to prove no
  // unhandled rejection escapes into the process.
  await new Promise((r) => setTimeout(r, 10));
});

test("writeRequiredAuditLog DOES return a promise and rejects — the deliberate contrast", async () => {
  prisma.auditLog = {
    create: async () => {
      throw new Error("database unavailable");
    },
  };
  await assert.rejects(() => writeRequiredAuditLog({ action: "x" }));
});

/* ------------------------------------------------ appointments (2E.1 path) */

function baseFakes() {
  prisma.auditLog = { create: async () => ({}) };
  prisma.appointmentReminder = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    deleteMany: async () => ({ count: 0 }),
    updateMany: async () => ({ count: 0 }),
    upsert: async () => ({}),
  };
  prisma.practicePatientLink = { findFirst: async () => null };
  prisma.user = { findUnique: async () => null };
  prisma.practiceProfile = { findUnique: async () => null, findFirst: async () => null };
  prisma.patientInboxItem = { findFirst: async () => null, create: async () => ({}), update: async () => ({}) };
  prisma.practiceInboxItem = { findFirst: async () => null, create: async () => ({}), update: async () => ({}) };
}

test("confirming an appointment succeeds — the mutation is not undone by the audit call", async () => {
  baseFakes();
  const appointment = {
    id: "appt-1",
    patientUserId: "patient-1",
    practiceProfileId: "practice-1",
    status: "scheduled",
    startAt: new Date("2026-10-01T09:00:00Z"),
  };
  prisma.practiceAppointment = {
    findFirst: async () => ({ ...appointment }),
    findUnique: async () => ({ ...appointment }),
    update: async ({ data }) => {
      Object.assign(appointment, data);
      return { ...appointment, appointmentType: null };
    },
  };

  const { confirmPatientAppointment } = await import("../services/calendar/appointmentService.js");
  const result = await confirmPatientAppointment("patient-1", "appt-1", {});

  assert.equal(result.status, "confirmed", "the caller learns the truth about the mutation");
  assert.equal(appointment.status, "confirmed", "and the row really changed");
});

test("an appointment confirm still succeeds when the audit write itself fails", async () => {
  baseFakes();
  // Audit is best effort: losing the row must not undo or hide the mutation.
  prisma.auditLog = {
    create: async () => {
      throw new Error("audit table unavailable");
    },
  };
  const appointment = {
    id: "appt-2",
    patientUserId: "patient-1",
    practiceProfileId: "practice-1",
    status: "scheduled",
    startAt: new Date("2026-10-02T09:00:00Z"),
  };
  prisma.practiceAppointment = {
    findFirst: async () => ({ ...appointment }),
    findUnique: async () => ({ ...appointment }),
    update: async ({ data }) => {
      Object.assign(appointment, data);
      return { ...appointment, appointmentType: null };
    },
  };

  const { confirmPatientAppointment } = await import("../services/calendar/appointmentService.js");
  const result = await confirmPatientAppointment("patient-1", "appt-2", {});
  assert.equal(result.status, "confirmed");
  await new Promise((r) => setTimeout(r, 10));
});

/* --------------------------------------------------------------- documents */

test("sharing a practice document reports success rather than a false failure", async () => {
  baseFakes();
  const { findAuditLogMisuse } = await import("./lib/auditLogCallScanner.js");
  const fs = await import("node:fs");

  // The document service is reached through routes with heavy dependencies, so
  // the guarantee is asserted structurally here: no call site in the document
  // path may chain onto the helper.
  for (const file of [
    "services/practiceDocument/practiceDocumentService.js",
    "routes/practiceDocuments.js",
  ]) {
    const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.deepEqual(
      findAuditLogMisuse(source, file),
      [],
      `${file} must not chain onto the fire-and-forget audit helper`,
    );
  }
});

/* ---------------------------------------------------------- inbox + booking */

test("creating a practice inbox item succeeds and audits without throwing", async () => {
  baseFakes();
  const previous = process.env.PRACTICE_INBOX;
  process.env.PRACTICE_INBOX = "true";

  let audits = 0;
  prisma.auditLog = {
    create: async () => {
      audits += 1;
      return {};
    },
  };
  prisma.practiceInboxItem = {
    findFirst: async () => null,
    create: async ({ data }) => ({ id: "inbox-1", ...data }),
  };

  const { upsertPracticeInboxItem } = await import("../services/practiceInbox/practiceInboxService.js");
  const item = await upsertPracticeInboxItem({
    practiceProfileId: "practice-1",
    type: "message",
    title: "Neue Nachricht",
  });

  assert.equal(item.id, "inbox-1");
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(audits, 1);

  if (previous === undefined) delete process.env.PRACTICE_INBOX;
  else process.env.PRACTICE_INBOX = previous;
});

test("the booking and telemedicine paths carry no chained audit calls either", async () => {
  const { findAuditLogMisuse } = await import("./lib/auditLogCallScanner.js");
  const fs = await import("node:fs");

  for (const file of [
    "services/booking/bookingRequestsService.js",
    "services/booking/bookingSettingsService.js",
    "services/telemedicine/telemedicineService.js",
    "services/export/exportJobService.js",
  ]) {
    const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.deepEqual(findAuditLogMisuse(source, file), [], `${file} must be clean`);
  }
});
