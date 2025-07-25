import dotenv from 'dotenv';
dotenv.config();
console.log("🔍 OPENAI_API_KEY:", process.env.OPENAI_API_KEY);

import express from 'express';
import cors from 'cors';

import kiRouter from './routes/ki.js'; // für Bildanalyse
import textSymptomRouter from './routes/textsymptom.js'; // für Texteingabe

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routen aktivieren
app.use('/api/ki', kiRouter);
app.use('/api/textsymptom', textSymptomRouter);

// Test-Endpunkt
app.get('/', (req, res) => {
  res.send('Server läuft!');
});

app.listen(PORT, () => {
  console.log(`✅ Server läuft unter http://localhost:${PORT}`);
});
