import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import KoerperVorderseite from './pages/KoerperVorderseite';
import KoerperRueckseite from './pages/KoerperRueckseite';

ReactDOM.createRoot(document.getElementById('root')).render(
  //<React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/koerperregionen" element={<KoerperVorderseite />} />
        <Route path="/rueckseite" element={<KoerperRueckseite />} />
      </Routes>
    </Router>
  //</React.StrictMode>
);
