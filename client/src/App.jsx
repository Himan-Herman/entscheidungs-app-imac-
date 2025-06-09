import { useState } from 'react';
import './App.css';
import { useNavigate } from 'react-router-dom';

function App() {
  const [eingabe, setEingabe] = useState('');
  const [antwort, setAntwort] = useState('');
  const [verlauf, setVerlauf] = useState([]);
  const [bild, setBild] = useState(null);
  const navigate = useNavigate();

  function dateiZuBase64(datei) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(datei);
    });
  }

  const frageSenden = async () => {
    if (!eingabe.trim()) return;

    const neuerVerlauf = [...verlauf, { role: 'user', content: eingabe }];
    setVerlauf(neuerVerlauf);
    setAntwort('Antwort wird geladen...');

    try {
      const base64Bild = bild ? await dateiZuBase64(bild) : null;

      const res = await fetch('/api/ki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verlauf: neuerVerlauf,
          base64Bild: base64Bild
        })
      });

      const data = await res.json();
      setAntwort(data.antwort);
      setVerlauf([...neuerVerlauf, { role: 'assistant', content: data.antwort }]);
    } catch (error) {
      console.error(error);
      setAntwort('Fehler beim Abrufen der Antwort.');
    }

    setEingabe('');
  };

  return (
    <div className="app">
      <h1>Entscheidungs-App</h1>

      <div className="eingabe-box">
        <input
          type="text"
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          placeholder="Beschreibe dein Symptom..."
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setBild(e.target.files[0])}
        />
        <button onClick={frageSenden}>Frage an KI senden</button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <button
          onClick={() => navigate('/koerperregionen')}
          style={{ padding: '10px 20px' }}
        >
          Körperregionen-Auswahl
        </button>
      </div>

      <div className="chat-verlauf">
        {verlauf.map((eintrag, index) => (
          <div
            key={index}
            className={eintrag.role === 'user' ? 'frage' : 'antwort'}
          >
            <strong>{eintrag.role === 'user' ? 'Du:' : 'KI:'}</strong>
            <p dangerouslySetInnerHTML={{ __html: eintrag.content }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
