/**
 * Patient inbox dedupe smoke tests.
 * Usage: node scripts/verifyPatientInboxDedupe.js
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { upsertPatientInboxItem, countUnreadPatientInbox } from "../services/patientInbox/patientInboxService.js";
import { buildPatientInboxDedupeKey } from "../services/patientInbox/patientInboxDedupe.js";
import { notifyPatientInboxOfPracticeDocument } from "../services/practiceDocument/inboxNotify.js";
import { notifyPatientInboxOfMedicationPlan } from "../services/medicationPlan/inboxNotify.js";
import { notifyPatientInboxOfPracticeMessage } from "../services/communication/inboxNotify.js";

const prisma = new PrismaClient();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const key = buildPatientInboxDedupeKey({
    type: "document",
    sourceRefType: "practice_document",
    sourceRefId: "doc_test_1",
  });
  assert(key === "document:practice_document:doc_test_1", "dedupe key format");

  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) {
    console.log("[verify] skip — no user in DB");
    return;
  }

  const practice = await prisma.practiceProfile.findFirst({ select: { id: true } });
  const link = practice
    ? await prisma.practicePatientLink.findFirst({
        where: { patientUserId: user.id, practiceProfileId: practice.id },
        select: { id: true },
      })
    : null;

  const docId = `verify_doc_${Date.now()}`;
  const planId = `verify_plan_${Date.now()}`;
  const threadId = `verify_thread_${Date.now()}`;

  const base = {
    patientUserId: user.id,
    practiceProfileId: practice?.id,
    practicePatientLinkId: link?.id,
  };

  const a = await upsertPatientInboxItem({
    ...base,
    type: "document",
    titleKey: "document",
    sourceRefType: "practice_document",
    sourceRefId: docId,
    targetUrl: `/patient/practice-documents/${docId}`,
  });
  const b = await upsertPatientInboxItem({
    ...base,
    type: "document",
    titleKey: "document",
    sourceRefType: "practice_document",
    sourceRefId: docId,
    targetUrl: `/patient/practice-documents/${docId}`,
  });
  assert(a.item.id === b.item.id, "document dedupe same row");
  assert(b.deduped === true, "second call deduped");
  console.log("[verify] document dedupe ok");

  const m1 = await upsertPatientInboxItem({
    ...base,
    type: "medication",
    titleKey: "medication",
    sourceRefType: "medication_plan",
    sourceRefId: planId,
    targetUrl: `/patient/medication-plans/${planId}`,
  });
  const m2 = await upsertPatientInboxItem({
    ...base,
    type: "medication",
    titleKey: "medication",
    sourceRefType: "medication_plan",
    sourceRefId: planId,
    targetUrl: `/patient/medication-plans/${planId}`,
  });
  assert(m1.item.id === m2.item.id, "medication plan dedupe");
  console.log("[verify] medication dedupe ok");

  const t1 = await upsertPatientInboxItem({
    ...base,
    type: "message",
    titleKey: "message",
    sourceRefType: "patient_thread",
    sourceRefId: threadId,
    targetUrl: `/patient/messages/${threadId}`,
  });
  const t2 = await upsertPatientInboxItem({
    ...base,
    type: "message",
    titleKey: "message",
    sourceRefType: "patient_thread",
    sourceRefId: threadId,
    targetUrl: `/patient/messages/${threadId}`,
  });
  assert(t1.item.id === t2.item.id, "thread message dedupe");
  console.log("[verify] message thread dedupe ok");

  const unreadBefore = await countUnreadPatientInbox(user.id);
  await upsertPatientInboxItem({
    ...base,
    type: "document",
    titleKey: "document",
    sourceRefType: "practice_document",
    sourceRefId: docId,
  });
  const unreadAfter = await countUnreadPatientInbox(user.id);
  assert(unreadBefore === unreadAfter, "dedupe bump does not inflate unread count");
  console.log("[verify] unread count stable on dedupe");

  if (practice && link) {
    await notifyPatientInboxOfPracticeDocument({
      id: docId,
      patientUserId: user.id,
      practiceProfileId: practice.id,
      practicePatientLinkId: link.id,
    });
    await notifyPatientInboxOfMedicationPlan({
      id: planId,
      patientUserId: user.id,
      practiceProfileId: practice.id,
      practicePatientLinkId: link.id,
    });
    await notifyPatientInboxOfPracticeMessage({
      id: threadId,
      patientUserId: user.id,
      practiceProfileId: practice.id,
      practicePatientLinkId: link.id,
    });
    console.log("[verify] notify wrappers ok");
  }

  console.log("[verify] done");
}

main()
  .catch((e) => {
    console.error("[verify] failed:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
