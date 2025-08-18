
import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { buildKoerpersymptomPrompt } from '../../client/src/pages/prompt/koerpersymptomPrompt.js';

dotenv.config();
const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = process.env.ASSISTANT_ID_KOERPERSYMPTOM;

// Helper: wartet bis ein Run fertig ist
async function waitForRunCompletion(threadId, runId, timeoutMs = 20000, pollMs = 750) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // NEUE SYNTAX: runId zuerst, Thread-ID als Option
    const run = await openai.beta.threads.runs.retrieve(runId, { thread_id: threadId });
    if (run.status === 'completed') return run;
    if (['failed', 'cancelled', 'expired'].includes(run.status)) {
      throw new Error(`Run status: ${run.status}`);
    }
    await new Promise(r => setTimeout(r, pollMs));
  }
  throw new Error('Run timeout');
}


router.post("/", async (req, res) => {
  const { verlauf, organName } = req.body;

  if (!Array.isArray(verlauf)) {
    return res.status(400).json({ antwort: "❌ Gesprächsverlauf fehlt oder ist ungültig." });
  }

  try {
    const currentThreadId = req.body.threadId || (await openai.beta.threads.create()).id;

    // Verlauf in den Thread schreiben
    for (const msg of verlauf) {
      await openai.beta.threads.messages.create(currentThreadId, {
        role: msg.role,
        content: msg.content
      });
    }

    // User-Turns zählen
    const userTurns = verlauf.filter(v => v.role === "user").length;

    // Prompt für diese Region bauen
    const systemPrompt = buildKoerpersymptomPrompt({ organName, userTurns });

    // 🟢 Run starten mit Prompt als Instructions
    const run = await openai.beta.threads.runs.create(currentThreadId, {
      assistant_id: ASSISTANT_ID,
      instructions: systemPrompt
    });

    // Warten bis fertig
    await waitForRunCompletion(run.thread_id, run.id, 30000, 600);

    // Antwort holen
    const msgs = await openai.beta.threads.messages.list(currentThreadId, { limit: 10 });
    const assistantMsg = msgs.data.find(m => m.role === "assistant");

    res.json({
      threadId: currentThreadId,
      antwort: assistantMsg ? assistantMsg.content[0].text.value : "⚠️ Keine Antwort erhalten."
    });

  } catch (e) {
    console.error("❌ Fehler:", e);
    res.status(500).json({ fehler: e.message });
  }
});


export default router;
