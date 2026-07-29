/**
 * Refuses to let the server start against a database it does not fit.
 *
 * Migrations run in the BUILD step (`prisma migrate deploy`), not at start.
 * A restart — Render's "Restart service", a crash loop, an instance
 * replacement, `npm start`, `node app.js` — runs only the start command, so
 * new code can reach an old schema. The failure that produces is not a clean
 * 500: it is patient data endpoints breaking on "column does not exist", one
 * request at a time, after the deploy looked successful.
 *
 * This service is strictly READ-ONLY. It never runs a migration, never issues
 * DDL, never updates or deletes a row, never backfills and never repairs a
 * constraint. It answers one question — may this process serve traffic? — and
 * the answer is either yes or a non-zero exit.
 *
 * Nothing it logs identifies a patient or carries medical content: database
 * name, schema, counts, and the name of the first migration that is missing.
 */

import { readdirSync } from "node:fs";

/** Stable codes. They appear in logs and in the exit reason, never in a response. */
export const READINESS_ERRORS = Object.freeze({
  UNREACHABLE: "startup_database_unreachable",
  PENDING: "startup_database_migrations_pending",
  INVALID: "startup_database_migration_invalid",
  SCHEMA: "startup_database_schema_incomplete",
  DATA: "startup_database_data_inconsistent",
  BYPASS: "startup_database_guard_bypass_forbidden",
});

/** The four patient-owned models whose context invariants the app depends on. */
const CONTEXT_MODELS = ["VitalEntry", "VaccinationEntry", "AllergyEntry", "DiagnosisEntry"];

function readinessError(code, detail) {
  const err = new Error(code);
  err.readinessCode = code;
  err.readinessDetail = detail;
  return err;
}

/** Migration directory names, sorted the way Prisma applies them. */
export function listLocalMigrations(migrationsDirectory) {
  try {
    return readdirSync(migrationsDirectory)
      .filter((name) => /^\d{14}_/.test(name))
      .sort();
  } catch (err) {
    throw readinessError(READINESS_ERRORS.SCHEMA, `migrations directory unreadable: ${err.code}`);
  }
}

/**
 * Every local migration must be applied, finished and not rolled back.
 *
 * The check is driven by the directory, not by a hard-coded list: a migration
 * added later must gate the start too, or this guard would rot on its first day.
 */
async function assertMigrationsApplied(prisma, migrationsDirectory) {
  const local = listLocalMigrations(migrationsDirectory);
  if (local.length === 0) {
    throw readinessError(READINESS_ERRORS.SCHEMA, "no local migrations found");
  }

  let rows;
  try {
    rows = await prisma.$queryRaw`
      SELECT "migration_name", "finished_at", "rolled_back_at"
      FROM "_prisma_migrations"
    `;
  } catch (err) {
    // No migrations table at all is the same class of problem as an
    // unreachable database: this process cannot know what it is talking to.
    throw readinessError(READINESS_ERRORS.PENDING, `migration table unreadable: ${err.code ?? "error"}`);
  }

  const applied = new Map(rows.map((r) => [r.migration_name, r]));

  const missing = local.filter((name) => !applied.has(name));
  if (missing.length > 0) {
    throw readinessError(
      READINESS_ERRORS.PENDING,
      `${missing.length} of ${local.length} not applied, first: ${missing[0]}`,
    );
  }

  const broken = local
    .map((name) => ({ name, row: applied.get(name) }))
    .filter(({ row }) => row.finished_at === null || row.rolled_back_at !== null);
  if (broken.length > 0) {
    const first = broken[0];
    const reason = first.row.rolled_back_at !== null ? "rolled back" : "never finished";
    throw readinessError(
      READINESS_ERRORS.INVALID,
      `${broken.length} in a bad state, first: ${first.name} (${reason})`,
    );
  }

  return { localCount: local.length, appliedCount: applied.size };
}

/**
 * The minimum structure the running code assumes. Not a second Prisma engine —
 * only the pieces whose absence would corrupt data or leak it across tenants.
 */
