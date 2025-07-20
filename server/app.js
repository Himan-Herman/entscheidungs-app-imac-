import express from 'express';
import dotenv from 'dotenv';
import symptomRoute from './routes/symptom.js';

dotenv.config();
const app = express();

app.use(express.json());

// ✅ API-Routen registrieren
app.use('/api/symptom', symptomRoute);

app.listen(3000, () => {
  console.log('✅ Server läuft unter http://localhost:3000');
});
