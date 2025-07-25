import express from 'express';
import OpenAI from 'openai';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', async (req, res) => {
  const { prompt } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Du bist ein professioneller medizinischer Assistent. Deine Aufgabe ist es, anhand der Symptome des Nutzers gezielte, kurze Rückfragen zu stellen – **nicht mehr als 2 Rückfragen auf einmal**. Ziel ist es, das Symptom klarer einzugrenzen und am Ende eine Empfehlung für die passende Facharzt-Richtung zu geben (z.B. Neurologie, Dermatologie, Orthopädie etc.).Verhalte dich wie ein empathischer Gesprächspartner: Stelle Rückfragen in natürlicher Sprache, gehe auf die Antwort des Nutzers ein, und führe das Gespräch Schritt für Schritt.Antworte erst dann mit einer Facharzt-Empfehlung, wenn du genügend Informationen gesammelt hast",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
    });

    const antwort = completion.choices[0].message.content;
    res.json({ antwort });
  } catch (error) {
    console.error("Fehler bei KI-Antwort:", error);
    res.status(500).json({ antwort: "❌ Fehler bei der KI-Verarbeitung." });
  }
});

// ❗ WICHTIG:
export default router;
