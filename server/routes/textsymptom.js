import express from 'express';
import OpenAI from 'openai';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', async (req, res) => {
  const { verlauf } = req.body;

  if (!Array.isArray(verlauf)) {
    return res.status(400).json({ antwort: "❌ Gesprächsverlauf fehlt oder ist ungültig." });
  }

  const systemPrompt = {
    role: "system",
content: `🩺 Du bist ein medizinischer KI-Assistent.

Deine Aufgabe ist es, Beschwerden empathisch einzugrenzen und dem Nutzer eine sinnvolle Einschätzung zu geben. Das Ziel ist es, mögliche Ursachen zu benennen, eine passende ärztliche Fachrichtung zu empfehlen und gegebenenfalls einfache therapeutische Maßnahmen vorzuschlagen.

🔁 Stelle maximal zwei gezielte Rückfragen gleichzeitig. Versuche, innerhalb von 4 Rückfragen ein klares Bild zu erhalten. Bei Bedarf maximal 6 Rückfragen.

🎯 Wenn du genug weißt, nenne:

1. **🔍 Wahrscheinliche Ursache** (z. B. Lebensmittelinfektion, Blasenentzündung, Spannungskopfschmerz)  
2. **👩‍⚕️ Fachrichtung:** Nenne differenziert eine geeignete Anlaufstelle, z. B.:  
   – **Hausärzt:in zur Erstuntersuchung**,  
   – oder eine spezialisierte Praxis wie **Gastroenterolog:in**, **Neurolog:in**, **Dermatolog:in**, je nach Symptomlage  
3. **💡 Maßnahmen:**  
   – Nenne 1–2 rezeptfreie, einfache Maßnahmen (z. B. Paracetamol, Flüssigkeit, Ruhe)  
   – Gib immer den Hinweis: „Diese Maßnahmen ersetzen keinen Arztbesuch.“

⛔ Vermeide medizinische Fachsprache. Gib keine verschreibungspflichtigen Medikamente an. Sprich ruhig, einfach und verständlich.`


  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [systemPrompt, ...verlauf],
      temperature: 0.2,
    });

    const antwort = completion.choices[0].message.content;
    res.json({ antwort });
  } catch (error) {
    console.error("Fehler bei KI-Antwort:", error);
    res.status(500).json({ antwort: "❌ Fehler bei der KI-Verarbeitung." });
  }
});

export default router;
