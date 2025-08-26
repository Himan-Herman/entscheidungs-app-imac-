// server/routes/transcribe.js
import express from "express";
import { uploadAudio } from "../middleware/uploadAudio.js";
import { transcribeAutoWithWhisper } from "../services/whisperService.js";

const router = express.Router();

router.post("/", uploadAudio.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "NO_AUDIO", message: "Keine Audiodatei empfangen." });
    }

    const { buffer, originalname } = req.file;

    // Whisper mit Auto-Language Detection
    const result = await transcribeAutoWithWhisper(buffer, originalname || "audio.webm");

    return res.json({
      text: result.text,
      language: result.language, // z. B. "fa", "tr", "ku", "es", "it", "en", "de"
    });
  } catch (err) {
    console.error("[/api/transcribe] Fehler:", err?.message);
    return res.status(502).json({ error: "TRANSCRIPTION_FAILED", message: err?.message });
  }
});

export default router;
