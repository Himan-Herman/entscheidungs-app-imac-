/**
 * The patient's own practice contexts — GET /api/patient/practice-contexts
 *
 * Feeds the practice chooser and the switcher. Scope is the session user; there
 * is no query parameter that widens it, and this is not a practice search.
 */

import express from "express";
import { listPatientPracticeContexts } from "../services/careRelationship/patientPracticeDirectoryService.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const userId = req.user?.userId;
  if (typeof userId !== "string" || !userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    const { contexts } = await listPatientPracticeContexts(userId);
    return res.json({ ok: true, contexts });
  } catch (err) {
    console.error("[patient/practice-contexts]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
