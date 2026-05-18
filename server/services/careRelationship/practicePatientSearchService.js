import { PrismaClient } from "@prisma/client";
import { LINK_STATUSES, linkToJson } from "./practicePatientLinkService.js";
import { enrichPracticePatientLinks } from "./practicePatientRecordService.js";
import { registryForAction } from "../activity/activityFeedRegistry.js";

const prisma = new PrismaClient();

const SORT_FIELDS = new Set(["activity", "name", "linkedAt", "status"]);
const MAX_FETCH = 500;

/**
 * @param {unknown} v
 */
function parseBoolFilter(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return undefined;
}

/**
 * @param {import('express').Request['query']} query
 */
export function parsePracticePatientSearchParams(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 25));
  const sortBy = SORT_FIELDS.has(String(query.sortBy || ""))
    ? String(query.sortBy)
    : "activity";
  const sortDirection =
    String(query.sortDirection || "").toLowerCase() === "asc" ? "asc" : "desc";

  const status = String(query.status || "").trim();
  const assignmentStatus = String(query.assignmentStatus || "").trim();
  const assignedToUserId = String(query.assignedToUserId || "").trim();
  const assignmentFilter = String(query.assignmentFilter || "").trim();
  return {
    q: String(query.q || "").trim().slice(0, 120),
    status: status && LINK_STATUSES.has(status) ? status : undefined,
    assignmentStatus: assignmentStatus || undefined,
    assignedToUserId: assignedToUserId || undefined,
    assignmentFilter: assignmentFilter || undefined,
    profileShared: parseBoolFilter(query.profileShared),
    hasUnreadMessages: parseBoolFilter(query.hasUnreadMessages),
    hasDocuments: parseBoolFilter(query.hasDocuments),
    hasMedicationPlan: parseBoolFilter(query.hasMedicationPlan),
    hasOpenDataRequest: parseBoolFilter(query.hasOpenDataRequest),
    sortBy,
    sortDirection,
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

/**
 * @param {string} q
 */
function buildTextSearchWhere(q) {
  if (!q) return {};
  const needle = q;
  const parts = needle.split(/\s+/).filter(Boolean);

  /** @type {import('@prisma/client').Prisma.PracticePatientLinkWhereInput[]} */
  const orConditions = [
    { id: { contains: needle, mode: "insensitive" } },
    { patientUserId: { contains: needle, mode: "insensitive" } },
    {
      patientUser: {
        email: { contains: needle, mode: "insensitive" },
      },
    },
  ];

  if (needle.length >= 8) {
    orConditions.push({ patientProfileId: { contains: needle, mode: "insensitive" } });
  }

  if (parts.length >= 2) {
    orConditions.push({
      patientUser: {
        AND: [
          { firstName: { contains: parts[0], mode: "insensitive" } },
          { lastName: { contains: parts.slice(1).join(" "), mode: "insensitive" } },
        ],
      },
    });
  }

  orConditions.push(
    { patientUser: { firstName: { contains: needle, mode: "insensitive" } } },
    { patientUser: { lastName: { contains: needle, mode: "insensitive" } } },
    {
      patientProfile: {
        displayName: { contains: needle, mode: "insensitive" },
      },
    },
    {
      AND: [
        { profileAccessGrantedAt: { not: null } },
        { profileAccessRevokedAt: null },
        {
          patientUser: {
            profile: {
              phone: { contains: needle, mode: "insensitive" },
            },
          },
        },
      ],
    },
  );

  return { OR: orConditions };
}

/**
 * @param {ReturnType<typeof parsePracticePatientSearchParams>} params
 */
function buildPrismaWhere(practiceProfileId, params) {
  /** @type {import('@prisma/client').Prisma.PracticePatientLinkWhereInput} */
  const where = {
    practiceProfileId,
    ...(params.status ? { status: params.status } : {}),
    ...buildTextSearchWhere(params.q),
  };

  if (params.hasDocuments === true) {
    where.practiceDocuments = { some: { status: "shared" } };
  } else if (params.hasDocuments === false) {
    where.practiceDocuments = { none: { status: "shared" } };
  }

  if (params.hasMedicationPlan === true) {
    where.medicationPlans = { some: { status: "published" } };
  } else if (params.hasMedicationPlan === false) {
    where.medicationPlans = { none: { status: "published" } };
  }

  if (params.hasOpenDataRequest === true) {
    where.patientDataRequests = {
      some: { status: { in: ["submitted", "in_review"] } },
    };
  } else if (params.hasOpenDataRequest === false) {
    where.patientDataRequests = {
      none: { status: { in: ["submitted", "in_review"] } },
    };
  }

  if (params.hasUnreadMessages === true) {
    where.threads = {
      some: {
        messages: {
          some: { senderType: "patient", readAt: null },
        },
      },
    };
  } else if (params.hasUnreadMessages === false) {
    where.threads = {
      none: {
        messages: {
          some: { senderType: "patient", readAt: null },
        },
      },
    };
  }

  if (params.assignmentStatus) {
    where.assignmentStatus = params.assignmentStatus;
  }

  if (params.assignedToUserId) {
    where.OR = [
      { assignedDoctorUserId: params.assignedToUserId },
      { assignedTeamMemberUserId: params.assignedToUserId },
    ];
  }

  if (params.assignmentFilter === "assigned_to_me" && params.assignedToUserId) {
    where.OR = [
      { assignedDoctorUserId: params.assignedToUserId },
      { assignedTeamMemberUserId: params.assignedToUserId },
      { patientSelectedDoctorUserId: params.assignedToUserId },
    ];
  } else if (params.assignmentFilter === "unassigned") {
    where.assignmentStatus = { in: ["unassigned", "forwarded"] };
    where.assignedDoctorUserId = null;
  }

  return where;
}

/**
 * @param {object} link enriched link row
 * @param {boolean | undefined} profileSharedFilter
 */
function matchesProfileSharedFilter(link, profileSharedFilter) {
  if (profileSharedFilter === undefined) return true;
  const granted = Boolean(link.profileAccessGranted);
  return profileSharedFilter ? granted : !granted;
}

/**
 * @param {object} a
 * @param {object} b
 * @param {ReturnType<typeof parsePracticePatientSearchParams>} params
 */
function compareLinks(a, b, params) {
  const dir = params.sortDirection === "asc" ? 1 : -1;
  const { sortBy } = params;

  if (sortBy === "name") {
    const nameA = [
      a.patientProfile?.displayName,
      a.patient?.firstName,
      a.patient?.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const nameB = [
      b.patientProfile?.displayName,
      b.patient?.firstName,
      b.patient?.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return nameA.localeCompare(nameB) * dir;
  }

  if (sortBy === "linkedAt") {
    return (
      (new Date(a.linkedAt).getTime() - new Date(b.linkedAt).getTime()) * dir
    );
  }

  if (sortBy === "status") {
    return String(a.status).localeCompare(String(b.status)) * dir;
  }

  const aAct = a.summary?.lastActivityAt || a.updatedAt;
  const bAct = b.summary?.lastActivityAt || b.updatedAt;
  return (new Date(aAct).getTime() - new Date(bAct).getTime()) * dir;
}

/**
 * @param {string} practiceProfileId
 * @param {import('express').Request['query']} query
 */
export async function searchPracticePatients(practiceProfileId, query = {}) {
  const params = parsePracticePatientSearchParams(query);
  const pid = String(practiceProfileId || "").trim();
  if (!pid) throw new Error("practiceId_required");

  const where = buildPrismaWhere(pid, params);

  const rows = await prisma.practicePatientLink.findMany({
    where,
    include: {
      patientUser: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      patientProfile: {
        select: { id: true, displayName: true, relationLabel: true },
      },
    },
    take: MAX_FETCH,
    orderBy: [{ linkedAt: "desc" }],
  });

  let links = await enrichPracticePatientLinks(rows.map(linkToJson));

  links = links.filter((link) => matchesProfileSharedFilter(link, params.profileShared));

  links.sort((a, b) => compareLinks(a, b, params));

  const total = links.length;
  const pageLinks = links.slice(params.offset, params.offset + params.limit);

  return {
    links: pageLinks,
    total,
    page: params.page,
    limit: params.limit,
    hasMore: params.offset + params.limit < total,
    filters: {
      q: params.q || null,
      status: params.status || null,
      profileShared: params.profileShared ?? null,
      hasUnreadMessages: params.hasUnreadMessages ?? null,
      hasDocuments: params.hasDocuments ?? null,
      hasMedicationPlan: params.hasMedicationPlan ?? null,
      hasOpenDataRequest: params.hasOpenDataRequest ?? null,
      sortBy: params.sortBy,
      sortDirection: params.sortDirection,
    },
  };
}

/**
 * Local record search — metadata only, no message bodies or file contents.
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {string} q
 */
export async function searchPracticePatientRecord(linkId, practiceProfileId, q) {
  const lid = String(linkId || "").trim();
  const pid = String(practiceProfileId || "").trim();
  const needle = String(q || "").trim().slice(0, 80).toLowerCase();
  if (!lid || !pid) throw new Error("validation_required");
  if (!needle) return { results: [] };

  const link = await prisma.practicePatientLink.findFirst({
    where: { id: lid, practiceProfileId: pid },
  });
  if (!link) throw new Error("link_not_found");

  const [documents, threads, plans, auditRows] = await Promise.all([
    prisma.practiceDocument.findMany({
      where: {
        practicePatientLinkId: lid,
        status: { not: "deleted" },
        title: { contains: needle, mode: "insensitive" },
      },
      select: { id: true, title: true, type: true, status: true },
      take: 20,
    }),
    prisma.practicePatientThread.findMany({
      where: {
        practicePatientLinkId: lid,
        subject: { contains: needle, mode: "insensitive" },
      },
      select: { id: true, subject: true, status: true },
      take: 20,
    }),
    prisma.medicationPlan.findMany({
      where: {
        practicePatientLinkId: lid,
        status: { not: "deleted" },
        title: { contains: needle, mode: "insensitive" },
      },
      select: { id: true, title: true, status: true },
      take: 20,
    }),
    prisma.auditLog.findMany({
      where: {
        practicePatientLinkId: lid,
        practiceProfileId: pid,
        visibility: { in: ["practice_visible", "patient_visible"] },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, action: true, entityType: true, createdAt: true },
    }),
  ]);

  /** @type {{ kind: string, id: string, label: string, tab: string }[]} */
  const results = [];

  for (const doc of documents) {
    results.push({
      kind: "document",
      id: doc.id,
      label: doc.title,
      tab: "documents",
    });
  }
  for (const th of threads) {
    results.push({
      kind: "thread",
      id: th.id,
      label: th.subject || "—",
      tab: "messages",
    });
  }
  for (const plan of plans) {
    results.push({
      kind: "medication_plan",
      id: plan.id,
      label: plan.title || "—",
      tab: "medication",
    });
  }

  for (const row of auditRows) {
    const reg = registryForAction(row.action);
    if (!reg || reg.visibility === "internal") continue;
    const activityType = reg.activityType || "";
    const haystack = `${activityType} ${row.action} ${row.entityType || ""}`.toLowerCase();
    if (!haystack.includes(needle)) continue;
    results.push({
      kind: "activity",
      id: row.id,
      label: activityType,
      tab: "activity",
    });
  }

  return { results: results.slice(0, 40) };
}

/**
 * Anonymized search hint for audit (no raw medical terms stored).
 * @param {string} q
 */
export function anonymizeSearchQueryForAudit(q) {
  const s = String(q || "").trim();
  if (!s) return null;
  if (s.length <= 3) return "[short]";
  return `[len:${s.length}]`;
}
