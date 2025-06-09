import express from 'express';
import { frageOpenAI } from '../openaiClient.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { verlauf, base64Bild } = req.body;

    console.log('📩 Verlauf:', verlauf);
    if (base64Bild) {
      console.log('🖼️ Bild (Base64) empfangen:', base64Bild.substring(0, 30) + '...');
    }

    const antwort = await frageOpenAI(verlauf);
    res.json({ antwort });
  } catch (error) {
    console.error('❌ Fehler in /api/ki:', error);
    res.status(500).json({ fehler: 'Serverfehler beim Verarbeiten der Anfrage.' });
  }
});

export default router;
