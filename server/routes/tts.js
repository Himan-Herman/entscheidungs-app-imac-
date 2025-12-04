import express from "express";
import OpenAI from "openai";

const router = express.Router();

// OpenAI Client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/tts
router.post("/", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Text fehlt." });
    }

    // Anfrage an OpenAI TTS
    const audioResponse = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",     // OpenAI TTS Modell
      voice: "alloy",               // Stimme (kannst ändern)
      input: text,
      format: "mp3",
    });

    // MP3-Audio als Base64
    const audioBase64 = Buffer.from(await audioResponse.arrayBuffer()).toString("base64");

    res.json({ audio: audioBase64 });
  } catch (err) {
    console.error("TTS Fehler:", err);
    res.status(500).json({ error: "TTS fehlgeschlagen." });
  }
});

export default router;
