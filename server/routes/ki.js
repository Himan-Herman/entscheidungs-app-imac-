import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import OpenAI from 'openai';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', async (req, res) => {
  const { base64Bild, verlauf } = req.body;

  if (!verlauf || !Array.isArray(verlauf)) {
    return res.status(400).json({ fehler: 'Ungültiger Gesprächsverlauf.' });
  }

  try {
    const systemPrompt = {
      role: "system",
      content: `Du bist ein medizinischer Assistent für die Analyse von Bildern und Symptomen.

🔬 Du kannst Hautbilder, CT/MRT/PET/SPECT, EKG (PQRST), Ultraschall und pathologische Aufnahmen analysieren.

🧠 Vorgehen:
- Analysiere beim ersten Schritt ggf. das Bild.
- Stelle maximal 2 Rückfragen.
- Empfehle erst später eine Fachrichtung.
- Keine Diagnose, nur Analyse.`
    };

    const messages = [systemPrompt, ...verlauf];
 image_url
    if (base64Bild) {
      messages.push({
        role: "user",
        content: {
          type: "image_url",
          image_url: { url: base64Bild }
        }
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages
    });

    res.json({ antwort: completion.choices[0].message.content });

  } catch (error) {
    console.error("KI-Fehler:", error);
    res.status(500).json({ fehler: 'Fehler bei der KI-Verarbeitung: ' + error.message });
  }
});

export default router;
