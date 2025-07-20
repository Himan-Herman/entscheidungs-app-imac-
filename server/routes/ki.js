import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import OpenAI from 'openai';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', async (req, res) => {
  const { prompt, base64Bild } = req.body;

  try {
    // Baue dynamisch den Content je nachdem ob Bild vorhanden
    const userContent = [{ type: "text", text: prompt }];

    if (base64Bild) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: base64Bild,
        },
      });
    }

    const messages = [
      { role: "system", content: "Du bist ein medizinischer KI-Assistent für Hautbilder oder Symptome." },
      { role: "user", content: userContent }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
    });

    res.json({ antwort: completion.choices[0].message.content });

  } catch (error) {
    console.error("KI-Fehler:", error.message);
    res.status(500).json({ fehler: 'Fehler bei der KI-Verarbeitung.' });
  }
});

export default router;
