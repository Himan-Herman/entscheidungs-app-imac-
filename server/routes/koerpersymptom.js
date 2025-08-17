// server/routes/koerpersymptom.js
import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';

import { buildKoerpersymptomPrompt } from '../../client/src/pages/prompt/koerpersymptomPrompt.js';

dotenv.config();

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Optional: max. Anzahl Chatturns an die API (schützt vor zu langen Prompts)
const MAX_TURNS = 12;

router.post('/', async (req, res) => {
  try {
    const { verlauf, organ } = req.body;

    if (!Array.isArray(verlauf)) {
      return res.status(400).json({ fehler: 'Ungültiger Gesprächsverlauf (Array erwartet).' });
    }

    const organName = organ || 'die genannte Region';
    const userTurns = verlauf.filter(m => m?.role === 'user').length;

    // Nur die letzten N Nachrichten an die API senden (Performance & Kosten)
    const trimmed = verlauf.slice(-MAX_TURNS).map(m => ({
      role: m?.role || 'user',
      content: String(m?.content ?? '')
    }));

    const systemContent = buildKoerpersymptomPrompt({ organName, userTurns });
    const systemPrompt = { role: 'system', content: systemContent };

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',          // oder 'gpt-4o-mini' für günstigere Kosten
      messages: [systemPrompt, ...trimmed],
      temperature: 0.3,
    });

    const antwort = response?.choices?.[0]?.message?.content?.trim();
    if (!antwort) {
      return res.status(502).json({ fehler: 'Leere Antwort der KI.' });
    }

    res.json({ antwort });
  } catch (error) {
    console.error('Fehler bei Körpersymptom-Antwort:', error);
    const msg = error?.message || 'KI-Antwort fehlgeschlagen.';
    res.status(500).json({ fehler: msg });
  }
});

export default router;
