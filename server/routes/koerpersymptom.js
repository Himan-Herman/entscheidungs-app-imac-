import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();
const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const systemPrompt = {
  role: "system",
  content: `Du bist ein medizinischer Assistent.
Basierend auf der angeklickten Körperregion sollst du gezielte Rückfragen stellen, 
um das Problem genauer zu verstehen. 
⚠️ Maximal 2 Rückfragen gleichzeitig.
Empfehle erst später eine passende Fachrichtung.`
};

router.post('/', async (req, res) => {
  const { verlauf } = req.body;

  if (!verlauf || !Array.isArray(verlauf)) {
    return res.status(400).json({ fehler: 'Ungültiger Gesprächsverlauf.' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [systemPrompt, ...verlauf],
      temperature: 0.4,
    });

    const antwort = response.choices[0].message.content;
    res.json({ antwort });
  } catch (error) {
    console.error('Fehler bei Körpersymptom-Antwort:', error);
    res.status(500).json({ fehler: 'KI-Antwort fehlgeschlagen.' });
  }
});

export default router;
