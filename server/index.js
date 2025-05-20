const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.send('Server läuft!');
});
app.get('/api/test', (req, res) => {
  res.json({ message: 'API-Verbindung erfolgreich' });
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
