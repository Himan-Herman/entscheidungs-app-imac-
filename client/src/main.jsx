import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import ProtectedRoute from "./components/ProtectedRoute";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "./Layout.jsx";

import Intro from "./pages/Intro";
import Register from "./pages/Register";
import LandingPage from "./pages/LandingPage";
import RoleEntryPage from "./pages/RoleEntryPage.jsx";
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
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";
import { getMessages } from "./i18n/translations";

const Startseite = lazy(() => import("./pages/Startseite.jsx"));
const KoerperVorderseite = lazy(() => import("./pages/KoerperVorderseite.jsx"));
const KoerperRueckseite = lazy(() => import("./pages/KoerperRueckseite.jsx"));
const BildUpload = lazy(() => import("./pages/BildUpload.jsx"));
const SymptomChat = lazy(() => import("./pages/SymptomChat.jsx"));
const KoerperregionStart = lazy(() => import("./pages/KoerperregionStart.jsx"));
const KoerperSymptomChat = lazy(() => import("./pages/KoerperSymptomChat.jsx"));

const PreVisitLanguagePage = lazy(() =>
  import("./features/preVisit/pages/PreVisitLanguagePage.jsx"),
);
const PreVisitChatPage = lazy(() => import("./features/preVisit/pages/PreVisitChatPage.jsx"));
const PreVisitReviewPage = lazy(() => import("./features/preVisit/pages/PreVisitReviewPage.jsx"));
const PreVisitDocumentPage = lazy(() =>
  import("./features/preVisit/pages/PreVisitDocumentPage.jsx"),
);
const PreVisitHistoryPage = lazy(() => import("./features/preVisit/pages/PreVisitHistoryPage.jsx"));
const PreVisitAccountHistoryPage = lazy(() =>
  import("./features/preVisit/pages/PreVisitAccountHistoryPage.jsx"),
);
const PreVisitQrLandingPage = lazy(() =>
  import("./features/preVisit/pages/PreVisitQrLandingPage.jsx"),
);
const PreVisitCasesPage = lazy(() => import("./features/preVisit/pages/PreVisitCasesPage.jsx"));
const PreVisitCaseDetailPage = lazy(() =>
  import("./features/preVisit/pages/PreVisitCaseDetailPage.jsx"),
);
const PreVisitFollowUpsPage = lazy(() =>
  import("./features/preVisit/pages/PreVisitFollowUpsPage.jsx"),
);
const PreVisitFollowUpThreadPage = lazy(() =>
  import("./features/preVisit/pages/PreVisitFollowUpThreadPage.jsx"),
);
const PatientVisitMedicationsPage = lazy(() =>
  import("./features/visitMedications/pages/PatientVisitMedicationsPage.jsx"),
);

const SettingsDoctorContactsPage = lazy(() =>
  import("./pages/SettingsDoctorContactsPage.jsx"),
);
const SettingsPracticesPage = lazy(() => import("./pages/SettingsPracticesPage.jsx"));
const PracticeDashboardPage = lazy(() => import("./pages/PracticeDashboardPage.jsx"));
const PracticePreparationDetailPage = lazy(() =>
  import("./pages/PracticePreparationDetailPage.jsx"),
);
const PracticePatientsListPage = lazy(() =>
  import("./features/careRelationship/pages/PracticePatientsListPage.jsx"),
);
const PracticePatientDetailPage = lazy(() =>
  import("./features/careRelationship/pages/PracticePatientDetailPage.jsx"),
);
const SettingsPrivacyPage = lazy(() => import("./pages/SettingsPrivacyPage.jsx"));

