// server/routes/symptomThread.js
import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';

// TODO: Prompt besser in server/prompts/symptomPrompt.js legen
import { symptomPromptText } from '../../client/src/pages/prompt/textsymptomPrompt.js';

dotenv.config();
const router = express.Router();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID   = process.env.ASSISTANT_ID;

if (!OPENAI_API_KEY) {
  console.warn('[symptom-thread] WARN: OPENAI_API_KEY fehlt in ENV!');
}
if (!ASSISTANT_ID) {
  console.warn('[symptom-thread] WARN: ASSISTANT_ID fehlt in ENV!');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// korrekt: (threadId, runId)
async function waitForRunCompletion(threadId, runId, timeoutMs = 30000, pollMs = 600) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
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
    const { verlauf, threadId } = req.body || {};

    if (!Array.isArray(verlauf) || verlauf.length === 0) {
      return res.status(400).json({ ok: false, error: 'verlauf (Array) fehlt' });
    }
    if (!OPENAI_API_KEY || !ASSISTANT_ID) {
      return res.status(500).json({ ok: false, error: 'OPENAI_API_KEY oder ASSISTANT_ID fehlt (ENV)' });
    }

    // Thread bestimmen/erzeugen
    let currentThreadId = (typeof threadId === 'string' && threadId.trim()) ? threadId : null;
    if (!currentThreadId) {
      const t = await openai.beta.threads.create();
      currentThreadId = t.id;

      // Einmaliger Initial-Prompt
      await openai.beta.threads.messages.create(currentThreadId, {
        role: 'user',
        content: symptomPromptText
      });
    }

    // letzte User-Nachricht extrahieren
    const last = verlauf[verlauf.length - 1];
    const content = (typeof last?.content === 'string') ? last.content.trim() : '';
    if (!last || last.role !== 'user' || !content) {
      return res.status(400).json({ ok: false, error: 'Letzte Nachricht muss vom Nutzer (role="user") sein.' });
    }

    // User-Message anhängen
    await openai.beta.threads.messages.create(currentThreadId, {
      role: 'user',
      content
    });

    // Run starten (korrekte Signatur verwenden)
    const run = await openai.beta.threads.runs.create(currentThreadId, {
      assistant_id: ASSISTANT_ID
    });

    // Warten bis fertig (korrekte Parameterreihenfolge)
    await waitForRunCompletion(currentThreadId, run.id, 30000, 600);

    // Antworten einsammeln
    const msgs = await openai.beta.threads.messages.list(currentThreadId, { limit: 10 });
    const assistantMsg = msgs.data.find(m => m.role === 'assistant');

    let antwort = '…';
    if (assistantMsg?.content?.length) {
      const parts = assistantMsg.content
        .filter(p => p.type === 'text' && p.text?.value)
        .map(p => p.text.value.trim());
      if (parts.length) antwort = parts.join('\n\n');
    }

    return res.json({ ok: true, antwort, threadId: currentThreadId });
  } catch (err) {
    console.error('[symptom-thread] ERROR:', err?.response?.data || err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

export default router;
