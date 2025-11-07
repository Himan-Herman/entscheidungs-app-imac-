
import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { buildKoerpersymptomPrompt } from '../../client/src/pages/prompt/koerpersymptomPrompt.js';

dotenv.config();
const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  
});
if (!process.env.OPENAI_API_KEY) console.warn('[koerpersymptom] OPENAI_API_KEY fehlt');
if (!process.env.OPENAI_PROJECT_ID) console.warn('[koerpersymptom] OPENAI_PROJECT_ID fehlt');

const ASSISTANT_ID = process.env.ASSISTANT_ID_KOERPERSYMPTOM;


async function waitForRunCompletion(threadId, runId, timeoutMs = 20000, pollMs = 750) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
   
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

    
    for (const msg of verlauf) {
      await openai.beta.threads.messages.create(currentThreadId, {
        role: msg.role,
        content: msg.content
      });
    }

  
    const userTurns = verlauf.filter(v => v.role === "user").length;

    
    const systemPrompt = buildKoerpersymptomPrompt({ organName, userTurns });

    
    const run = await openai.beta.threads.runs.create(currentThreadId, {
      assistant_id: ASSISTANT_ID,
      instructions: systemPrompt
    });

    
    await waitForRunCompletion(run.thread_id, run.id, 30000, 600);

    
    const msgs = await openai.beta.threads.messages.list(currentThreadId, { limit: 10 });
    const assistantMsg = msgs.data.find(m => m.role === "assistant");

    res.json({
      threadId: currentThreadId,
      antwort: assistantMsg ? assistantMsg.content[0].text.value : " Keine Antwort erhalten."
    });

  } catch (e) {
    console.error("❌ Fehler:", e);
    res.status(500).json({ fehler: e.message });
  }
});


export default router;
