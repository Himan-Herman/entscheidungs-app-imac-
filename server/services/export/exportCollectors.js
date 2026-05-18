import { PrismaClient } from "@prisma/client";
import { getPracticePatientOverview } from "../careRelationship/practicePatientRecordService.js";
import { listPracticeLinkActivity } from "../activity/activityFeedService.js";
import { listPatientActivity } from "../activity/activityFeedService.js";
import { registryForAction } from "../activity/activityFeedRegistry.js";

const prisma = new PrismaClient();

/**
 * @param {Date | string | null | undefined} d
 */
function fmt(d) {
  if (!d) return "—";
  try {
    return new Date(d).toISOString().slice(0, 19).replace("T", " ");
  } catch {
    return "—";
  }
}

/**
 * @param {{ actorRole: 'patient' | 'practice', type: string, locale?: string, patientUserId?: string, practiceProfileId?: string, practicePatientLinkId?: string }} ctx
 */
export async function collectExportDataset(ctx) {
  const { type, actorRole } = ctx;
  const locale = String(ctx.locale || "de").toLowerCase().startsWith("en") ? "en" : "de";
  const de = locale === "de";

  if (actorRole === "patient") {
    return collectPatientExport(ctx, type, de);
  }
  return collectPracticeExport(ctx, type, de);
}

/**
 * @param {object} ctx
 * @param {string} type
 * @param {boolean} de
 */
async function collectPatientExport(ctx, type, de) {
  const uid = String(ctx.patientUserId || "").trim();
  if (!uid) throw new Error("validation_required");

  if (type === "medication_plans") {
    const plans = await prisma.medicationPlan.findMany({
      where: { patientUserId: uid, status: { not: "deleted" } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        status: true,
        version: true,
        publishedAt: true,
        updatedAt: true,
        practiceProfile: { select: { practiceName: true } },
      },
    });
    return {
      title: de ? "Medikationspläne" : "Medication plans",
      source: "MedScoutX",
      columns: de
        ? ["Datum", "Praxis", "Titel", "Status", "Version"]
        : ["Date", "Practice", "Title", "Status", "Version"],
      rows: plans.map((p) => [
        fmt(p.publishedAt || p.updatedAt),
        p.practiceProfile?.practiceName || "—",
        p.title || "—",
        p.status,
        String(p.version),
      ]),
    };
  }

  if (type === "practice_documents_list") {
    const docs = await prisma.practiceDocument.findMany({
      where: { patientUserId: uid, status: { in: ["shared", "archived"] } },
      orderBy: { sharedAt: "desc" },
      take: 100,
      select: {
        title: true,
        type: true,
        status: true,
        sharedAt: true,
        practiceProfile: { select: { practiceName: true } },
      },
    });
    return {
      title: de ? "Praxisdokumente (Liste)" : "Practice documents (list)",
      source: "MedScoutX",
      columns: de
        ? ["Datum", "Praxis", "Titel", "Typ", "Status"]
        : ["Date", "Practice", "Title", "Type", "Status"],
      rows: docs.map((d) => [
        fmt(d.sharedAt),
        d.practiceProfile?.practiceName || "—",
        d.title,
        d.type,
        d.status,
      ]),
    };
  }

  if (type === "profile_sharing") {
    const links = await prisma.practicePatientLink.findMany({
      where: { patientUserId: uid },
      include: {
        practiceProfile: { select: { practiceName: true } },
      },
      orderBy: { linkedAt: "desc" },
      take: 50,
    });
    return {
      title: de ? "Datenfreigaben" : "Data sharing",
      source: "MedScoutX",
      columns: de
        ? ["Praxis", "Status", "Profilfreigabe", "Verknüpft seit"]
        : ["Practice", "Status", "Profile access", "Linked since"],
      rows: links.map((l) => [
        l.practiceProfile?.practiceName || "—",
        l.status,
        l.profileAccessGrantedAt && !l.profileAccessRevokedAt
          ? de
            ? "freigegeben"
            : "granted"
          : de
            ? "nicht freigegeben"
            : "not granted",
        fmt(l.linkedAt),
      ]),
    };
  }

  if (type === "activity") {
    const { events } = await listPatientActivity(uid, {});
    return activityDataset(events, de);
  }

  if (type === "data_requests") {
    const reqs = await prisma.patientDataRequest.findMany({
      where: { patientUserId: uid },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        type: true,
        status: true,
        createdAt: true,
        practiceProfile: { select: { practiceName: true } },
      },
    });
    return {
      title: de ? "Datenanfragen" : "Data requests",
      source: "MedScoutX",
      columns: de
        ? ["Datum", "Praxis", "Typ", "Status"]
        : ["Date", "Practice", "Type", "Status"],
      rows: reqs.map((r) => [
        fmt(r.createdAt),
        r.practiceProfile?.practiceName || "—",
        r.type,
        r.status,
      ]),
    };
  }

  throw new Error("validation_invalid_export_type");
}

/**
 * @param {object} ctx
 * @param {string} type
 * @param {boolean} de
 */
