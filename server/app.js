import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import symptomRoute from './routes/symptom.js';
import textSymptomRoute from './routes/textsymptom.js';
import koerpersymptomRoute from './routes/koerpersymptom.js';
import symptomThreadRoute from './routes/symptomThread.js';
import koerpersymptomThread from "./routes/koerpersymptomThread.js";
import bildanalyseThread from "./routes/bildanalyseThread.js";

const app = express();

// Body-Parser-Konfiguration (für große Base64-Dateien)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

//  API-Routen registrieren
app.use('/api/symptom', symptomRoute);
app.use('/api/textsymptom', textSymptomRoute);
app.use('/api/koerpersymptom', koerpersymptomRoute);
app.use('/api/symptom-thread', symptomThreadRoute);
app.use("/api/koerpersymptomthread", koerpersymptomThread);
app.use("/api/bildanalyse-thread", bildanalyseThread);
// Server starten
app.listen(3000, () => {
  console.log(' Server läuft unter http://localhost:3000');
});
