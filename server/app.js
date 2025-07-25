import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import symptomRoute from './routes/symptom.js';
import textSymptomRoute from './routes/textsymptom.js';

const app = express();

// Body-Parser-Konfiguration (für große Base64-Dateien)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

//  API-Routen registrieren
app.use('/api/symptom', symptomRoute);
app.use('/api/textsymptom', textSymptomRoute);

// Server starten
app.listen(3000, () => {
  console.log(' Server läuft unter http://localhost:3000');
});
