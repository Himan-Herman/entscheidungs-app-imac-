/**
 * Best-effort vs mandatory audit logging. writeAuditLog stays fire-and-forget;
 * writeRequiredAuditLog is awaitable and must reject when the row cannot be
 * written, so a security-relevant mutation cannot silently go unrecorded.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const routesDir = join(here, "..", "routes");

import { prisma } from "../lib/prisma.js";
import { writeAuditLog, writeRequiredAuditLog } from "../services/auditLogService.js";

/* ----------------------------- part 5: mandatory vs best-effort audit logging */

test("writeAuditLog is best effort: no promise, never throws", () => {
  prisma.auditLog = {
    create: async () => {
      throw new Error("db down");
    },
  };
  // Returns undefined (NOT a promise) and must not throw synchronously.
  const returned = writeAuditLog({ action: "practice_vitals_viewed", userId: "u1" });
  assert.equal(returned, undefined, "must not return a promise — never await it");
});

test("writeRequiredAuditLog returns a promise and rejects when the write fails", async () => {
  prisma.auditLog = {
    create: async () => {
      throw new Error("db down");
    },
  };
  const returned = writeRequiredAuditLog({ action: "erezept_issued", userId: "u1" });
  assert.ok(returned instanceof Promise, "must be awaitable");
  await assert.rejects(() => returned, /db down/, "a failed audit write must surface");
});

test("writeRequiredAuditLog resolves and persists the row on success", async () => {
  const written = [];
  prisma.auditLog = {
    create: async ({ data }) => {
      written.push(data);
      return data;
    },
  };
  await writeRequiredAuditLog({
    action: "erezept_cancelled",
    userId: "u1",
    practicePatientLinkId: "link-1",
    entityId: "rx-1",
  });
  assert.equal(written.length, 1);
  assert.equal(written[0].action, "erezept_cancelled");
  assert.equal(written[0].practicePatientLinkId, "link-1");
});
