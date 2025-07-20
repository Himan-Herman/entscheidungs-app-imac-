import express from 'express';
import OpenAI from 'openai';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', async (req, res) => {
  const { frage } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Du bist ein medizinischer KI-Assistent.' },
        { role: 'user', content: frage }
      ]
    });

    res.json({ antwort: completion.choices[0].message.content });
  } catch (error) {
    console.error('Fehler bei Symptomanalyse:', error.message);
    res.status(500).json({ fehler: 'Fehler bei Symptomanalyse.' });
  }
});

export default router;
