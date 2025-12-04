// server/app.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import symptomRoute from './routes/symptom.js';
import symptomThreadRoute from './routes/symptomThread.js';
import koerpersymptomThread from './routes/koerpersymptomThread.js';
import transcribeRouter from './routes/transcribe.js';
import authRouter from './routes/auth.js';
import mailRoutes from './routes/mail.js';
import { sendVerificationEmail } from './emailService.js';
import { requireAuth } from './middleware/requireAuth.js';
import ttsRouter from "./routes/tts.js";

const app = express();


const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length
      ? allowedOrigins
      : ['http://localhost:5173'], // Fallback für lokale Entwicklung
    credentials: false, // kein Cookie-Handling nötig
  })
);


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));


app.use('/api/symptom', requireAuth, symptomRoute);
app.use('/api/symptom-thread', requireAuth, symptomThreadRoute);
app.use('/api/textsymptom', requireAuth, symptomThreadRoute);
app.use('/api/koerpersymptomthread', requireAuth, koerpersymptomThread);
app.use('/api/transcribe', requireAuth, transcribeRouter);
app.use('/api/auth', authRouter);
app.use('/api/mail', mailRoutes);
app.use("/api/tts", ttsRouter);



// funktioniert mit /health UND /api/health
app.get(['/health', '/api/health'], (_req, res) =>
  res.json({
    ok: true,
    service: 'medscout-server',
    time: new Date().toISOString(),
    uptime: process.uptime(),
  })
);

app.get('/', (_req, res) => {
  res.send(`
    <h1>🚀 MedScout API</h1>
    <p>Der Server läuft erfolgreich.</p>
    <ul>
      <li><a href="/health">/health</a></li>
      <li><a href="/api/health">/api/health</a></li>
      <li><a href="/api/symptom">/api/symptom</a></li>
      <li><a href="/api/auth">/api/auth</a></li>
    </ul>
  `);
});


app.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    const APP_BASE_URL =
      process.env.APP_BASE_URL ||
      process.env.VITE_APP_BASE_URL ||
      'https://medscout.app';
    const verifyLink = `${APP_BASE_URL}/verify-email?token=TEST123`;

    const info = await sendVerificationEmail(email, verifyLink);
    res.json({ ok: true, info });
  } catch (err) {
    console.error('[test-email]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server läuft unter http://localhost:${PORT}`);
});
