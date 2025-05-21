import express from 'express';
import { frageOllama } from './ollamaClient.js';
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.send('Server läuft!');
});
app.get('/api/test', (req, res) => {
  res.json({ message: 'API-Verbindung erfolgreich' });
});
app.use(express.json());

app.post('/api/ki', async (req, res) => {
  const { frage } = req.body;

  try {
    const antwort = await frageOllama(frage);
    res.json({ antwort });
  } catch (err) {
    res.status(500).json({ fehler: 'KI nicht erreichbar', details: err.message });
  }
});


app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
