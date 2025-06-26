import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import Koerperkarte from './pages/Koerperkarte';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/koerperregionen" element={<Koerperkarte />} />
      </Routes>
    </Router>
  </React.StrictMode>
);
