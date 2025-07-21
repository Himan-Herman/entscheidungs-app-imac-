import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import symptomRoute from './routes/symptom.js';

dotenv.config();
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));


// ✅ API-Routen registrieren
app.use('/api/symptom', symptomRoute);

app.listen(3000, () => {
  console.log('✅ Server läuft unter http://localhost:3000');
});
