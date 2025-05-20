import { useState, useEffect } from 'react';

function App() {
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/test')
      .then(res => res.json())
      .then(data => setMsg(data.message))
      .catch(err => console.error('API-Fehler:', err));
  }, []);

  return (
    <div>
      <h1>Entscheidungs-App</h1>
      <p>{msg}</p>
    </div>
  );
}

export default App;
