/**
 * Patient account portal — dashboard overview, personal settings, family profiles, document index.
 * Identity: req.user.userId only; never trust client body user ids.
 */

import express from "express";
import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../services/auditLogService.js";

const prisma = new PrismaClient();
const router = express.Router();

const DELETE_PREVISIT_CONFIRM = "DELETE_MY_PREVISIT_DATA";

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function profileJson(row) {
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.displayName,
    relationLabel: row.relationLabel,
    dateOfBirth: row.dateOfBirth?.toISOString?.() ?? row.dateOfBirth,
    genderOrSalutation: row.genderOrSalutation,
    preferredPatientLanguage: row.preferredPatientLanguage,
    preferredDoctorLanguage: row.preferredDoctorLanguage,
    isArchived: row.isArchived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function sessionPreview(row) {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    status: row.status,
    pdfDownloaded: row.pdfDownloaded,
    patientLanguage: row.patientLanguage,
    practiceName: row.practiceProfile?.practiceName ?? null,
    patientProfileLabel: row.patientProfile
      ? `${row.patientProfile.displayName} (${row.patientProfile.relationLabel})`
      : null,
  };
}

/** GET /overview */
router.get("/overview", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const [
      recentSessions,
      caseRows,
      contacts,
      openThreads,
      docSessions,
    ] = await Promise.all([
      prisma.preVisitSession.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          practiceProfile: { select: { practiceName: true } },
          patientProfile: {
            select: { displayName: true, relationLabel: true },
          },
        },
      }),
      prisma.preVisitCase.findMany({
        where: { userId, isArchived: false },
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: { _count: { select: { sessions: true } } },
      }),
      prisma.doctorContact.findMany({
        where: { userId },
        orderBy: [{ isFavorite: "desc" }, { lastUsedAt: "desc" }, { updatedAt: "desc" }],
        take: 8,
      }),
      prisma.preVisitFollowUpThread.findMany({
        where: {
          patientUserId: userId,
          status: { in: ["open", "waiting_for_patient"] },
          isArchived: false,
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: {
          practiceProfile: { select: { id: true, practiceName: true } },
          session: { select: { id: true, title: true } },
        },
      }),
      prisma.preVisitSession.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          status: true,
          pdfDownloaded: true,
          practiceProfile: { select: { practiceName: true } },
        },
      }),
    ]);

    const activeCasesCount = await prisma.preVisitCase.count({
      where: { userId, isArchived: false },
    });

    return res.json({
      ok: true,
      recentSessions: recentSessions.map(sessionPreview),
      cases: caseRows.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
        sessionCount: c._count.sessions,
      })),
      activeCasesCount,
      doctorContacts: contacts.map((d) => ({
        id: d.id,
        doctorName: d.doctorName,
        practiceName: d.practiceName,
        isFavorite: d.isFavorite,
        lastUsedAt: d.lastUsedAt,
      })),
      openFollowUps: openThreads.map((t) => ({
        id: t.id,
        status: t.status,
        title: t.title,
        practiceName: t.practiceProfile?.practiceName ?? null,
        sessionId: t.session?.id ?? null,
        sessionTitle: t.session?.title ?? null,
        updatedAt: t.updatedAt,
      })),
      documentPreviews: docSessions.map((s) => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
        pdfDownloaded: s.pdfDownloaded,
        status: s.status,
        practiceName: s.practiceProfile?.practiceName ?? null,
      })),
    });
  } catch (err) {
    console.error("[account/overview]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** GET /patient-settings */
router.get("/patient-settings", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) return res.status(404).json({ ok: false, error: "not_found" });

    const p = user.profile;
    return res.json({
      ok: true,
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        dateOfBirth: user.dateOfBirth?.toISOString?.() ?? user.dateOfBirth,
      },
      profile: p
        ? {
            phone: p.phone,
            addressLine: p.addressLine,
            postalCode: p.postalCode,
            city: p.city,
            country: p.country,
            insuranceType: p.insuranceType,
            gender: p.gender,
            genderOrSalutation: p.genderOrSalutation,
            displayName: p.displayName,
            preferredPatientLanguage: p.preferredPatientLanguage,
            preferredDoctorLanguage: p.preferredDoctorLanguage,
            emergencyNote: p.emergencyNote,
          }
        : null,
    });
  } catch (err) {
    console.error("[account/patient-settings GET]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** PUT /patient-settings */
router.put("/patient-settings", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const b = req.body || {};
  try {
    const userData = {};
    if (typeof b.firstName === "string") userData.firstName = b.firstName.trim().slice(0, 80);
    if (typeof b.lastName === "string") userData.lastName = b.lastName.trim().slice(0, 80);
    if (b.dateOfBirth != null && b.dateOfBirth !== "") {
      const d = new Date(b.dateOfBirth);
      if (!Number.isNaN(d.getTime())) userData.dateOfBirth = d;
    }

    const profileData = {};
    const str = (v, max) =>
      v === null || v === ""
        ? null
        : typeof v === "string"
          ? v.trim().slice(0, max) || null
          : undefined;
    const opt = (key, max) => {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return;
      const v = str(b[key], max);
      if (v !== undefined) profileData[key] = v;
    };

    opt("phone", 40);
    opt("addressLine", 500);
    opt("postalCode", 20);
    opt("city", 120);
    opt("country", 80);
    opt("insuranceType", 80);
    opt("gender", 40);
    opt("genderOrSalutation", 80);
    opt("displayName", 120);
    opt("preferredPatientLanguage", 12);
    opt("preferredDoctorLanguage", 12);
    opt("emergencyNote", 2000);

    if (Object.keys(userData).length) {
      await prisma.user.update({ where: { id: userId }, data: userData });
    }

    if (Object.keys(profileData).length) {
      await prisma.userProfile.upsert({
        where: { userId },
        create: { userId, ...profileData },
        update: profileData,
      });
    }

    writeAuditLog({
      req,
      userId,
      action: "patient_settings_updated",
      entityType: "User",
      entityId: userId,
      metadata: {},
    });

    const next = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    return res.json({
      ok: true,
      user: {
        email: next.email,
        firstName: next.firstName,
        lastName: next.lastName,
        dateOfBirth: next.dateOfBirth?.toISOString?.() ?? next.dateOfBirth,
      },
      profile: next.profile
        ? {
            phone: next.profile.phone,
            addressLine: next.profile.addressLine,
            postalCode: next.profile.postalCode,
            city: next.profile.city,
            country: next.profile.country,
            insuranceType: next.profile.insuranceType,
            gender: next.profile.gender,
            genderOrSalutation: next.profile.genderOrSalutation,
            displayName: next.profile.displayName,
            preferredPatientLanguage: next.profile.preferredPatientLanguage,
            preferredDoctorLanguage: next.profile.preferredDoctorLanguage,
            emergencyNote: next.profile.emergencyNote,
          }
        : null,
    });
  } catch (err) {
    console.error("[account/patient-settings PUT]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** GET /family-profiles */
router.get("/family-profiles", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const rows = await prisma.patientProfile.findMany({
      where: { userId, isArchived: false },
      orderBy: { updatedAt: "desc" },
    });
    return res.json({ ok: true, profiles: rows.map(profileJson) });
  } catch (err) {
    console.error("[account/family-profiles GET]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** POST /family-profiles */
router.post("/family-profiles", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const b = req.body || {};
  const displayName = String(b.displayName || "").trim().slice(0, 120);
  const relationLabel = String(b.relationLabel || "").trim().slice(0, 80);
  if (!displayName || !relationLabel) {
    return res.status(400).json({ ok: false, error: "fields_required" });
  }

  let dateOfBirth = null;
  if (b.dateOfBirth) {
    const d = new Date(b.dateOfBirth);
    if (!Number.isNaN(d.getTime())) dateOfBirth = d;
  }

  try {
    const row = await prisma.patientProfile.create({
      data: {
        userId,
        displayName,
        relationLabel,
        dateOfBirth,
        genderOrSalutation:
          b.genderOrSalutation == null || b.genderOrSalutation === ""
            ? null
            : String(b.genderOrSalutation).trim().slice(0, 80) || null,
        preferredPatientLanguage:
          typeof b.preferredPatientLanguage === "string"
            ? b.preferredPatientLanguage.trim().slice(0, 12) || null
            : null,
        preferredDoctorLanguage:
          typeof b.preferredDoctorLanguage === "string"
            ? b.preferredDoctorLanguage.trim().slice(0, 12) || null
            : null,
      },
    });
    writeAuditLog({
      req,
      userId,
      action: "patient_family_profile_created",
      entityType: "PatientProfile",
      entityId: row.id,
      metadata: {},
    });
    return res.status(201).json({ ok: true, profile: profileJson(row) });
  } catch (err) {
    console.error("[account/family-profiles POST]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** PUT /family-profiles/:id */
router.put("/family-profiles/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const existing = await prisma.patientProfile.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  const b = req.body || {};
  const data = {};
  if (Object.prototype.hasOwnProperty.call(b, "displayName")) {
    const v = String(b.displayName || "").trim().slice(0, 120);
    if (!v) return res.status(400).json({ ok: false, error: "displayName_required" });
    data.displayName = v;
  }
  if (Object.prototype.hasOwnProperty.call(b, "relationLabel")) {
    data.relationLabel = String(b.relationLabel || "").trim().slice(0, 80);
  }
  if (Object.prototype.hasOwnProperty.call(b, "dateOfBirth")) {
    if (b.dateOfBirth === null || b.dateOfBirth === "") data.dateOfBirth = null;
    else {
      const d = new Date(b.dateOfBirth);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ ok: false, error: "dob_invalid" });
      data.dateOfBirth = d;
    }
  }
  if (Object.prototype.hasOwnProperty.call(b, "genderOrSalutation")) {
    data.genderOrSalutation =
      b.genderOrSalutation == null || b.genderOrSalutation === ""
        ? null
        : String(b.genderOrSalutation).trim().slice(0, 80);
  }
  if (Object.prototype.hasOwnProperty.call(b, "preferredPatientLanguage")) {
    data.preferredPatientLanguage =
      typeof b.preferredPatientLanguage === "string"
        ? b.preferredPatientLanguage.trim().slice(0, 12) || null
        : null;
  }
  if (Object.prototype.hasOwnProperty.call(b, "preferredDoctorLanguage")) {
    data.preferredDoctorLanguage =
      typeof b.preferredDoctorLanguage === "string"
        ? b.preferredDoctorLanguage.trim().slice(0, 12) || null
        : null;
  }
  if (Object.prototype.hasOwnProperty.call(b, "isArchived")) {
    data.isArchived = Boolean(b.isArchived);
  }

  if (!Object.keys(data).length) {
    return res.status(400).json({ ok: false, error: "no_fields" });
  }

  try {
    const row = await prisma.patientProfile.update({
      where: { id: existing.id },
      data,
    });
    return res.json({ ok: true, profile: profileJson(row) });
  } catch (err) {
    console.error("[account/family-profiles PUT]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** DELETE /family-profiles/:id — hard delete when no sessions reference */
router.delete("/family-profiles/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const existing = await prisma.patientProfile.findFirst({
      where: { id: req.params.id, userId },
      include: { _count: { select: { sessions: true } } },
    });
    if (!existing) return res.status(404).json({ ok: false, error: "not_found" });
    if (existing._count.sessions > 0) {
      await prisma.patientProfile.update({
        where: { id: existing.id },
        data: { isArchived: true },
      });
      return res.json({ ok: true, archived: true });
    }
    await prisma.patientProfile.delete({ where: { id: existing.id } });
    return res.json({ ok: true, deleted: true });
  } catch (err) {
    console.error("[account/family-profiles DELETE]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** GET /patient-documents — aggregated metadata (no binary storage) */
router.get("/patient-documents", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const sessions = await prisma.preVisitSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        practiceProfile: { select: { practiceName: true } },
        patientProfile: { select: { displayName: true } },
      },
    });

    const deliveries = await prisma.secureDocumentDelivery.findMany({
      where: { preVisitSession: { userId } },
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        practiceProfile: { select: { practiceName: true } },
        preVisitSession: { select: { id: true, title: true } },
      },
    });

    const prepDocs = sessions.map((s) => {
      let docStatus = "created";
      if (s.status === "draft" && !s.pdfDownloaded) docStatus = "draft";
      else if (s.pdfDownloaded || s.status === "pdf_created" || s.status === "completed") {
        docStatus = "created";
      }
      return {
        kind: "preparation",
        id: `session:${s.id}`,
        sessionId: s.id,
        title: s.title || "Pre-Visit",
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        practiceName: s.practiceProfile?.practiceName ?? null,
        patientProfileName: s.patientProfile?.displayName ?? null,
        pdfDownloaded: s.pdfDownloaded,
        status: docStatus,
      };
    });

    const linkDocs = deliveries.map((d) => {
      let st = "shared_link";
      if (d.revokedAt) st = "revoked";
      else if (d.expiresAt.getTime() < Date.now()) st = "expired";
      return {
        kind: "secure_link",
        id: `delivery:${d.id}`,
        deliveryId: d.id,
        sessionId: d.preVisitSessionId,
        sessionTitle: d.preVisitSession?.title ?? null,
        practiceName: d.practiceProfile?.practiceName ?? null,
        createdAt: d.createdAt,
        expiresAt: d.expiresAt.toISOString(),
        downloadedAt: d.downloadedAt?.toISOString?.() ?? null,
        status: st,
      };
    });

    const merged = [...linkDocs, ...prepDocs].sort((a, b) => {
      const tb = new Date(b.createdAt ?? b.updatedAt ?? 0).getTime();
      const ta = new Date(a.createdAt ?? a.updatedAt ?? 0).getTime();
      return tb - ta;
    });

    return res.json({ ok: true, documents: merged.slice(0, 120) });
  } catch (err) {
    console.error("[account/patient-documents]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** POST /delete-previsit-data */
router.post("/delete-previsit-data", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const confirmation = String(req.body?.confirmation ?? "").trim();
  if (confirmation !== DELETE_PREVISIT_CONFIRM) {
    return res.status(400).json({ ok: false, error: "confirmation_required" });
  }

  writeAuditLog({
    req,
    userId,
    action: "patient_previsit_data_delete_requested",
    metadata: {},
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.preVisitSession.deleteMany({ where: { userId } });
      await tx.preVisitCase.deleteMany({ where: { userId } });
    });
    return res.json({ ok: true, deleted: true, scope: "previsit_sessions_cases_followups" });
  } catch (err) {
    console.error("[account/delete-previsit-data]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
