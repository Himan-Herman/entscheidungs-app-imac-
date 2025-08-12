import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Deine Assistant-ID
const assistant_id = "asst_iYNQijvS2n779FVOvCteIT18";

router.post("/", async (req, res) => {
  const { verlauf } = req.body;

  if (!Array.isArray(verlauf)) {
    return res.status(400).json({ antwort: "❌ Gesprächsverlauf fehlt oder ist ungültig." });
  }

  try {
    // 1. Neuen Thread erstellen
    const thread = await openai.beta.threads.create();

    // 2. Verlauf in den Thread schreiben
    for (const msg of verlauf) {
      await openai.beta.threads.messages.create(thread.id, {
        role: msg.role,
        content: msg.content
      });
    }

    // 3. Run starten
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id
    });

    // 4. Auf Abschluss warten
    let status = "queued";
    while (status !== "completed" && status !== "failed") {
      const lauf = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      status = lauf.status;
      if (status !== "completed") {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (status === "failed") {
      return res.status(500).json({ antwort: "❌ Assistant-Run fehlgeschlagen." });
    }

    // 5. Antwort holen
    const messages = await openai.beta.threads.messages.list(thread.id);
    const letzte = messages.data[0];
    const antwort = letzte.content[0].text.value;

    res.json({ antwort });

  } catch (err) {
    console.error("❌ Fehler im Thread:", err);
    res.status(500).json({ antwort: "❌ Fehler bei der KI-Verarbeitung (Thread)." });
  }
});

export default router;
