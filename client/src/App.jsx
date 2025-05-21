import { useState } from 'react';

function App() {
  const [antwort, setAntwort] = useState('');
  const [loading, setLoading] = useState(false);

  const frageAbsenden = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frage: 'Was ist Migräne?' })
      });
      const data = await res.json();
      setAntwort(data.antwort);
    } catch (err) {
      setAntwort('Fehler bei der KI-Anfrage.');
    }
    setLoading(false);
  };

  return (
    <div>
      <h1>Entscheidungs-App</h1>
      <button onClick={frageAbsenden}>Frage an KI senden</button>
      {loading ? <p>Antwort wird geladen...</p> : <p>{antwort}</p>}
    </div>
  );
}

export default App;
