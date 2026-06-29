/**
 * One-off backfill: PracticePatientLink from PreVisitSession rows with practiceProfileId.
 * Does NOT set consent — patients must consent via /api/patient/links/:id/consent later.
 *
 * Usage:
 *   node scripts/backfillPracticePatientLinks.js --dry-run
 *   node scripts/backfillPracticePatientLinks.js
 */

import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { findOrCreatePracticePatientLink } from "../services/careRelationship/practicePatientLinkService.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const sessions = await prisma.preVisitSession.findMany({
    where: { practiceProfileId: { not: null } },
    select: {
      practiceProfileId: true,
      userId: true,
      patientProfileId: true,
    },
    distinct: ["practiceProfileId", "userId", "patientProfileId"],
  });

  console.log(
    `[backfill] ${sessions.length} distinct practice/patient combinations (dryRun=${dryRun})`,
  );

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const s of sessions) {
    const practiceProfileId = s.practiceProfileId;
    const patientUserId = s.userId;
    const patientProfileId = s.patientProfileId ?? null;

    if (!practiceProfileId || !patientUserId) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(
        `[dry-run] would link practice=${practiceProfileId} patient=${patientUserId} profile=${patientProfileId ?? "—"}`,
      );
      created += 1;
      continue;
    }

    try {
      const before = await prisma.practicePatientLink.findFirst({
        where: {
          practiceProfileId,
          patientUserId,
          patientProfileId,
          status: { in: ["invited", "active"] },
        },
      });
      await findOrCreatePracticePatientLink({
        practiceProfileId,
        patientUserId,
        patientProfileId,
      });
      if (before) skipped += 1;
      else created += 1;
    } catch (err) {
      errors += 1;
      console.error(
        `[backfill] failed practice=${practiceProfileId} patient=${patientUserId}:`,
        err?.message ?? err,
      );
    }
  }

  console.log(
    `[backfill] done created=${created} existing=${skipped} errors=${errors}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
