import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import OpenAI from 'openai';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', async (req, res) => {
  const { prompt, base64Bild } = req.body;
  console.log("✅ Prompt empfangen:", prompt);


  if (!base64Bild || typeof base64Bild !== 'string') {
    return res.status(400).json({ fehler: '❌ Kein gültiges Bild erhalten.' });
  }

  const messages = [
    {
      role: 'system',
      content: `
    🩺 Du bist ein medizinischer KI-Assistent. Ein Nutzer hat ein Bild einer Hautveränderung hochgeladen.
    
    Deine Aufgabe ist es, das Bild professionell zu beschreiben **und anschließend gezielte Rückfragen zu stellen**, so wie es ein erfahrener Arzt tun würde – z. B.:
    
    – Wo genau befindet sich die Stelle am Körper?  
    – Seit wann besteht das Symptom?  
    – Juckt, brennt oder nässt die Stelle?  
    – Gab es kürzlich Verletzungen, neue Kosmetikprodukte oder Kontakt mit Tieren?
    
    Stelle **nur eine Rückfrage pro Nachricht**.  
    ⚠️ Gib **keine Diagnose**, keine Medikamentennamen.  
    Wenn du **ausreichend Informationen** gesammelt hast, schlage eine passende **ärztliche Fachrichtung** vor (z. B. Dermatologe, Hausarzt).
    
    Antworte immer sachlich, freundlich und verständlich.
    `
    }
    ,
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
