import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
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
import LandingPage from "./pages/LandingPage";
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
import PreVisitLanguagePage from "./features/preVisit/pages/PreVisitLanguagePage.jsx";
import PreVisitChatPage from "./features/preVisit/pages/PreVisitChatPage.jsx";
import PreVisitReviewPage from "./features/preVisit/pages/PreVisitReviewPage.jsx";
import PreVisitDocumentPage from "./features/preVisit/pages/PreVisitDocumentPage.jsx";
import PreVisitHistoryPage from "./features/preVisit/pages/PreVisitHistoryPage.jsx";
import PreVisitAccountHistoryPage from "./features/preVisit/pages/PreVisitAccountHistoryPage.jsx";
import SettingsDoctorContactsPage from "./pages/SettingsDoctorContactsPage.jsx";
import { ThemeProvider } from "./ThemeMode";
import { LanguageProvider } from "./i18n/LanguageContext";

//import VerifyEmail from "./pages/VerifyEmail";

function Gate() {
  const hasUser = !!localStorage.getItem("medscout_user_id");
  return hasUser
    ? <Navigate to="/intro" replace />
    : <Navigate to="/register" replace />;
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>

    {/* ⭐ GLOBAL THEME PROVIDER – bleibt immer aktiv */}
    <ThemeProvider>
      <LanguageProvider>

      <BrowserRouter>
        <Routes>

          {/* Layout mit verschachtelten Routes */}
          <Route element={<Layout />}>

            <Route path="/" element={<LandingPage />} />
            <Route path="/gate" element={<Gate />} />
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

            <Route
              path="/settings/doctor-contacts"
              element={
                <ProtectedRoute>
                  <SettingsDoctorContactsPage />
                </ProtectedRoute>
              }
            />

            {/* Öffentliche statische Seiten */}
            <Route path="/impressum" element={<Impressum />} />
            <Route path="/datenschutz" element={<Datenschutz />} />
            <Route path="/check-email" element={<CheckEmail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verified" element={<Verified />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/agb" element={<AGB />} />
            <Route path="/info" element={<Info />} />

            {/* Pre-Visit Medical Communication (fourth module — UI only, no auth) */}
            <Route path="/pre-visit/document" element={<PreVisitDocumentPage />} />
            <Route
              path="/pre-visit/my-preparations"
              element={<PreVisitAccountHistoryPage />}
            />
            <Route path="/pre-visit/history" element={<PreVisitHistoryPage />} />
            <Route path="/pre-visit/chat" element={<PreVisitChatPage />} />
            <Route path="/pre-visit/review" element={<PreVisitReviewPage />} />
            <Route path="/pre-visit" element={<PreVisitLanguagePage />} />
            <Route
              path="/arztgespraech"
              element={<Navigate to="/pre-visit" replace />}
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Route>

        </Routes>
      </BrowserRouter>
      </LanguageProvider>

    </ThemeProvider>
  </React.StrictMode>
);