const AccountPortalLayout = lazy(() => import("./pages/account/AccountPortalLayout.jsx"));
const AccountHomePage = lazy(() => import("./pages/account/AccountHomePage.jsx"));
const AccountDocumentsPage = lazy(() => import("./pages/account/AccountDocumentsPage.jsx"));
const AccountDoctorsPage = lazy(() => import("./pages/account/AccountDoctorsPage.jsx"));
const AccountPersonalPage = lazy(() => import("./pages/account/AccountPersonalPage.jsx"));
const AccountHealthProfilePage = lazy(() =>
  import("./pages/account/AccountHealthProfilePage.jsx"),
);
const AccountProfilesPage = lazy(() => import("./pages/account/AccountProfilesPage.jsx"));
const AccountDataPage = lazy(() => import("./pages/account/AccountDataPage.jsx"));
const PatientHubPage = lazy(() => import("./pages/PatientHubPage.jsx"));
const PatientPracticeHubPage = lazy(() =>
  import("./pages/PatientPracticeHubPage.jsx"),
);
const PatientOrientationHubPage = lazy(() =>
  import("./pages/PatientOrientationHubPage.jsx"),
);
const InterpreterHomePage = lazy(() =>
  import("./features/medicalInterpreter/pages/InterpreterHomePage.jsx"),
);
const InterpreterSetupPage = lazy(() =>
  import("./features/medicalInterpreter/pages/InterpreterSetupPage.jsx"),
);
const InterpreterLivePage = lazy(() =>
  import("./features/medicalInterpreter/pages/InterpreterLivePage.jsx"),
);
const InterpreterReviewPage = lazy(() =>
  import("./features/medicalInterpreter/pages/InterpreterReviewPage.jsx"),
);
const MedicalInterpreterFeatureGate = lazy(() =>
  import("./features/medicalInterpreter/components/MedicalInterpreterFeatureGate.jsx"),
);
const PatientInboxPage = lazy(() =>
  import("./features/patientInbox/pages/PatientInboxPage.jsx"),
);
const PatientThreadsListPage = lazy(() =>
  import("./features/communication/pages/PatientThreadsListPage.jsx"),
);
const PatientThreadDetailPage = lazy(() =>
  import("./features/communication/pages/PatientThreadDetailPage.jsx"),
);
const PracticePatientMessagesPage = lazy(() =>
  import("./features/communication/pages/PracticePatientMessagesPage.jsx"),
);
const PatientMedicationPlansListPage = lazy(() =>
  import("./features/medicationPlan/pages/PatientMedicationPlansListPage.jsx"),
);
const PatientMedicationPlanDetailPage = lazy(() =>
  import("./features/medicationPlan/pages/PatientMedicationPlanDetailPage.jsx"),
);
const PatientPracticeDocumentsListPage = lazy(() =>
  import("./features/practiceDocuments/pages/PatientPracticeDocumentsListPage.jsx"),
);
const PatientPracticeDocumentDetailPage = lazy(() =>
  import("./features/practiceDocuments/pages/PatientPracticeDocumentDetailPage.jsx"),
);
const PatientDataControlPage = lazy(() =>
  import("./features/careRelationship/pages/PatientDataControlPage.jsx"),
);
const PatientExportsPage = lazy(() =>
  import("./features/exports/pages/PatientExportsPage.jsx"),
);
const PatientConsentsPage = lazy(() =>
  import("./features/consent/pages/PatientConsentsPage.jsx"),
);
const PracticeExportsPage = lazy(() =>
  import("./features/exports/pages/PracticeExportsPage.jsx"),
);
const PracticeDataRequestsPage = lazy(() =>
  import("./features/careRelationship/pages/PracticeDataRequestsPage.jsx"),
);
const PatientActivityPage = lazy(() =>
  import("./features/activity/pages/PatientActivityPage.jsx"),
);
const PracticeAuditPage = lazy(() =>
  import("./features/activity/pages/PracticeAuditPage.jsx"),
);
const PracticeSecurityPage = lazy(() =>
  import("./features/security/pages/PracticeSecurityPage.jsx"),
);
const PracticeSettingsPage = lazy(() =>
  import("./features/practiceSettings/pages/PracticeSettingsPage.jsx"),
);
const PracticeIntegrationsPage = lazy(() =>
  import("./features/practiceIntegrations/pages/PracticeIntegrationsPage.jsx"),
);
const PracticeIntegrationsSandboxPage = lazy(() =>
  import("./features/practiceIntegrations/pages/PracticeIntegrationsSandboxPage.jsx"),
);
const PracticeCalendarPage = lazy(() =>
  import("./features/practiceCalendar/pages/PracticeCalendarPage.jsx"),
);
const PracticeCalendarSettingsPage = lazy(() =>
  import("./features/practiceCalendar/pages/PracticeCalendarSettingsPage.jsx"),
);
const PatientAppointmentsPage = lazy(() =>
  import("./features/patientAppointments/pages/PatientAppointmentsPage.jsx"),
);
const PracticeTelemedicinePage = lazy(() =>
  import("./features/telemedicine/pages/PracticeTelemedicinePage.jsx"),
);
const PracticeTelemedicineDetailPage = lazy(() =>
  import("./features/telemedicine/pages/PracticeTelemedicineDetailPage.jsx"),
);
const PracticeVideoSettingsPage = lazy(() =>
  import("./features/telemedicine/pages/PracticeVideoSettingsPage.jsx"),
);
const PracticeDeveloperPage = lazy(() =>
  import("./features/practiceDeveloper/pages/PracticeDeveloperPage.jsx"),
);
const PatientTelemedicinePage = lazy(() =>
  import("./features/telemedicine/pages/PatientTelemedicinePage.jsx"),
);
const PatientTelemedicineDetailPage = lazy(() =>
  import("./features/telemedicine/pages/PatientTelemedicineDetailPage.jsx"),
);
const PracticeInboxListPage = lazy(() =>
  import("./features/practiceInbox/pages/PracticeInboxListPage.jsx"),
);
const PracticeInboxDetailPage = lazy(() =>
  import("./features/practiceInbox/pages/PracticeInboxDetailPage.jsx"),
);
const PracticeFinderPage = lazy(() =>
  import("./features/practiceFinder/pages/PracticeFinderPage.jsx"),
);
const PracticeHubPage = lazy(() => import("./pages/PracticeHubPage.jsx"));
const InterpreterPracticeHubPage = lazy(() =>
  import("./features/medicalInterpreter/pages/InterpreterPracticeHubPage.jsx"),
);
const InterpreterPracticeDashboardPage = lazy(() =>
  import("./features/medicalInterpreter/pages/InterpreterPracticeDashboardPage.jsx"),
);
const InterpreterPracticeInvitesPage = lazy(() =>
  import("./features/medicalInterpreter/pages/InterpreterPracticeInvitesPage.jsx"),
);
const InterpreterPracticeSessionsPage = lazy(() =>
  import("./features/medicalInterpreter/pages/InterpreterPracticeSessionsPage.jsx"),
);
const InterpreterPracticeSessionDetailPage = lazy(() =>
  import("./features/medicalInterpreter/pages/InterpreterPracticeSessionDetailPage.jsx"),
);
const InterpreterInviteLandingPage = lazy(() =>
  import("./features/medicalInterpreter/pages/InterpreterInviteLandingPage.jsx"),
);
const InterpreterInviteLegacyRedirect = lazy(() =>
  import("./features/medicalInterpreter/pages/InterpreterInviteLegacyRedirect.jsx"),
);
const PracticeTeamPage = lazy(() =>
  import("./features/practiceTeam/pages/PracticeTeamPage.jsx"),
);

