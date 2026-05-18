/**
 * PR-0..2 smoke checks (service layer, no HTTP).
 * Usage: CARE_RELATIONSHIP_ENABLED=true node scripts/verifyCareRelationship.js
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  LINK_STATUSES,
  createLink,
  listLinksByPractice,
} from "../services/careRelationship/practicePatientLinkService.js";
import { isCareRelationshipEnabled } from "../config/featureFlags.js";

const prisma = new PrismaClient();

async function main() {
  console.log("[verify] CARE_RELATIONSHIP_ENABLED=", isCareRelationshipEnabled());
  console.log("[verify] LINK_STATUSES=", [...LINK_STATUSES].join(", "));

  const practice = await prisma.practiceProfile.findFirst({
    select: { id: true, practiceName: true },
  });
  if (!practice) {
    console.log("[verify] skip — no PracticeProfile in DB");
    return;
  }

  const result = await listLinksByPractice(practice.id, { limit: 1 });
  console.log(
    `[verify] listLinksByPractice(${practice.id}) ok total=${result.total}`,
  );

  const patient = await prisma.user.findFirst({
    where: { NOT: { id: practice.userId } },
    select: { id: true, email: true },
  });
  if (!patient) {
    console.log("[verify] skip createLink — no second user in DB");
    return;
  }

  try {
    const link = await createLink({
      practiceProfileId: practice.id,
      patientUserId: patient.id,
      status: "invited",
    });
    console.log(`[verify] createLink ok id=${link.id} status=${link.status}`);
  } catch (err) {
    if (err?.message === "link_already_exists") {
      console.log("[verify] createLink skipped — link_already_exists (expected if re-run)");
    } else {
      throw err;
    }
  }
}

main()
  .catch((e) => {
    console.error("[verify] failed:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
