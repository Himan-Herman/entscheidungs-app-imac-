import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import OpenAI from 'openai';
import { getBildanalysePrompt } from '../../client/src/pages/prompt/bildanalysePrompt.js';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let letztesBild = null; // Merkt sich das zuletzt analysierte Bild

router.post('/', async (req, res) => {
  const { prompt, base64Bild } = req.body;
  console.log("Prompt empfangen:", prompt);

  if (!base64Bild || typeof base64Bild !== 'string') {
    return res.status(400).json({ fehler: 'Kein gültiges Bild erhalten.' });
  }

  const istGleichesBild = base64Bild === letztesBild;
  if (!istGleichesBild) {
    letztesBild = base64Bild;
  }

  const systemPrompt = istGleichesBild
    ? 'Bitte stelle passende Rückfragen, aber beschreibe das Bild nicht erneut.'
    : getBildanalysePrompt();

  const messages = [
    {
      role: 'system',
      content: systemPrompt
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
      temperature: 0.2
    });

    let antwort = response.choices[0].message.content || '';
    antwort = antwort.replace(/\n/g, '<br/>');
    res.json({ antwort });
  } catch (error) {
    console.error('Fehler bei der Bildanalyse:', error.message);
    res.status(500).json({ fehler: 'Die KI konnte das Bild nicht analysieren.' });
  }
});

export default router;
