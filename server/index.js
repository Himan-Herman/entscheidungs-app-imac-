import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import kiRouter from './routes/ki.js';

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

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
