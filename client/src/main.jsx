import React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import Layout from "./Layout.jsx";

import Intro from "./pages/Intro";
import Register from "./pages/Register.jsx";
import Startseite from "./pages/Startseite";
import KoerperVorderseite from "./pages/KoerperVorderseite";
import KoerperRueckseite from "./pages/KoerperRueckseite";
import BildUpload from "./pages/BildUpload";
import SymptomChat from "./pages/SymptomChat";
import KoerperregionStart from "./pages/KoerperregionStart";
import KoerperSymptomChat from "./pages/KoerperSymptomChat";
import Impressum from "./pages/Impressum";
import Datenschutz from "./pages/Datenschutz";
import CheckEmail from "./pages/CheckEmail";
import Verified from "./pages/Verified";
import Login from "./pages/Login";
import VerifyEmail from "./pages/VerifyEmail";

function Gate() {
  const hasUser = !!localStorage.getItem("medscout_user_id");
  return hasUser
    ? <Navigate to="/intro" replace />
    : <Navigate to="/register" replace />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Gate />} />
          <Route path="/intro" element={<Intro />} />
          <Route path="/register" element={<Register />} />
          <Route path="/startseite" element={<Startseite />} />
          <Route path="/symptom" element={<SymptomChat />} />
          <Route path="/bild" element={<BildUpload />} />
          <Route path="/region-start" element={<KoerperregionStart />} />
          <Route path="/koerperregionen" element={<KoerperVorderseite />} />
          <Route path="/rueckseite" element={<KoerperRueckseite />} />
          <Route path="/koerpersymptom" element={<KoerperSymptomChat />} />
          <Route path="/impressum" element={<Impressum />} />
          <Route path="/datenschutz" element={<Datenschutz />} />
          <Route path="/check-email" element={<CheckEmail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verified" element={<Verified />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Fallback: alles Unbekannte auf Startseite */}
          <Route path="*" element={<Navigate to="/startseite" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
