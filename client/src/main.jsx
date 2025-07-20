import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import Intro from './pages/Intro';
import KoerperVorderseite from './pages/KoerperVorderseite';
import KoerperRueckseite from './pages/KoerperRueckseite';
import Startseite from './pages/Startseite';
import BildUpload from './pages/BildUpload';
import SymptomChat from './pages/SymptomChat';
import KoerperregionStart from './pages/KoerperregionStart';



ReactDOM.createRoot(document.getElementById('root')).render(
  //<React.StrictMode>
    <Router>
     <Routes>
  <Route path="/" element={<Intro />} />  // Logo NUR auf dieser Route
  <Route path="/startseite" element={<Startseite />} />
  <Route path="/symptom" element={<SymptomChat />} />
  <Route path="/bild" element={<BildUpload />} />
  <Route path="/region-start" element={<KoerperregionStart />} />
  <Route path="/koerperregionen" element={<KoerperVorderseite />} />
  <Route path="/rueckseite" element={<KoerperRueckseite />} />
  

</Routes>

    </Router>
  //</React.StrictMode>
);
