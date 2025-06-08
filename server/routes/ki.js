import express from 'express';
import { frageOpenAI } from '../openaiClient.js'; // ✅

const router = express.Router();

router.post('/', async (req, res) => {
  const { verlauf } = req.body;

  if (!verlauf || !Array.isArray(verlauf)) {
    return res.status(400).json({ error: 'Verlauf fehlt oder ist ungültig' });
  }

  try {
    const antwort = await frageOpenAI(verlauf); // ✅
    res.json({ antwort });
  } catch (error) {
    console.error('KI-Fehler:', error);
    res.status(500).json({ error: 'KI-Antwort fehlgeschlagen' });
  }
});

export default router;
