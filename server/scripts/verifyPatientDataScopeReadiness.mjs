/**
 * Read-only readiness check for the patient data scope.
 *
 * Answers one question: may the practice read layer be trusted on THIS
 * database? It is trustworthy only once every patient-owned medical record is
 * classified — an unclassified record is invisible to practices, so a database
 * that still has some will silently show empty views.
 *
 * This script never writes. It does not migrate, it does not classify, and it
 * does not fix anything. It reports and sets an exit code.
 *
 *   exit 0  — schema present, no unclassified rows, no invalid combinations
 *   exit 1  — schema missing, data inconsistent, or the check itself failed
 *
 * Output is aggregate only: table names and row counts. No ids, no medical
 * content — no vitals, vaccines, allergens or diagnoses ever reach the log.
 *
 * Run: node scripts/verifyPatientDataScopeReadiness.mjs
 */
import { PrismaClient } from "@prisma/client";

const MODELS = ["VitalEntry", "VaccinationEntry", "AllergyEntry", "DiagnosisEntry"];
const COLUMNS = ["dataScope", "contextPracticePatientLinkId"];

const prisma = new PrismaClient();

function pad(s, n) {
  return String(s).padEnd(n);
}

async function main() {
  // Always say out loud which database was reached. A readiness check that is
  // silent about its target is how the wrong database gets touched.
  const [{ current_database: db, current_user: user }] = await prisma.$queryRaw`
    SELECT current_database(), current_user`;
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL || "").host || "(unbekannt)";
    } catch {
      return "(unbekannt)";
    }
  })();

  console.log("Datenbank :", db);
  console.log("Host      :", host);
  console.log("Rolle     :", user);
  console.log("Modus     : NUR LESEND — dieses Skript migriert und aendert nichts.\n");

  /* ---------------------------------------------------- 1. schema present? */

  const columnRows = await prisma.$queryRaw`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY(${MODELS})
      AND column_name = ANY(${COLUMNS})`;
  const present = new Set(columnRows.map((r) => `${r.table_name}.${r.column_name}`));

  const missing = [];
  for (const m of MODELS) {
    for (const c of COLUMNS) if (!present.has(`${m}.${c}`)) missing.push(`${m}.${c}`);
  }

  if (missing.length > 0) {
    console.log("Schema    : UNVOLLSTAENDIG");
    console.log(`  Fehlende Spalten (${missing.length}): ${missing.join(", ")}`);
    console.log("\nNICHT BEREIT: Die Kontext-Migrationen sind auf dieser Datenbank nicht angewendet.");
    console.log("Naechster Schritt: 'npx prisma migrate deploy' durch die zustaendige Deployment-Stelle.");
    console.log("Dieses Skript startet bewusst keine Migration.");
    return 1;
  }
  console.log("Schema    : alle 8 Kontextspalten vorhanden\n");

  /* -------------------------------------------- 2. per-model aggregate state */

  const nullable = await prisma.$queryRaw`
    SELECT table_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY(${MODELS})
      AND column_name = 'dataScope'`;
  const nullableByTable = new Map(nullable.map((r) => [r.table_name, r.is_nullable]));

  let unclassifiedTotal = 0n;
  let invalidTotal = 0n;
  let stillNullable = 0;

  console.log(`${pad("Modell", 18)}${pad("gesamt", 9)}${pad("global", 9)}${pad("kontext", 9)}${pad("ohne", 7)}${pad("ungueltig", 11)}NOT NULL`);
  console.log("-".repeat(72));

  for (const model of MODELS) {
    // Parameterised table names are not possible; the name comes from the
    // hard-coded MODELS list above and never from input.
    const [row] = await prisma.$queryRawUnsafe(`
      SELECT
        count(*)                                                                   AS total,
        count(*) FILTER (WHERE "dataScope" IS NULL)                                AS unclassified,
        count(*) FILTER (WHERE "dataScope" = 'patient_global')                     AS global_scope,
        count(*) FILTER (WHERE "dataScope" = 'practice_contextual')                AS contextual,
        count(*) FILTER (WHERE "contextPracticePatientLinkId" IS NOT NULL)         AS with_link,
        count(*) FILTER (WHERE "deletedAt" IS NOT NULL)                            AS soft_deleted,
        count(*) FILTER (WHERE
              ("dataScope" IS NULL                 AND "contextPracticePatientLinkId" IS NOT NULL)
           OR ("dataScope" = 'patient_global'      AND "contextPracticePatientLinkId" IS NOT NULL)
           OR ("dataScope" = 'practice_contextual' AND "contextPracticePatientLinkId" IS NULL))   AS invalid
      FROM "${model}"`);

    unclassifiedTotal += BigInt(row.unclassified);
    invalidTotal += BigInt(row.invalid);
    const notNull = nullableByTable.get(model) === "NO";
    if (!notNull) stillNullable += 1;

    console.log(
      pad(model, 18) + pad(row.total, 9) + pad(row.global_scope, 9) + pad(row.contextual, 9) +
      pad(row.unclassified, 7) + pad(row.invalid, 11) + (notNull ? "ja" : "NEIN"),
    );
    console.log(`${pad("", 18)}davon soft geloescht: ${row.soft_deleted}, mit Kontextlink: ${row.with_link}`);
  }

  /* ------------------------------------------------------------- 3. verdict */

  console.log();
  const problems = [];
  if (unclassifiedTotal > 0n) problems.push(`${unclassifiedTotal} unklassifizierte Datensaetze (fuer Praxen unsichtbar)`);
  if (invalidTotal > 0n) problems.push(`${invalidTotal} ungueltige Scope-/Link-Kombinationen`);
  if (stillNullable > 0) problems.push(`${stillNullable} von ${MODELS.length} Modellen haben dataScope noch nullable (Backfill-Migration fehlt)`);

  if (problems.length > 0) {
    console.log("NICHT BEREIT:");
    for (const p of problems) console.log(`  - ${p}`);
    console.log("\nDie Praxis-Leseansichten sind in diesem Zustand unvollstaendig.");
    console.log("Naechster Schritt: Backfill-Migration anwenden. Dieses Skript aendert nichts.");
    return 1;
  }

  console.log("BEREIT: jeder Datensatz ist klassifiziert, keine ungueltigen Kombinationen,");
  console.log("dataScope ist in allen vier Modellen verpflichtend.");
  return 0;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error("\nPRUEFUNG FEHLGESCHLAGEN:", err?.message || err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