async function assertSchemaInvariants(prisma) {
  const columns = await prisma.$queryRaw`
    SELECT table_name, column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY(${[...CONTEXT_MODELS, "ArchivedPracticePatientContext", "PracticeDocumentShareGrant"]})
  `;
  const has = (table, column) =>
    columns.some((c) => c.table_name === table && c.column_name === column);

  const missing = [];
  for (const model of CONTEXT_MODELS) {
    for (const column of ["dataScope", "contextPracticePatientLinkId", "archivedPracticeContextId"]) {
      if (!has(model, column)) missing.push(`${model}.${column}`);
    }
    const scope = columns.find((c) => c.table_name === model && c.column_name === "dataScope");
    if (scope && scope.is_nullable !== "NO") {
      // A nullable scope means unclassified records can be written, and an
      // unclassified record is invisible to every practice.
      missing.push(`${model}.dataScope must be NOT NULL`);
    }
  }
  for (const column of ["originalPracticePatientLinkId", "practiceDisplayNameSnapshot", "archiveReason"]) {
    if (!has("ArchivedPracticePatientContext", column)) {
      missing.push(`ArchivedPracticePatientContext.${column}`);
    }
  }
  for (const column of ["sourcePracticeProfileId", "targetPracticePatientLinkId", "status"]) {
    if (!has("PracticeDocumentShareGrant", column)) {
      missing.push(`PracticeDocumentShareGrant.${column}`);
    }
  }
  if (missing.length > 0) {
    throw readinessError(READINESS_ERRORS.SCHEMA, `${missing.length} missing, first: ${missing[0]}`);
  }

  // Constraints that carry security meaning rather than mere tidiness.
  const [{ count: uniqueArchive }] = await prisma.$queryRaw`
    SELECT count(*)::int AS count FROM pg_indexes
    WHERE tablename = 'ArchivedPracticePatientContext'
      AND indexdef LIKE '%UNIQUE%originalPracticePatientLinkId%'
  `;
  if (uniqueArchive === 0) {
    throw readinessError(READINESS_ERRORS.SCHEMA, "archive context is not unique per former link");
  }

  const [{ count: grantActiveUnique }] = await prisma.$queryRaw`
    SELECT count(*)::int AS count FROM pg_indexes
    WHERE tablename = 'PracticeDocumentShareGrant'
      AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%WHERE (status%'
  `;
  if (grantActiveUnique === 0) {
    throw readinessError(READINESS_ERRORS.SCHEMA, "share grants lack the active-uniqueness index");
  }

  // The archive must not point back at rows it outlives.
  const [{ count: archiveFks }] = await prisma.$queryRaw`
    SELECT count(*)::int AS count
    FROM information_schema.constraint_column_usage ccu
    JOIN information_schema.table_constraints tc ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'ArchivedPracticePatientContext'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name IN ('PracticeProfile', 'PracticePatientLink')
  `;
  if (archiveFks > 0) {
    throw readinessError(READINESS_ERRORS.SCHEMA, "archive context still references a live practice or link");
  }

  return { checkedModels: CONTEXT_MODELS.length };
}

/**
 * Aggregate data checks. Counts only — no record is read, no id is logged.
 */
async function assertDataConsistent(prisma) {
  let unclassified = 0;
  let invalid = 0;

  for (const model of CONTEXT_MODELS) {
    // The table name comes from the hard-coded list above, never from input.
    const [row] = await prisma.$queryRawUnsafe(`
      SELECT
        count(*) FILTER (WHERE "dataScope" IS NULL)::int AS unclassified,
        count(*) FILTER (WHERE
             ("dataScope" = 'patient_global'
               AND ("contextPracticePatientLinkId" IS NOT NULL OR "archivedPracticeContextId" IS NOT NULL))
          OR ("dataScope" = 'practice_contextual'
               AND "contextPracticePatientLinkId" IS NOT NULL AND "archivedPracticeContextId" IS NOT NULL)
          OR ("dataScope" = 'practice_contextual'
               AND "contextPracticePatientLinkId" IS NULL AND "archivedPracticeContextId" IS NULL)
        )::int AS invalid
      FROM "${model}"
    `);
    unclassified += row.unclassified;
    invalid += row.invalid;
  }

  if (unclassified > 0) {
    throw readinessError(READINESS_ERRORS.DATA, `${unclassified} unclassified records`);
  }
  if (invalid > 0) {
    throw readinessError(READINESS_ERRORS.DATA, `${invalid} invalid scope/context combinations`);
  }

  return { unclassified, invalid };
}

/**
 * The whole check. Throws with a stable readinessCode, or returns a summary.
 *
 * @param {{ prismaClient: any, migrationsDirectory: string }} input
 */
export async function assertDatabaseReadyForApplication(input) {
  const prisma = input?.prismaClient;
  const migrationsDirectory = input?.migrationsDirectory;
  if (!prisma || !migrationsDirectory) {
    throw readinessError(READINESS_ERRORS.SCHEMA, "prismaClient and migrationsDirectory are required");
  }

  let identity;
  try {
    const [row] = await prisma.$queryRaw`SELECT current_database(), current_schema()`;
    identity = { database: row.current_database, schema: row.current_schema };
  } catch (err) {
    // Deliberately not the connection URL: it carries the password.
    throw readinessError(READINESS_ERRORS.UNREACHABLE, err?.code ?? "connection failed");
  }

  const migrations = await assertMigrationsApplied(prisma, migrationsDirectory);
  const schema = await assertSchemaInvariants(prisma);
  const data = await assertDataConsistent(prisma);

  return { ...identity, ...migrations, ...schema, ...data };
}

/**
 * Whether the guard may be skipped.
 *
 * Only in automated tests, and only when asked explicitly. In production a set
 * bypass is a configuration error rather than a convenience: a deployment must
 * not be able to switch this off from an environment variable.
 *
 * @param {NodeJS.ProcessEnv} env
 */
export function resolveGuardBypass(env = process.env) {
  const requested = String(env.SKIP_STARTUP_DATABASE_GUARD ?? "").toLowerCase() === "true";
  if (!requested) return { skip: false };
  if (env.NODE_ENV === "production") {
    throw readinessError(READINESS_ERRORS.BYPASS, "the startup guard cannot be disabled in production");
  }
  if (env.NODE_ENV !== "test") {
    throw readinessError(READINESS_ERRORS.BYPASS, "the startup guard may only be skipped in tests");
  }
  return { skip: true };
}