async function collectPracticeExport(ctx, type, de) {
  const pid = String(ctx.practiceProfileId || "").trim();
  const linkId = String(ctx.practicePatientLinkId || "").trim();
  if (!pid) throw new Error("practiceId_required");

  const practice = await prisma.practiceProfile.findUnique({
    where: { id: pid },
    select: { practiceName: true },
  });
  const source = practice?.practiceName || "MedScoutX";

  if (type === "patient_summary") {
    if (!linkId) throw new Error("linkId_required");
    const link = await prisma.practicePatientLink.findFirst({
      where: { id: linkId, practiceProfileId: pid },
      include: {
        patientUser: { select: { id: true, email: true, firstName: true, lastName: true } },
        patientProfile: { select: { displayName: true } },
      },
    });
    if (!link) throw new Error("link_not_found");
    const overview = await getPracticePatientOverview(linkId, pid);
    const threads = await prisma.practicePatientThread.findMany({
      where: { practicePatientLinkId: linkId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { subject: true, status: true, updatedAt: true },
    });

    const name =
      link.patientProfile?.displayName ||
      [link.patientUser?.firstName, link.patientUser?.lastName].filter(Boolean).join(" ") ||
      "—";

    const summaryRows = [
      [de ? "Name" : "Name", name],
      [de ? "Status" : "Status", link.status],
      [de ? "Letzte Aktivität" : "Last activity", fmt(overview.lastActivityAt)],
      [de ? "Dokumente" : "Documents", String(overview.documentCount)],
      [de ? "Nachrichten" : "Messages", String(overview.messageCount)],
      [de ? "Pre-Visits" : "Pre-visits", String(overview.preVisitCount)],
      [
        de ? "Profilfreigabe" : "Profile sharing",
        overview.profileAccessGranted
          ? de
            ? "aktiv"
            : "active"
          : de
            ? "inaktiv"
            : "inactive",
      ],
    ];

    const threadRows = threads.map((t) => [
      fmt(t.updatedAt),
      t.subject || "—",
      t.status,
    ]);

    return {
      title: de ? "Patient:innenakte — Übersicht" : "Patient record — summary",
      subtitle: name,
      source,
      columns: de ? ["Feld", "Wert"] : ["Field", "Value"],
      rows: [
        ...summaryRows,
        ["", ""],
        [de ? "— Nachrichten (Betreff)" : "— Messages (subject)"],
        ...(threadRows.length
          ? threadRows.map((r) => [r[0], `${r[1]} (${r[2]})`])
          : [[de ? "Keine" : "None", "—"]]),
      ],
    };
  }

  if (type === "medication_plan") {
    if (!linkId) throw new Error("linkId_required");
    const plan = await prisma.medicationPlan.findFirst({
      where: {
        practicePatientLinkId: linkId,
        practiceProfileId: pid,
        status: "published",
      },
      orderBy: { publishedAt: "desc" },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!plan) {
      return {
        title: de ? "Medikationsplan" : "Medication plan",
        source,
        columns: de ? ["Hinweis"] : ["Note"],
        rows: [[de ? "Kein veröffentlichter Plan" : "No published plan"]],
      };
    }
    return {
      title: de ? "Medikationsplan" : "Medication plan",
      subtitle: plan.title || "—",
      source,
      columns: de
        ? ["Eintrag", "Dosierung", "Häufigkeit", "Zeitplan"]
        : ["Entry", "Dosage", "Frequency", "Schedule"],
      rows: plan.items.map((it, i) => [
        it.medicationName || `Item ${i + 1}`,
        it.dosage || "—",
        it.frequency || "—",
        it.schedule || "—",
      ]),
    };
  }

  if (type === "documents_list") {
    if (!linkId) throw new Error("linkId_required");
    const docs = await prisma.practiceDocument.findMany({
      where: {
        practicePatientLinkId: linkId,
        status: { not: "deleted" },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { title: true, type: true, status: true, sharedAt: true, createdAt: true },
    });
    return {
      title: de ? "Dokumentenliste" : "Documents list",
      source,
      columns: de
        ? ["Datum", "Titel", "Typ", "Status"]
        : ["Date", "Title", "Type", "Status"],
      rows: docs.map((d) => [fmt(d.sharedAt || d.createdAt), d.title, d.type, d.status]),
    };
  }

  if (type === "activity") {
    if (!linkId) throw new Error("linkId_required");
    const { events } = await listPracticeLinkActivity(linkId, pid, {});
    return activityDataset(events, de);
  }

  if (type === "data_requests") {
    const where = linkId
      ? { practicePatientLinkId: linkId, practiceProfileId: pid }
      : { practiceProfileId: pid };
    const reqs = await prisma.patientDataRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        type: true,
        status: true,
        createdAt: true,
        practicePatientLinkId: true,
      },
    });
    return {
      title: de ? "Datenanfragen" : "Data requests",
      source,
      columns: de
        ? ["Datum", "Typ", "Status", "Link-ID"]
        : ["Date", "Type", "Status", "Link ID"],
      rows: reqs.map((r) => [
        fmt(r.createdAt),
        r.type,
        r.status,
        r.practicePatientLinkId || "—",
      ]),
    };
  }

  throw new Error("validation_invalid_export_type");
}

/**
 * @param {Array<{ type: string, occurredAt: string | Date, action?: string }>} events
 * @param {boolean} de
 */
function activityDataset(events, de) {
  return {
    title: de ? "Aktivitätsprotokoll" : "Activity log",
    source: "MedScoutX",
    columns: de ? ["Datum", "Typ", "Referenz"] : ["Date", "Type", "Reference"],
    rows: events.map((e) => {
      const reg = e.action ? registryForAction(e.action) : null;
      const label = reg?.activityType || e.type || "—";
      return [fmt(e.occurredAt), label, e.type || "—"];
    }),
  };
}
