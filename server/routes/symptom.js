import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import multer from 'multer';
import { getBildanalysePrompt } from '../../client/src/pages/prompt/bildanalysePrompt.js';

dotenv.config();
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = process.env.ASSISTANT_ID_BILDANALYSE;

// ---- Helpers ----
async function waitForRunCompletion(threadId, runId, timeoutMs = 30000, pollMs = 700) {
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

const imageHashByThread = new Map(); 
const threadNeedsMedicalImage = new Map(); 

function extFromMime(mime = '') {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

// ---- Neue Route: multipart/form-data ----
router.post('/', upload.single('bild'), async (req, res) => {
  try {
    const { prompt, threadId: clientThreadId, bildTyp, letzteSprache } = req.body;

    // File prüfen
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ fehler: 'Kein gültiges Bild erhalten.' });
    }

    const fileBuffer = req.file.buffer;
    const mime = req.file.mimetype;

    // 2) ThreadId bestimmen
    const threadId = (clientThreadId && String(clientThreadId).trim() && clientThreadId !== 'undefined' && clientThreadId !== 'null')
      ? clientThreadId
      : (await openai.beta.threads.create()).id;

    if (bildTyp && bildTyp !== 'medizinisch') {
      return res.json({
        threadId: clientThreadId || null,
        antwort: 'Hier kann ich nur medizinische Bilder analysieren. Für Beschwerden ohne Bild wechsle bitte in den **Symptombereich**.'
      });
    }

    // 4) Fachliche Sperre: Off-Topic
    const needMed = threadNeedsMedicalImage.get(threadId || 'NEW');
    if (needMed && (!bildTyp || bildTyp !== 'medizinisch')) {
      return res.json({
        threadId,
        antwort: 'Hier kann ich nur medizinisch relevante Bilder analysieren. Bitte lade ein geeignetes Foto hoch.'
      });
    }
    threadNeedsMedicalImage.set(threadId || 'NEW', false);

    // 5) Bild hochladen
    const uploaded = await openai.files.create({
      file: await toFile(fileBuffer, `upload.${extFromMime(mime)}`, { type: mime }),
      purpose: 'vision',
    });

    // 6) Duplikat-Erkennung optional
    const fp = fileBuffer.slice(0, 160).toString('base64'); // kleiner Fingerprint
    const last = imageHashByThread.get(threadId) || null;
    const istGleichesBild = last === fp;
    if (!istGleichesBild) imageHashByThread.set(threadId, fp);

    // 7) Prompt vorbereiten
    const instr = istGleichesBild
      ? getBildanalysePrompt({ bildTyp: 'medizinisch', istNeuesBild: false, letzteSprache })
      : getBildanalysePrompt({ bildTyp: 'medizinisch', istNeuesBild: true, letzteSprache });

    // 8) Nachricht an Thread
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: [
        { type: 'text', text: (prompt || 'Bitte analysiere dieses Bild.').trim() },
        { type: 'image_file', image_file: { file_id: uploaded.id } },
      ],
    });

    // 9) Run starten
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
      additional_instructions: instr,
    });

    // 10) Auf Completion warten
    await waitForRunCompletion(run.thread_id, run.id, 30000, 700);

    // 11) Letzte Assistant-Antwort holen
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
