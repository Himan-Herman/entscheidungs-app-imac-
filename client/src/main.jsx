import React from "react";
import { createRoot } from "react-dom/client";
import ProtectedRoute from "./components/ProtectedRoute";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import Layout from "./Layout.jsx";

import Intro from "./pages/Intro";
import Register from "./pages/Register";
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
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Disclaimer from "./pages/Disclaimer";
import AGB from "./pages/AGB.jsx";
import Info from "./pages/Info"; 
import { ThemeProvider } from "./ThemeMode";

//import VerifyEmail from "./pages/VerifyEmail";

function Gate() {
  const hasUser = !!localStorage.getItem("medscout_user_id");
  return hasUser
    ? <Navigate to="/intro" replace />
    : <Navigate to="/register" replace />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>

    {/* ⭐ GLOBAL THEME PROVIDER – bleibt immer aktiv */}
    <ThemeProvider>

      <BrowserRouter>
        <Routes>

          {/* Layout mit verschachtelten Routes */}
          <Route element={<Layout />}>

            <Route path="/" element={<Gate />} />
            <Route path="/intro" element={<Intro />} />
            <Route path="/register" element={<Register />} />

            {/* Geschützte Bereiche */}
            <Route
              path="/startseite"
              element={
                <ProtectedRoute>
                  <Startseite />
                </ProtectedRoute>
              }
            />

            <Route
              path="/symptom"
              element={
                <ProtectedRoute>
                  <SymptomChat />
                </ProtectedRoute>
              }
            />

            <Route
              path="/bild"
              element={
                <ProtectedRoute>
                  <BildUpload />
                </ProtectedRoute>
              }
            />

            <Route
              path="/region-start"
              element={
                <ProtectedRoute>
                  <KoerperregionStart />
                </ProtectedRoute>
              }
            />

            <Route
              path="/koerperregionen"
              element={
                <ProtectedRoute>
                  <KoerperVorderseite />
                </ProtectedRoute>
              }
            />

            <Route
              path="/rueckseite"
              element={
                <ProtectedRoute>
                  <KoerperRueckseite />
                </ProtectedRoute>
              }
            />

            <Route
              path="/koerpersymptom"
              element={
                <ProtectedRoute>
                  <KoerperSymptomChat />
                </ProtectedRoute>
              }
            />

            {/* Öffentliche statische Seiten */}
            <Route path="/impressum" element={<Impressum />} />
            <Route path="/datenschutz" element={<Datenschutz />} />
            <Route path="/check-email" element={<CheckEmail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verified" element={<Verified />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/startseite" replace />} />

          </Route>

          {/* Seiten außerhalb des Layouts */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="/agb" element={<AGB />} />
          <Route path="/info" element={<Info />} />

        </Routes>
      </BrowserRouter>

    </ThemeProvider>
  </React.StrictMode>
);