import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getOrganPrompt } from './organPrompts';

export default function Chat() {
  const [eingabe, setEingabe] = useState('');
  const [verlauf, setVerlauf] = useState([]);
  const [bild, setBild] = useState(null);
  const [zeigeOptionen, setZeigeOptionen] = useState(false); 
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gewaehltesOrgan = searchParams.get('organ');

  useEffect(() => {
    if (gewaehltesOrgan) {
      const prompt = getOrganPrompt(gewaehltesOrgan);
      setVerlauf((prev) => [...prev, { role: 'assistant', content: prompt }]);
    }
  }, [gewaehltesOrgan]);

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

    setVerlauf([...neuerVerlauf, { role: 'assistant', content: '⏳ Antwort wird geladen...' }]);

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

      setVerlauf([
        ...neuerVerlauf,
        { role: 'assistant', content: data.antwort }
      ]);
    } catch (error) {
      console.error(error);
      setVerlauf([
        ...neuerVerlauf,
        { role: 'assistant', content: ' Fehler beim Abrufen der Antwort.' }
      ]);
    }

    setEingabe('');
  };

  return (
    <div className="app" style={{ textAlign: 'center', padding: '2rem' }}>
      <h1><b>Entscheidungs-App</b></h1>

      <div className="eingabe-box" style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          placeholder="Beschreibe dein Symptom..."
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setBild(e.target.files[0])}
          style={{ marginRight: '10px' }}
        />
        <button onClick={frageSenden}>Frage senden</button>
      </div>

    
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={() => setZeigeOptionen(!zeigeOptionen)}
          style={{
            padding: '1em',
            fontSize: '1em',
            boxShadow: '0 0 5px gray',
            cursor: 'pointer'
          }}
        >
          Körperregionen-Auswahl
        </button>

        {zeigeOptionen && (
          <div style={{ marginTop: '15px' }}>
            <button
              onClick={() => navigate('/koerperregionen')}
              style={{ marginRight: '10px', padding: '10px 20px' }}
            >
              Körper_Vorderseite
            </button>
            <button
              onClick={() => navigate('/rueckseite')}
              style={{ padding: '10px 20px' }}
            >
              Körper_Rückseite
            </button>
          </div>
        )}
      </div>

      
      <div className="chat-verlauf" style={{ marginTop: '30px', textAlign: 'left', maxWidth: '600px', margin: '30px auto' }}>
        {verlauf.map((eintrag, index) => (
          <div
            key={index}
            className={eintrag.role === 'user' ? 'frage' : 'antwort'}
            style={{
              backgroundColor: eintrag.role === 'user' ? '#e1f5fe' : '#f3f3f3',
              borderRadius: '10px',
              padding: '10px',
              marginBottom: '10px'
            }}
          >
            <strong>{eintrag.role === 'user' ? 'Ich:' : 'KI:'}</strong>
            <p dangerouslySetInnerHTML={{ __html: eintrag.content }} />
          </div>
        ))}
      </div>
    </div>
  );
}
