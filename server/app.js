import dotenv from 'dotenv';
dotenv.config();


import express from 'express';
import cors from 'cors';


import symptomRoute from './routes/symptom.js';
//import textSymptomRoute from './routes/textsymptom.js';
//import koerpersymptomRoute from './routes/koerpersymptom.js';
import symptomThreadRoute from './routes/symptomThread.js';
import koerpersymptomThread from "./routes/koerpersymptomThread.js";
//import bildanalyseThread from "./routes/bildanalyseThread.js";
import transcribeRouter from "./routes/transcribe.js";

const app = express();


app.use(cors({
  origin: true,      
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));


app.use('/api/symptom', symptomRoute);
//app.use('/api/textsymptom', textSymptomRoute);
//app.use('/api/koerpersymptom', koerpersymptomRoute);
app.use('/api/symptom-thread', symptomThreadRoute);
app.use("/api/koerpersymptomthread", koerpersymptomThread);
//app.use("/api/bildanalyse-thread", bildanalyseThread);
app.use("/api/transcribe", transcribeRouter);


app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'medscout-server', time: new Date().toISOString() });
});

app.use((err, _req, res, _next) => {
  console.error('[UNCAUGHT]', err);
  res.status(500).json({ error: 'SERVER_ERROR', message: 'Unerwarteter Serverfehler.' });
});

// start
app.listen(3000, () => {
  console.log(' Server läuft unter http://localhost:3000');
});