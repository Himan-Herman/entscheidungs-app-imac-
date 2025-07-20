import dotenv from 'dotenv';
dotenv.config();
console.log("🔍 OPENAI_API_KEY:", process.env.OPENAI_API_KEY);
import express from 'express';
import cors from 'cors';
import kiRouter from './routes/ki.js'; // ⚠️ Muss existieren!

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API-Routen
app.use('/api/ki', kiRouter);

// Test-Endpunkt
app.get('/', (req, res) => {
  res.send('Server läuft!');
});

// Serverstart
app.listen(PORT, () => {
  console.log(`✅ Server läuft unter http://localhost:${PORT}`);
});
