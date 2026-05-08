import express from "express";
import { PrismaClient } from "@prisma/client";
import { trackAnalyticsEvent } from "../services/analyticsService.js";

const prisma = new PrismaClient();
const router = express.Router();

router.get("/qr/:qrToken", async (req, res) => {
  const qrToken = String(req.params.qrToken || "").trim();
  if (!qrToken) return res.status(400).json({ ok: false, error: "invalid_qr" });

  const target = await prisma.practiceQrTarget.findUnique({
    where: { qrToken },
    include: { practiceProfile: true },
  });
  if (!target || !target.practiceProfile) {
    return res.status(404).json({ ok: false, error: "not_found" });
  }

  const practice = target.practiceProfile;
  void trackAnalyticsEvent({
    eventType: "qr_landing_opened",
    practiceId: practice.id,
    metadata: {
      targetType: target.targetType || undefined,
      hasPracticeContext: true,
    },
  });
  return res.json({
    ok: true,
    data: {
      practiceName: practice.practiceName,
      logoUrl: practice.logoUrl,
      address: practice.address,
      phone: practice.phone,
      website: practice.website,
      specialty: practice.specialty,
      patientIntroText: practice.patientIntroText,
      targetName: target.targetName,
      targetType: target.targetType,
      doctorName: target.doctorName,
      targetSpecialty: target.specialty,
      preferredDoctorLanguage:
        target.preferredDoctorLanguage || practice.preferredDoctorLanguage || "de",
      isActive: Boolean(practice.isActive && target.isActive),
    },
  });
});

export default router;

