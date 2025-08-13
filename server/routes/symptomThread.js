// server/routes/symptomThread.js
import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();
const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = process.env.ASSISTANT_ID || 'asst_iYNQijvS2n779FVOvCteIT18'; // ggf. anpassen

// kleines Helper: bis zu N Sekunden auf "completed" warten
async function waitForRunCompletion(threadId, runId, timeoutMs = 20000, pollMs = 750) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await openai.beta.threads.runs.retrieve(threadId, runId);
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

    // 1) Thread holen/erstellen
    let currentThreadId = threadId;
    if (!currentThreadId) {
      const t = await openai.beta.threads.create();
      currentThreadId = t.id;
    }

    // 2) Nur die neue User-Nachricht anhängen (du sendest ja [userMsg])
    const last = verlauf[verlauf.length - 1];
    const content = typeof last?.content === 'string' ? last.content.trim() : '';
    if (!last || last.role !== 'user' || !content) {
      return res.status(400).json({ fehler: 'Letzte Nachricht muss vom Nutzer stammen.' });
    }
    
    await openai.beta.threads.messages.create(currentThreadId, {
      role: 'user',
      content
    });

    // 3) Run starten
    const run = await openai.beta.threads.runs.create(currentThreadId, {
      assistant_id: ASSISTANT_ID
     
    });

    // 4) Warten bis fertig
    await waitForRunCompletion(currentThreadId, run.id, 30000, 600);

    // 5) Letzte Assistant-Antwort holen
    const msgs = await openai.beta.threads.messages.list(currentThreadId, { limit: 5 });
    // erste Assistant-Nachricht (messages sind absteigend sortiert)
    const assistantMsg = msgs.data.find(m => m.role === 'assistant');

    // Text extrahieren (Falls mehrere Blöcke vorhanden sind)
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
