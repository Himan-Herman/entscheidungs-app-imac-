/**
 * Read-only Postgres column checks (no Prisma model required).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tableName e.g. AppointmentReminder
 * @param {string} columnName e.g. reminderKey
 */
export async function columnExists(prisma, tableName, columnName) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS ok
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
      AND column_name = ${columnName}
    LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function getSchemaConstraintState(prisma) {
  const [reminderKey, dedupeKey, reminderUnique, inboxUnique] = await Promise.all([
    columnExists(prisma, "AppointmentReminder", "reminderKey"),
    columnExists(prisma, "PatientInboxItem", "dedupeKey"),
    indexExists(prisma, "AppointmentReminder_reminderKey_key"),
    indexExists(prisma, "PatientInboxItem_patientUserId_dedupeKey_key"),
  ]);

  return {
    reminderKey,
    dedupeKey,
    reminderUnique,
    inboxUnique,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} indexName
 */
async function indexExists(prisma, indexName) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS ok
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = ${indexName}
    LIMIT 1
  `;
  return rows.length > 0;
}

export function logColumnMissing(table, column) {
  console.log(
    `[schema] SKIP: "${table}"."${column}" does not exist — migrations not applied yet.`,
  );
  console.log(
    `[schema] Run first: cd server && npx prisma migrate deploy`,
  );
  console.log(
    `[schema] (Do not use analyze/dedupe scripts before migrate deploy on this database.)`,
  );
}
