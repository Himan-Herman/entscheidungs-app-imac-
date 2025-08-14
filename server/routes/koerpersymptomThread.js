import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🔹 Neue Assistant-ID für KörperSymptom
const assistant_id = "asst_xqwfaqoLEV5k6uVE8krrQUM7";

router.post("/", async (req, res) => {
  const { verlauf, threadId } = req.body;

  if (!Array.isArray(verlauf)) {
    return res.status(400).json({ antwort: "❌ Ungültiger Gesprächsverlauf." });
  }

  try {
    let currentThreadId = threadId;

    // Falls noch kein Thread existiert → neuen erstellen
    if (!currentThreadId) {
      const thread = await openai.beta.threads.create();
      currentThreadId = thread.id;
    }

    // Verlauf ins Thread schreiben
    for (const msg of verlauf) {
      await openai.beta.threads.messages.create(currentThreadId, {
        role: msg.role,
        content: msg.content
      });
    }

    // KI-Antwort generieren
    const run = await openai.beta.threads.runs.create(currentThreadId, {
      assistant_id
    });

    // Auf Antwort warten
    let runStatus;
    do {
      await new Promise((r) => setTimeout(r, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(currentThreadId, run.id);
    } while (runStatus.status !== "completed");

    // Letzte Nachricht abrufen
    const messages = await openai.beta.threads.messages.list(currentThreadId);
    const lastMsg = messages.data[0]?.content[0]?.text?.value || "⚠️ Keine Antwort erhalten.";

    res.json({ antwort: lastMsg, threadId: currentThreadId });
  } catch (error) {
    console.error("❌ Fehler im KörperSymptom-Thread:", error);
    res.status(500).json({ antwort: "❌ Serverfehler im KörperSymptom-Thread." });
  }
});

export default router;
