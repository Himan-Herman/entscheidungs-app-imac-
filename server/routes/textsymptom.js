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
    content: `🩺 Du bist ein professioneller medizinischer Assistent.
Deine Aufgabe ist es, auf die Symptome des Nutzers empathisch einzugehen und das Problem einzugrenzen.

🔁 Stelle maximal **zwei kurze Rückfragen auf einmal**.
🔚 Gib eine **Facharzt-Empfehlung** (z. B. Dermatologie, Neurologie), **sobald du genug weißt**.
⛔ **Stelle keine Rückfragen mehr**, wenn du bereits eine Empfehlung gibst.
🎯 Ziel: Klare, schrittweise Unterhaltung – nie überfordern – hilfsbereit sein.` },
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
