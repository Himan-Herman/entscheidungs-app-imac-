
import express from "express";
import { uploadAudio } from "../middleware/uploadAudio.js";
import { transcribeRouteLimiter } from "../middleware/ipRateLimit.js";
import { transcribeAutoWithWhisper } from "../services/whisperService.js";
import { logServerError } from "../utils/safeApiError.js";

const router = express.Router();

router.post("/", transcribeRouteLimiter, uploadAudio.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "NO_AUDIO", message: "Keine Audiodatei empfangen." });
    }

    const { buffer, originalname } = req.file;

    
    const result = await transcribeAutoWithWhisper(buffer, originalname || "audio.webm");

    return res.json({
      text: result.text,
      language: result.language, 
    });
  } catch (err) {
    logServerError("transcribe", err, req);
    return res.status(502).json({
      error: "TRANSCRIPTION_FAILED",
      message: "Transcription could not be completed.",
    });
  }
});

export default router;
