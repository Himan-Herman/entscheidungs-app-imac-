import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();
const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const systemPrompt = {
  role: "system",
  content: `Du bist ein medizinischer Assistent.
Der Nutzer hat "Darm" als betroffene Region gewählt.

Deine Aufgabe ist es, gezielte medizinische Rückfragen zu stellen, um die Ursache besser zu verstehen. 
Stelle jeweils maximal 2 Rückfragen gleichzeitig.

Frage z. B. nach:
– Art der Beschwerden (z. B. Krämpfe, Durchfall, Blähungen, Übelkeit)
– Dauer und Verlauf der Symptome
– Zusammenhang mit bestimmten Lebensmitteln oder Situationen
– Begleitsymptomen wie Fieber, Erbrechen, Blut im Stuhl, Schleim, Appetitverlust
– Kontakt mit erkrankten Personen
– Letzter Stuhlgang und Konsistenz (z. B. breiig, flüssig, auffällig)

Nutze einfache, verständliche Sprache und bitte den Nutzer um genaue Beschreibungen. 
Gib **noch keine Facharzt-Empfehlung**. Warte damit, bis du ein vollständiges Bild hast.`
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
      temperature: 0.3,
    });

    const antwort = response.choices[0].message.content;
    res.json({ antwort });
  } catch (error) {
    console.error('Fehler bei Körpersymptom-Antwort:', error);
    res.status(500).json({ fehler: 'KI-Antwort fehlgeschlagen.' });
  }
});

export default router;
