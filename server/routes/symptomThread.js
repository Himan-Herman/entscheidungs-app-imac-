import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';
//hier auch
import { symptomPromptText } from '../../client/src/pages/prompt/textsymptomPrompt.js';

dotenv.config();
const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = process.env.ASSISTANT_ID;


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


router.post('/', async (req, res) => {
  try {
    const { verlauf, threadId } = req.body;

    if (!Array.isArray(verlauf) || verlauf.length === 0) {
      return res.status(400).json({ fehler: 'Ungültiger oder leerer Verlauf.' });
    }

   
    let currentThreadId = null;
    if (threadId && typeof threadId === "string" && threadId.trim() !== "" && threadId !== "undefined" && threadId !== "null") {
      currentThreadId = threadId;
    } else {
      const t = await openai.beta.threads.create();
      currentThreadId = t.id;
    

    await openai.beta.threads.messages.create(currentThreadId, { //hier auch
      role: 'user',// hier auch
      content: symptomPromptText   //  Prompt hier kann irgenwann gelöscht werden/ wenn in asitent umlagern will.
    });
  }
    
    const last = verlauf[verlauf.length - 1];
    const content = typeof last?.content === 'string' ? last.content.trim() : '';
    if (!last || last.role !== 'user' || !content) {
      return res.status(400).json({ fehler: 'Letzte Nachricht muss vom Nutzer stammen.' });
    }

    await openai.beta.threads.messages.create(currentThreadId, {
      role: 'user',
      content
    });

   
    const run = await openai.beta.threads.runs.create(currentThreadId, {
      assistant_id: ASSISTANT_ID
    });

    
    
await waitForRunCompletion(run.thread_id, run.id, 30000, 600);


  
    const msgs = await openai.beta.threads.messages.list(currentThreadId, { limit: 5 });
    const assistantMsg = msgs.data.find(m => m.role === 'assistant');

    let antwort = '…';
    if (assistantMsg && Array.isArray(assistantMsg.content)) {
      const textParts = assistantMsg.content
        .filter(p => p.type === 'text' && p.text?.value)
        .map(p => p.text.value.trim());
      if (textParts.length) antwort = textParts.join('\n\n');
    }

    return res.json({ antwort, threadId: currentThreadId });
  } catch (err) {
    console.error('symptom-thread error:', err);
    return res.status(500).json({ fehler: 'Serverfehler in /api/symptom-thread.' });
  }
});

export default router;
