/**
 * READ-ONLY preflight: does every ErezeptEntry.linkId name a real
 * PracticePatientLink, and does that link belong to the same patient?
 *
 * `ErezeptEntry.linkId` is a plain NOT NULL string with no foreign key. The
 * application only ever writes `link.id` from an authorized link, so the values
 * SHOULD all be valid — but "should" is what a preflight exists to replace with
 * a count before anyone considers a constraint.
 *
 * Reports counts and, where a row is broken, its id only. No medication name,
 * no dosage, no token, no note ever leaves this script: a diagnostic must not
 * become a second copy of the prescription data.
 *
 * Changes nothing. Ever. Exits non-zero when a foreign key could not be added.
 *
 * Run: node scripts/checkErezeptLinkIntegrity.js
 */
import "dotenv/config";
import { prisma } from "../lib/prisma.js";

/** Ids only, capped: enough to investigate, not a data dump. */
const SAMPLE = 20;

async function main() {
  const total = await prisma.erezeptEntry.count();

  if (total === 0) {
    console.log("ErezeptEntry: 0 rows — nothing to validate.");
    console.log("\nVERDICT: a foreign key is possible as far as data goes.");
    return 0;
  }

  const rows = await prisma.erezeptEntry.findMany({
    select: { id: true, linkId: true, patientUserId: true },
  });

  // Empty strings are possible even though the column is NOT NULL.
  const blank = rows.filter((r) => !String(r.linkId ?? "").trim());
  const withLink = rows.filter((r) => String(r.linkId ?? "").trim());

  const links = await prisma.practicePatientLink.findMany({
    where: { id: { in: [...new Set(withLink.map((r) => r.linkId))] } },
    select: { id: true, patientUserId: true, practiceProfileId: true },
  });
  const linkById = new Map(links.map((l) => [l.id, l]));

  const orphans = withLink.filter((r) => !linkById.has(r.linkId));

  // The entry carries its own patientUserId, so the two can disagree. That is
  // not a foreign-key problem — it is worse, because both ids resolve.
  const mismatched = withLink.filter((r) => {
    const l = linkById.get(r.linkId);
    return l && l.patientUserId !== r.patientUserId;
  });

  // Would the id resolve as something else entirely? If a practiceProfileId had
  // ever been written here, a plain orphan count would hide the reason.
  const orphanIds = [...new Set(orphans.map((r) => r.linkId))];
  const asPractice = orphanIds.length
    ? await prisma.practiceProfile.count({ where: { id: { in: orphanIds } } })
    : 0;

  const valid = withLink.length - orphans.length - mismatched.length;

  console.log("ErezeptEntry link integrity");
  console.log("---------------------------");
  console.log(`A  valid link + matching patient : ${valid}`);
  console.log(`B  blank linkId                  : ${blank.length}`);
  console.log(`C  linkId without a link (orphan) : ${orphans.length}`);
  console.log(`D  link belongs to another patient: ${mismatched.length}`);
  console.log(`E  orphan ids that are a practiceProfileId: ${asPractice}`);
  console.log(`   total rows                    : ${total}`);

  if (blank.length) console.log(`\n   blank sample   : ${blank.slice(0, SAMPLE).map((r) => r.id).join(", ")}`);
  if (orphans.length) console.log(`   orphan sample  : ${orphans.slice(0, SAMPLE).map((r) => r.id).join(", ")}`);
  if (mismatched.length) console.log(`   mismatch sample: ${mismatched.slice(0, SAMPLE).map((r) => r.id).join(", ")}`);

  const blocking = blank.length + orphans.length;
  console.log("");
  if (blocking > 0) {
    console.log(`VERDICT: a foreign key would FAIL — ${blocking} row(s) reference nothing.`);
    console.log("         Do not migrate. Decide what those rows meant first.");
  } else if (mismatched.length > 0) {
    console.log(`VERDICT: a foreign key would succeed, but ${mismatched.length} row(s) point at`);
    console.log("         another patient's link. Fix the semantics before the constraint.");
  } else {
    console.log("VERDICT: a foreign key is possible as far as data goes.");
    console.log("         Lifecycle (onDelete) is a separate decision — see the Phase 2F.1 report.");
  }

  return blocking > 0 || mismatched.length > 0 ? 1 : 0;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error("preflight failed:", err?.message ?? err);
    await prisma.$disconnect();
    process.exit(2);
  });
