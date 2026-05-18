/**
 * Dev helper: create one neutral inbox item for the first user in DB.
 * Usage: PATIENT_INBOX=true node scripts/seedPatientInboxItem.js
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createInboxItem, NEUTRAL_INBOX_TITLE } from "../services/patientInbox/patientInboxService.js";
import { isPatientInboxEnabled } from "../config/featureFlags.js";

const prisma = new PrismaClient();

async function main() {
  if (!isPatientInboxEnabled()) {
    console.error("[seed] PATIENT_INBOX must be true");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    console.error("[seed] no user found");
    process.exit(1);
  }

  const practice = await prisma.practiceProfile.findFirst();
  const item = await createInboxItem({
    patientUserId: user.id,
    practiceProfileId: practice?.id,
    type: "system",
    title: NEUTRAL_INBOX_TITLE,
    summary: "Beispielhinweis — keine klinischen Inhalte.",
    sourceLabel: practice?.practiceName,
    targetUrl: "/pre-visit/my-preparations",
  });

  console.log("[seed] created inbox item", item.id, "for user", user.id);
}

main()
  .catch((e) => {
    console.error(e?.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
