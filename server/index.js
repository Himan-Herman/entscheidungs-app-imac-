import dotenv from 'dotenv';
dotenv.config();
import { logEnvStatus } from './utils/secretSafety.js';

// Never log the secret value — presence only. See utils/secretSafety.js.
logEnvStatus('OPENAI_API_KEY');

import express from 'express';
import cors from 'cors';

import kiRouter from './routes/ki.js'; 
import textSymptomRouter from './routes/textsymptom.js'; 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));


app.use('/api/ki', kiRouter);
app.use('/api/textsymptom', textSymptomRouter);


app.get('/', (req, res) => {
  res.send('Server läuft!');
});

app.listen(PORT, () => {
  console.log(` Server läuft unter http://localhost:${PORT}`);
});
