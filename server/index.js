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
  const { verlauf } = req.body;

  if (!verlauf || !Array.isArray(verlauf)) {
    return res.status(400).json({ error: 'Verlauf fehlt oder ist ungültig' });
  }

  try {
    const antwort = await frageOllama(verlauf);
    res.json({ antwort });
  } catch (error) {
    console.error('KI-Fehler:', error);
    res.status(500).json({ error: 'KI-Antwort fehlgeschlagen' });
  }
});


app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
