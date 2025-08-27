import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { getBildanalysePrompt } from '../../client/src/pages/prompt/bildanalysePrompt.js';

dotenv.config();
const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = process.env.ASSISTANT_ID_BILDANALYSE;

// ---- Helpers ----
async function waitForRunCompletion(threadId, runId, timeoutMs = 30000, pollMs = 700) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // neue Syntax: runId zuerst, thread_id als Option
    const run = await openai.beta.threads.runs.retrieve(runId, { thread_id: threadId });
    if (run.status === 'completed') return run;
    if (['failed', 'cancelled', 'expired'].includes(run.status)) {
      throw new Error(`Run status: ${run.status}`);
    }
    await new Promise(r => setTimeout(r, pollMs));
  }
  throw new Error('Run timeout');
}
const imageHashByThread = new Map();
const fingerprint = (dataUrl = '') => dataUrl.slice(0, 160);
function splitDataUrl(dataUrl) {
  const m = /^data:(.+);base64,(.*)$/.exec(dataUrl || '');
  if (!m) return { mime: null, b64: null };
  return { mime: m[1], b64: m[2] };
}
function extFromMime(mime = '') {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}


router.post('/', async (req, res) => {
  try {
    const { prompt, base64Bild, threadId: clientThreadId } = req.body || {};

    if (!base64Bild || typeof base64Bild !== 'string') {
      return res.status(400).json({ fehler: 'Kein gültiges Bild erhalten.' });
    }

    
    const threadId = (clientThreadId && String(clientThreadId).trim() && clientThreadId !== 'undefined' && clientThreadId !== 'null')
      ? clientThreadId
      : (await openai.beta.threads.create()).id;

    
    const { mime, b64 } = splitDataUrl(base64Bild);
    if (!mime || !b64) {
      return res.status(400).json({ fehler: 'Ungültiges Bildformat (Data-URL erwartet).' });
    }
    const fileBuffer = Buffer.from(b64, 'base64');
    const uploaded = await openai.files.create({
      file: await toFile(fileBuffer, `upload.${extFromMime(mime)}`, { type: mime }),
      purpose: 'vision',
    });

    
    const fp = fingerprint(base64Bild);
    const last = imageHashByThread.get(threadId) || null;
    const istGleichesBild = last === fp;
    if (!istGleichesBild) imageHashByThread.set(threadId, fp);

    const instr = istGleichesBild
      ? 'Beschreibe das Bild nicht erneut. Stelle nur gezielte Rückfragen oder beziehe dich auf den bisherigen Verlauf.'
      : getBildanalysePrompt();

     
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: [
      
        { type: 'text', text: (prompt || 'Bitte analysiere dieses Bild.').trim() },
    
      
        { type: 'image_file', image_file: { file_id: uploaded.id } },
      ],
    });
    
    
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
      additional_instructions: instr,
    });

    
    await waitForRunCompletion(run.thread_id, run.id, 30000, 700);

    
    const msgs = await openai.beta.threads.messages.list(threadId, { limit: 8, order: 'desc' });
    const assistantMsg = msgs.data.find(m => m.role === 'assistant');

    let antwort = 'Keine Antwort erhalten.';
    if (assistantMsg?.content?.length) {
      const parts = assistantMsg.content
        .filter(p => p.type === 'text' && p.text?.value)
        .map(p => p.text.value.trim());
      if (parts.length) antwort = parts.join('\n\n');
    }

    return res.json({
      threadId,
      antwort: antwort.replace(/\n/g, '<br/>'),
    });
  } catch (e) {
    console.error('[symptom Bildanalyse]', e);
    return res.status(500).json({ fehler: 'Fehler bei der Bildanalyse.' });
  }
});

export default router;
