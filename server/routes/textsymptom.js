// server/routes/symptom.js
import express from 'express';
import OpenAI from 'openai';
import { symptomPromptText } from '../../client/src/pages/prompt/textsymptomPrompt.js';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', async (req, res) => {
  const { verlauf } = req.body;

  if (!Array.isArray(verlauf)) {
    return res.status(400).json({ antwort: "❌ Gesprächsverlauf fehlt oder ist ungültig." });
  }

  const systemPrompt = {
    role: "system",
    content: symptomPromptText
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [systemPrompt, ...verlauf],
      temperature: 0.2,
    });

    const antwort = completion.choices[0].message.content;
    res.json({ antwort });
  } catch (error) {
    console.error("Fehler bei KI-Antwort:", error);
    res.status(500).json({ antwort: "❌ Fehler bei der KI-Verarbeitung." });
  }
});

export default router;
