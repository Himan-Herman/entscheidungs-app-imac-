import { prisma } from "../lib/prisma.js";


const MAX_ENTRIES = 20;
const MAX_DRUG = 200;
const MAX_DOSAGE = 120;
const MAX_FREQUENCY = 200;
const MAX_INSTRUCTIONS = 500;

export function entryToJson(row) {
  return {
    id: row.id,
    drugName: row.drugName,
    dosage: row.dosage || null,
    frequency: row.frequency,
    intakeInstructions: row.intakeInstructions || null,
    sortOrder: row.sortOrder,
    publishedAt: row.publishedAt,
    patientViewedAt: row.patientViewedAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeEntry(raw, index) {
  const drugName = String(raw?.drugName || "").trim().slice(0, MAX_DRUG);
  const frequency = String(raw?.frequency || "").trim().slice(0, MAX_FREQUENCY);
  if (!drugName) throw new Error("validation_drug_name_required");
  if (!frequency) throw new Error("validation_frequency_required");
  return {
    drugName,
    dosage: String(raw?.dosage || "").trim().slice(0, MAX_DOSAGE) || null,
    frequency,
    intakeInstructions:
      String(raw?.intakeInstructions || "").trim().slice(0, MAX_INSTRUCTIONS) || null,
    sortOrder: Number.isFinite(Number(raw?.sortOrder)) ? Number(raw.sortOrder) : index,
  };
}

export async function getPracticeMedications(sessionId, practiceId) {
  const rows = await prisma.visitMedicationEntry.findMany({
    where: { preVisitSessionId: sessionId, practiceProfileId: practiceId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(entryToJson);
}

export async function savePracticeMedications({
  sessionId,
  practiceId,
  userId,
  entries,
  publish,
}) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length > MAX_ENTRIES) throw new Error("validation_too_many_entries");

  const session = await prisma.preVisitSession.findFirst({
    where: { id: sessionId, practiceProfileId: practiceId },
    select: { id: true, userId: true, practiceQrTargetId: true, patientLanguage: true },
  });
  if (!session) throw new Error("session_not_found");

  const normalized = list.map((e, i) => normalizeEntry(e, i));
  const publishedAt = publish ? new Date() : null;

  await prisma.$transaction(async (tx) => {
    await tx.visitMedicationEntry.deleteMany({
      where: { preVisitSessionId: sessionId, practiceProfileId: practiceId },
    });
    if (normalized.length > 0) {
      await tx.visitMedicationEntry.createMany({
        data: normalized.map((e) => ({
          preVisitSessionId: sessionId,
          practiceProfileId: practiceId,
          createdByUserId: userId,
          drugName: e.drugName,
          dosage: e.dosage,
          frequency: e.frequency,
          intakeInstructions: e.intakeInstructions,
          sortOrder: e.sortOrder,
          publishedAt,
        })),
      });
    }
  });

  return getPracticeMedications(sessionId, practiceId);
}

export async function notifyPatientAboutMedications({
  session,
  practiceId,
  userId,
  patientLanguage,
}) {
  const isDe = patientLanguage === "de";
  const title = isDe ? "Medikamente & Einnahme" : "Medications & intake";
  const body = isDe
    ? "Ihre Praxis hat Medikamenten- und Einnahmehinweise zu Ihrem Besuch hinterlegt. Bitte öffnen Sie im Patientenbereich die Kachel „Medikamente & Einnahme“ oder gehen Sie zu: /pre-visit/medications"
    : "Your practice has added medication and intake instructions for your visit. Open “Medications & intake” in the patient area or go to: /pre-visit/medications";

  const existing = await prisma.preVisitFollowUpThread.findFirst({
    where: {
      preVisitSessionId: session.id,
      practiceProfileId: practiceId,
      title,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await prisma.preVisitFollowUpMessage.create({
      data: {
        threadId: existing.id,
        senderType: "system",
        senderUserId: userId,
        body,
      },
    });
    await prisma.preVisitFollowUpThread.update({
      where: { id: existing.id },
      data: { status: "waiting_for_patient", updatedAt: new Date() },
    });
    return existing.id;
  }

  const thread = await prisma.preVisitFollowUpThread.create({
    data: {
      preVisitSessionId: session.id,
      practiceProfileId: practiceId,
      qrTargetId: session.practiceQrTargetId,
      patientUserId: session.userId,
      createdByUserId: userId,
      status: "waiting_for_patient",
      title,
      messages: {
        create: [{ senderType: "system", senderUserId: userId, body }],
      },
    },
  });
  return thread.id;
}

export async function listPatientMedicationSessions(userId) {
  const rows = await prisma.visitMedicationEntry.findMany({
    where: {
      publishedAt: { not: null },
      session: { userId },
    },
    include: {
      session: {
        select: {
          id: true,
          createdAt: true,
          title: true,
          patientLanguage: true,
          practiceProfile: { select: { practiceName: true } },
        },
      },
      practiceProfile: { select: { practiceName: true } },
    },
    orderBy: [{ publishedAt: "desc" }, { sortOrder: "asc" }],
  });

  const bySession = new Map();
  for (const row of rows) {
    if (!bySession.has(row.preVisitSessionId)) {
      const unviewed = !row.patientViewedAt;
      bySession.set(row.preVisitSessionId, {
        sessionId: row.preVisitSessionId,
        practiceName:
          row.practiceProfile?.practiceName ||
          row.session?.practiceProfile?.practiceName ||
          null,
        sessionTitle: row.session?.title || null,
        sessionCreatedAt: row.session?.createdAt || row.publishedAt,
        publishedAt: row.publishedAt,
        entryCount: 0,
        hasUnviewed: unviewed,
        entries: [],
      });
    }
    const bucket = bySession.get(row.preVisitSessionId);
    bucket.entryCount += 1;
    if (!row.patientViewedAt) bucket.hasUnviewed = true;
    bucket.entries.push(entryToJson(row));
  }

  return [...bySession.values()].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

export async function getPatientSessionMedications(userId, sessionId, { markViewed = false } = {}) {
  const session = await prisma.preVisitSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      title: true,
      createdAt: true,
      practiceProfile: { select: { practiceName: true } },
    },
  });
  if (!session) throw new Error("session_not_found");

  const rows = await prisma.visitMedicationEntry.findMany({
    where: {
      preVisitSessionId: sessionId,
      publishedAt: { not: null },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (markViewed && rows.length > 0) {
    await prisma.visitMedicationEntry.updateMany({
      where: { preVisitSessionId: sessionId, patientViewedAt: null },
      data: { patientViewedAt: new Date() },
    });
  }

  return {
    session: {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      practiceName: session.practiceProfile?.practiceName || null,
    },
    entries: rows.map(entryToJson),
  };
}
