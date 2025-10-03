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

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// API-Routen
app.use('/api/symptom', symptomRoute);
app.use('/api/symptom-thread', symptomThreadRoute);
app.use('/api/koerpersymptomthread', koerpersymptomThread);
app.use('/api/transcribe', transcribeRouter);
app.use('/api/auth', authRouter);
app.use('/api/mail', mailRoutes);

// Health + Root
app.get('/health', (_req, res) =>
  res.json({ ok: true, service: 'medscout-server', time: new Date().toISOString() })
);

app.get('/', (_req, res) => {
  res.send(`
    <h1>🚀 MedScout API</h1>
    <p>Der Server läuft erfolgreich.</p>
    <ul>
      <li><a href="/health">/health</a></li>
      <li><a href="/api/symptom">/api/symptom</a></li>
      <li><a href="/api/auth">/api/auth</a></li>
    </ul>
  `);
});

// Test-Email (optional – in Prod lieber schützen/entfernen)
app.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    const verifyLink = `${process.env.APP_BASE_URL}/verify-email?token=TEST123`;
    const info = await sendVerificationEmail(email, verifyLink);
    res.json({ ok: true, info });
  } catch (err) {
    console.error('[test-email]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server läuft unter http://localhost:${PORT}`);
});
