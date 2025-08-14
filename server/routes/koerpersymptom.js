import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';

// ⬇️ Prompt aus Frontend-Ordner laden
import { buildKoerpersymptomPrompt } from '../../client/src/pages/prompt/koerpersymptomPrompt.js';

dotenv.config();
const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', async (req, res) => {
  const { verlauf, organ } = req.body;
  const organName = organ || "die genannte Region";

  // Anzahl Nutzerantworten zählen
  const userTurns = Array.isArray(verlauf)
    ? verlauf.filter(m => m.role === "user").length
    : 0;

  // Basis-Validierung
  if (!verlauf || !Array.isArray(verlauf)) {
    return res.status(400).json({ fehler: 'Ungültiger Gesprächsverlauf.' });
  }

  // Prompt aus externer Datei holen
  const content = buildKoerpersymptomPrompt({ organName, userTurns });
  const systemPrompt = { role: 'system', content };

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [systemPrompt, ...verlauf],
      temperature: 0.3,
    });

    const antwort = response.choices[0].message.content;
    res.json({ antwort });
  } catch (error) {
    console.error('Fehler bei Körpersymptom-Antwort:', error);
    res.status(500).json({ fehler: 'KI-Antwort fehlgeschlagen.' });
  }
});

export default router;
