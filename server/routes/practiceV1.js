import express from "express";
import { requirePracticeApiAuth, requireApiScope } from "../middleware/requirePracticeApiAuth.js";
import {
  v1GetPatientLink,
  v1GetPracticeMe,
  v1ListAppointments,
  v1ListAuditMetadata,
  v1ListDataRequests,
  v1ListDocumentsMetadata,
  v1ListMedicationPlansMetadata,
  v1ListMessageThreadsMetadata,
  v1ListPatients,
} from "../services/practiceDeveloper/practiceV1ApiService.js";

const router = express.Router();

router.use(requirePracticeApiAuth);

router.get("/me", requireApiScope("read:practice"), async (req, res) => {
  try {
    const data = await v1GetPracticeMe(req.practiceApi.practiceProfileId);
    return res.json({ ok: true, practice: data });
  } catch (e) {
    const status = e.message === "not_found" ? 404 : 500;
    return res.status(status).json({ ok: false, error: e.message || "request_failed" });
  }
});

router.get("/patients", requireApiScope("read:patients_metadata"), async (req, res) => {
  try {
    const patients = await v1ListPatients(req.practiceApi.practiceProfileId);
    return res.json({ ok: true, patients });
  } catch (e) {
    if (e.message === "consent_required") {
      return res.status(403).json({ ok: false, error: "consent_required" });
    }
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

router.get("/patients/:linkId", requireApiScope("read:patients_metadata"), async (req, res) => {
  try {
    const patient = await v1GetPatientLink(
      req.practiceApi.practiceProfileId,
      req.params.linkId,
    );
    return res.json({ ok: true, patient });
  } catch (e) {
    if (e.message === "consent_required") {
      return res.status(403).json({ ok: false, error: "consent_required" });
    }
    if (e.message === "not_found") return res.status(404).json({ ok: false, error: "not_found" });
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

router.get("/appointments", requireApiScope("read:appointments"), async (req, res) => {
  try {
    const appointments = await v1ListAppointments(req.practiceApi.practiceProfileId);
    return res.json({ ok: true, appointments });
  } catch {
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

router.get("/documents", requireApiScope("read:documents_metadata"), async (req, res) => {
  try {
    const documents = await v1ListDocumentsMetadata(req.practiceApi.practiceProfileId);
    return res.json({ ok: true, documents });
  } catch {
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

router.get("/medication-plans", requireApiScope("read:medication_metadata"), async (req, res) => {
  try {
    const plans = await v1ListMedicationPlansMetadata(req.practiceApi.practiceProfileId);
    return res.json({ ok: true, plans });
  } catch {
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

router.get("/messages/threads", requireApiScope("read:messages_metadata"), async (req, res) => {
  try {
    const threads = await v1ListMessageThreadsMetadata(req.practiceApi.practiceProfileId);
    return res.json({ ok: true, threads });
  } catch {
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

router.get("/data-requests", requireApiScope("read:patients_metadata"), async (req, res) => {
  try {
    const dataRequests = await v1ListDataRequests(req.practiceApi.practiceProfileId);
    return res.json({ ok: true, dataRequests });
  } catch {
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

router.get("/audit-events", requireApiScope("read:audit_metadata"), async (req, res) => {
  try {
    const events = await v1ListAuditMetadata(req.practiceApi.practiceProfileId);
    return res.json({ ok: true, events });
  } catch {
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
