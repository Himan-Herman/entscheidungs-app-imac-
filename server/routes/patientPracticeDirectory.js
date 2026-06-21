/**
 * Internal MedScoutX practice directory — patient-facing, read-only.
 *
 * GET /api/patient/practices/directory
 *   ?q=<text>            full-text across name / specialty / city
 *   &specialty=<text>    filter by Fachrichtung
 *   &city=<text>         filter by city or postal code prefix
 *   &languages=de,tr     practice must list every given language (per practice profile)
 *   &bookingOnly=true    only practices with medscoutx_request booking active
 *
 * Returns public practice fields only. No patient data, no medical content.
 */

import express from "express";
import { searchMedScoutXPractices } from "../services/practiceDirectory/practiceDirectoryService.js";

const router = express.Router();

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

router.get("/", async (req, res) => {
  const uid = userIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const q = req.query.q ?? "";
    const specialty = req.query.specialty ?? "";
    const city = req.query.city ?? "";
    const languages = req.query.languages ?? "";
    const bookingOnly = req.query.bookingOnly === "true";

    const result = await searchMedScoutXPractices({ q, specialty, city, languages, bookingOnly });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "practice_directory_search_failed",
        reason: String(err?.message || "unknown").slice(0, 120),
      }),
    );
    return res.status(500).json({ ok: false, error: "search_failed" });
  }
});

export default router;
