// server/routes/bildanalyseThread.js
import express from "express";
import OpenAI from "openai";

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Thread-Speicher im RAM (für Test) – in Produktion lieber DB
const store = new Map();

router.post("/start", async (_req, res) => {
  try {
    const thread = await openai.beta.threads.create();
    res.json({ threadId: thread.id });
  } catch (e) {
    console.error("[Bildanalyse/start]", e);
    res.status(500).json({ fehler: "Thread konnte nicht erstellt werden." });
  }
});

router.post("/message", async (req, res) => {
  const { threadId, prompt, base64Bild } = req.body;

  if (!threadId) return res.status(400).json({ fehler: "threadId fehlt." });
  if (!base64Bild) return res.status(400).json({ fehler: "Kein Bild erhalten." });

  try {
    // Prüfen, ob Bild schon im Thread vorkam
    const hash = base64Bild.slice(0, 120); // einfacher Fingerabdruck
    if (!store.has(threadId)) store.set(threadId, { lastImageHash: null });
    const entry = store.get(threadId);
    const istGleichesBild = entry.lastImageHash === hash;
    entry.lastImageHash = hash;

    // User-Nachricht mit Bild senden
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: [
        { type: "input_text", text: prompt || "Bitte analysiere dieses Bild." },
        { type: "input_image", image_url: base64Bild }
      ],
    });

    // Run starten
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.ASSISTANT_ID_BILDANALYSE,
      additional_instructions: istGleichesBild
        ? "Beschreibe das Bild nicht erneut. Stelle nur Rückfragen oder beziehe dich auf den bisherigen Verlauf."
        : undefined
    });

    // Warten bis fertig
    let completed;
    for (let i = 0; i < 30; i++) {
      const r = await openai.beta.threads.runs.retrieve(threadId, run.id);
      if (r.status === "completed") { completed = true; break; }
      if (["failed", "expired", "cancelled"].includes(r.status)) {
        throw new Error("Run fehlgeschlagen: " + r.status);
      }
      await new Promise(s => setTimeout(s, 1000));
    }
    if (!completed) throw new Error("Timeout beim Warten auf Antwort.");

    // Letzte Assistenten-Nachricht holen
    const msgs = await openai.beta.threads.messages.list(threadId, { order: "desc", limit: 5 });
    const assistantMsg = msgs.data.find(m => m.role === "assistant");
    const text = assistantMsg?.content?.map(c => c.text?.value).join("\n") || "";

    res.json({ antwort: text.replace(/\n/g, "<br/>") });
  } catch (e) {
    console.error("[Bildanalyse/message]", e);
    res.status(500).json({ fehler: "Fehler bei der Bildanalyse." });
  }
});

export default router;
