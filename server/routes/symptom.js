import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import OpenAI from 'openai';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', async (req, res) => {
  const { prompt, base64Bild } = req.body;

  if (!base64Bild || typeof base64Bild !== 'string') {
    return res.status(400).json({ fehler: '❌ Kein gültiges Bild erhalten.' });
  }

  const messages = [
    {
      role: 'system',
      content: '🩺 Du bist ein medizinischer KI-Assistent. Analysiere das hochgeladene Bild eines Hautbereichs. Stelle keine Diagnosen, aber beschreibe Auffälligkeiten sachlich und vorsichtig.'
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt || 'Was ist auf diesem Bild zu sehen?' },
        { type: 'image_url', image_url: { url: base64Bild } }
      ]
    }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.4
    });

    let antwort = response.choices[0].message.content || '';
    antwort = antwort.replace(/\n/g, '<br/>'); // Formatierung für Anzeige

    res.json({ antwort });
  } catch (error) {
    console.error('❌ Fehler bei der Bildanalyse:', error.message);
    res.status(500).json({ fehler: '❌ Die KI konnte das Bild nicht analysieren.' });
  }
});

export default router;