function RouteFallback() {
  const { language } = useLanguage();
  const label =
    getMessages(language).common?.loading ??
    getMessages("en").common?.loading ??
    "Loading…";
  return (
    <div className="app-route-fallback" aria-busy="true" role="status">
      <span className="app-route-fallback__sr">{label}</span>
    </div>
  );
}

function Gate() {
  const hasUser =
    !!localStorage.getItem("medscout_token") && !!localStorage.getItem("medscout_user_id");
  return hasUser ? <Navigate to="/intro" replace /> : <Navigate to="/register" replace />;
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<RoleEntryPage />} />
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/gate" element={<Gate />} />
                <Route path="/intro" element={<Intro />} />
                <Route path="/register" element={<Register />} />

                <Route
                  path="/startseite"
                  element={
                    <ProtectedRoute>
                      <Startseite />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/patient"
                  element={
                    <ProtectedRoute>
                      <PatientHubPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/practice"
                  element={
                    <ProtectedRoute>
                      <PatientPracticeHubPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/orientation"
                  element={
                    <ProtectedRoute>
                      <PatientOrientationHubPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/interpreter/setup"
                  element={
                    <ProtectedRoute>
                      <MedicalInterpreterFeatureGate>
                        <InterpreterSetupPage />
                      </MedicalInterpreterFeatureGate>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/interpreter/live"
                  element={
                    <ProtectedRoute>
                      <MedicalInterpreterFeatureGate>
                        <InterpreterLivePage />
                      </MedicalInterpreterFeatureGate>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/interpreter/review"
                  element={
                    <ProtectedRoute>
                      <MedicalInterpreterFeatureGate>
                        <InterpreterReviewPage />
                      </MedicalInterpreterFeatureGate>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/interpreter"
                  element={
                    <ProtectedRoute>
                      <MedicalInterpreterFeatureGate>
                        <InterpreterHomePage />
                      </MedicalInterpreterFeatureGate>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/inbox"
                  element={
                    <ProtectedRoute>
                      <PatientInboxPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/messages"
                  element={
                    <ProtectedRoute>
                      <PatientThreadsListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/messages/:threadId"
                  element={
                    <ProtectedRoute>
                      <PatientThreadDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/threads"
                  element={<Navigate to="/patient/messages" replace />}
                />
                <Route
                  path="/patient/threads/:threadId"
                  element={
                    <ProtectedRoute>
                      <PatientThreadDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/medication-plans"
                  element={
                    <ProtectedRoute>
                      <PatientMedicationPlansListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/medication-plans/practice/:planId"
                  element={
                    <ProtectedRoute>
                      <PatientMedicationPlanDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/practice-documents"
                  element={
                    <ProtectedRoute>
                      <PatientPracticeDocumentsListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/practice-documents/:documentId"
                  element={
                    <ProtectedRoute>
                      <PatientPracticeDocumentDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/data-control"
                  element={
                    <ProtectedRoute>
                      <PatientDataControlPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/exports"
                  element={
                    <ProtectedRoute>
                      <PatientExportsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/consents"
                  element={
                    <ProtectedRoute>
                      <PatientConsentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/practice-links"
                  element={
                    <ProtectedRoute>
                      <PatientDataControlPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/activity"
                  element={
                    <ProtectedRoute>
                      <PatientActivityPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/team"
                  element={
                    <ProtectedRoute>
                      <PracticeTeamPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/audit"
                  element={
                    <ProtectedRoute>
                      <PracticeAuditPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/settings"
                  element={
                    <ProtectedRoute>
                      <PracticeSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/integrations/sandbox"
                  element={
                    <ProtectedRoute>
                      <PracticeIntegrationsSandboxPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/integrations"
                  element={
                    <ProtectedRoute>
                      <PracticeIntegrationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/calendar/settings"
                  element={
                    <ProtectedRoute>
                      <PracticeCalendarSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/calendar"
                  element={
                    <ProtectedRoute>
                      <PracticeCalendarPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/settings/video"
                  element={
                    <ProtectedRoute>
                      <PracticeVideoSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/telemedicine/:sessionId"
                  element={
                    <ProtectedRoute>
                      <PracticeTelemedicineDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/telemedicine"
                  element={
                    <ProtectedRoute>
                      <PracticeTelemedicinePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/developer"
                  element={
                    <ProtectedRoute>
                      <PracticeDeveloperPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/telemedicine/:sessionId"
                  element={
                    <ProtectedRoute>
                      <PatientTelemedicineDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/telemedicine"
                  element={
                    <ProtectedRoute>
                      <PatientTelemedicinePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/appointments"
                  element={
                    <ProtectedRoute>
                      <PatientAppointmentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/security"
                  element={
                    <ProtectedRoute>
                      <PracticeSecurityPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/data-requests"
                  element={
                    <ProtectedRoute>
                      <PracticeDataRequestsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/exports"
                  element={
                    <ProtectedRoute>
                      <PracticeExportsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/inbox"
                  element={
                    <ProtectedRoute>
                      <PracticeInboxListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/inbox/:itemId"
                  element={
                    <ProtectedRoute>
                      <PracticeInboxDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/find-practices"
                  element={
                    <ProtectedRoute>
                      <PracticeFinderPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice"
                  element={
                    <ProtectedRoute>
                      <PracticeHubPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <AccountPortalLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AccountHomePage />} />
                  <Route path="documents" element={<AccountDocumentsPage />} />
                  <Route path="doctors" element={<AccountDoctorsPage />} />
                  <Route path="personal" element={<AccountPersonalPage />} />
                  <Route path="health" element={<AccountHealthProfilePage />} />
                  <Route path="profiles" element={<AccountProfilesPage />} />
                  <Route path="data" element={<AccountDataPage />} />
                  <Route
                    path="follow-ups"
                    element={<Navigate to="/pre-visit/follow-ups" replace />}
                  />
                </Route>

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
                <Route
                  path="/settings/practices"
                  element={
                    <ProtectedRoute>
                      <SettingsPracticesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/privacy"
                  element={
                    <ProtectedRoute>
                      <SettingsPrivacyPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/interpreter/dashboard"
                  element={
                    <ProtectedRoute>
                      <InterpreterPracticeDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/interpreter/invites/new"
                  element={
                    <ProtectedRoute>
                      <InterpreterPracticeInvitesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/interpreter/invites"
                  element={
                    <ProtectedRoute>
                      <InterpreterPracticeInvitesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/interpreter/sessions/:id"
                  element={
                    <ProtectedRoute>
                      <InterpreterPracticeSessionDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/interpreter/sessions"
                  element={
                    <ProtectedRoute>
                      <InterpreterPracticeSessionsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/interpreter"
                  element={
                    <ProtectedRoute>
                      <InterpreterPracticeHubPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/dashboard"
                  element={
                    <ProtectedRoute>
                      <PracticeDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/patients"
                  element={
                    <ProtectedRoute>
                      <PracticePatientsListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/patients/:linkId/messages"
                  element={
                    <ProtectedRoute>
                      <PracticePatientMessagesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/patients/:linkId"
                  element={
                    <ProtectedRoute>
                      <PracticePatientDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice/dashboard/preparations/:id"
                  element={
                    <ProtectedRoute>
                      <PracticePreparationDetailPage />
                    </ProtectedRoute>
                  }
                />

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

                <Route path="/pre-visit/document" element={<PreVisitDocumentPage />} />
                <Route
                  path="/pre-visit/cases"
                  element={
                    <ProtectedRoute>
                      <PreVisitCasesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pre-visit/cases/:caseId"
                  element={
                    <ProtectedRoute>
                      <PreVisitCaseDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/pre-visit/my-preparations" element={<PreVisitAccountHistoryPage />} />
                <Route path="/pre-visit/history" element={<PreVisitHistoryPage />} />
                <Route
                  path="/pre-visit/medications"
                  element={
                    <ProtectedRoute>
                      <PatientVisitMedicationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pre-visit/medications/:sessionId"
                  element={
                    <ProtectedRoute>
                      <PatientVisitMedicationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pre-visit/follow-ups"
                  element={
                    <ProtectedRoute>
                      <PreVisitFollowUpsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pre-visit/follow-ups/:threadId"
                  element={
                    <ProtectedRoute>
                      <PreVisitFollowUpThreadPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/pre-visit/chat" element={<PreVisitChatPage />} />
                <Route path="/pre-visit/review" element={<PreVisitReviewPage />} />
                <Route path="/pre-visit" element={<PreVisitLanguagePage />} />
                <Route path="/pre-visit/qr/:qrToken" element={<PreVisitQrLandingPage />} />
                <Route
                  path="/i/interpreter/:token"
                  element={<InterpreterInviteLandingPage />}
                />
                <Route
                  path="/interpreter/invite/:token"
                  element={<InterpreterInviteLegacyRedirect />}
                />
                <Route path="/arztgespraech" element={<Navigate to="/pre-visit" replace />} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
