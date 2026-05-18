// server/app.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';

import symptomRoute from './routes/symptom.js';
import symptomThreadRoute from './routes/symptomThread.js';
import koerpersymptomThread from './routes/koerpersymptomThread.js';
import transcribeRouter from './routes/transcribe.js';
import authRouter from './routes/auth.js';
import mailRoutes from './routes/mail.js';
import { sendVerificationEmail } from './emailService.js';
import { requireAuth } from './middleware/requireAuth.js';
import ttsRouter from "./routes/tts.js";
import kiRouter from "./routes/ki.js";
import previsitRouter from "./routes/previsit.js";
import previsitSessionsRouter from "./routes/previsitSessions.js";
import previsitCasesRouter from "./routes/previsitCases.js";
import doctorContactsRouter from "./routes/doctorContacts.js";
import practicesRouter from "./routes/practices.js";
import publicPrevisitQrRouter from "./routes/publicPrevisitQr.js";
import practiceDashboardRouter from "./routes/practiceDashboard.js";
import practiceOverviewDashboardRouter from "./routes/practiceOverviewDashboard.js";
import patientExportsRouter from "./routes/patientExports.js";
import practiceExportsRouter from "./routes/practiceExports.js";
import practiceFollowUpsRouter from "./routes/practiceFollowUps.js";
import previsitFollowUpsRouter from "./routes/previsitFollowUps.js";
import accountRouter from "./routes/account.js";
import accountPatientPortalRouter from "./routes/accountPatientPortal.js";
import practicePortalRouter from "./routes/practicePortal.js";
import practiceAnalyticsRouter from "./routes/practiceAnalytics.js";
import publicDocumentsRouter from "./routes/publicDocuments.js";
import secureDocumentDownloadRouter from "./routes/secureDocumentDownload.js";
import practiceSecureDocumentLinksRouter from "./routes/practiceSecureDocumentLinks.js";
import practiceApiDataRouter from "./routes/practiceApiData.js";
import placesRouter from "./routes/places.js";
import practiceFinderRouter from "./routes/practiceFinder.js";
import practicePatientsRouter from "./routes/practicePatients.js";
import patientCareLinksRouter from "./routes/patientCareLinks.js";
import patientInboxRouter from "./routes/patientInbox.js";
import patientThreadsRouter from "./routes/patientThreads.js";
import patientMedicationPlansRouter from "./routes/patientMedicationPlans.js";
import patientPracticeDocumentsRouter from "./routes/patientPracticeDocuments.js";
import patientDataControlRouter from "./routes/patientDataControl.js";
import patientProfileSharingRouter from "./routes/patientProfileSharing.js";
import patientActivityRouter from "./routes/patientActivity.js";
import practiceAuditRouter from "./routes/practiceAudit.js";
import patientDataRequestsRouter from "./routes/patientDataRequests.js";
import practiceDataRequestsRouter from "./routes/practiceDataRequests.js";
import practiceInboxRouter from "./routes/practiceInbox.js";
import practiceTeamRouter from "./routes/practiceTeam.js";
import archiveAiRouter from "./routes/archiveAi.js";
import { validateStartupEnv } from './utils/startupEnvValidation.js';
import { requestContextMiddleware } from "./middleware/requestContext.js";
import { httpErrorHandler } from "./middleware/httpErrorHandler.js";
import {
  publicPrevisitQrLimiter,
  publicSecureDocumentsLimiter,
} from "./middleware/ipRateLimit.js";

const app = express();
const prismaHealth = new PrismaClient();

// Startup checks prevent silent misconfiguration that can break auth/email/API links in production.
validateStartupEnv();

// Render/Proxy setup for correct client IP handling (rate limits, audit logs).
app.set('trust proxy', 1);

app.use(requestContextMiddleware);

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length
      ? allowedOrigins
      : ['http://localhost:5173'], // Fallback für lokale Entwicklung
    credentials: false, // kein Cookie-Handling nötig
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));


app.use('/api/symptom', requireAuth, symptomRoute);
app.use('/api/symptom-thread', requireAuth, symptomThreadRoute);
app.use('/api/textsymptom', requireAuth, symptomThreadRoute);
app.use('/api/koerpersymptomthread', requireAuth, koerpersymptomThread);
app.use('/api/transcribe', requireAuth, transcribeRouter);
app.use('/api/auth', authRouter);
app.use('/api/account', requireAuth, accountRouter);
app.use('/api/account', requireAuth, accountPatientPortalRouter);
app.use('/api/mail', mailRoutes);
app.use("/api/tts", ttsRouter);
app.use("/api/ki", kiRouter);
/** Doctor contacts (Ärztebuch) — JWT required */
app.use("/api/user/doctor-contacts", requireAuth, doctorContactsRouter);
app.use("/api/practices", requireAuth, practicesRouter);
/** Care relationships (Phase 1) — mount before /api/practice catch-alls; flag-gated */
app.use("/api/practice/patients", requireAuth, practicePatientsRouter);
app.use("/api/patient/links", requireAuth, patientCareLinksRouter);
/** Alias for PR-8 patient practice-link APIs */
app.use("/api/patient/practice-links", requireAuth, patientCareLinksRouter);
app.use("/api/patient/inbox", requireAuth, patientInboxRouter);
app.use("/api/patient/threads", requireAuth, patientThreadsRouter);
app.use("/api/patient/messages", requireAuth, patientThreadsRouter);
app.use("/api/patient/medication-plans", requireAuth, patientMedicationPlansRouter);
app.use("/api/patient/practice-documents", requireAuth, patientPracticeDocumentsRouter);
app.use("/api/practice/documents", requireAuth, practiceSecureDocumentLinksRouter);
app.use("/api/patient/data-control", requireAuth, patientDataControlRouter);
app.use("/api/patient/profile-sharing", requireAuth, patientProfileSharingRouter);
app.use("/api/patient/activity", requireAuth, patientActivityRouter);
app.use("/api/practice/audit", requireAuth, practiceAuditRouter);
app.use("/api/patient/data-requests", requireAuth, patientDataRequestsRouter);
app.use("/api/practice/data-requests", requireAuth, practiceDataRequestsRouter);
app.use("/api/practice/inbox", requireAuth, practiceInboxRouter);
app.use("/api/practice/team", requireAuth, practiceTeamRouter);
app.use("/api/archive", requireAuth, archiveAiRouter);
app.use("/api/practice-dashboard", requireAuth, practiceDashboardRouter);
app.use("/api/practice/follow-ups", requireAuth, practiceFollowUpsRouter);
app.use("/api/previsit/follow-ups", requireAuth, previsitFollowUpsRouter);
/** Pre-Visit cases / timelines — JWT required; mount before generic /api/previsit. */
app.use("/api/previsit/cases", requireAuth, previsitCasesRouter);
/** Saved Pre-Visit sessions (DB): JWT required; mount before /api/previsit so paths are not swallowed. */
app.use("/api/previsit/sessions", requireAuth, previsitSessionsRouter);
app.use("/api/previsit", previsitRouter);
app.use("/api/public/previsit", publicPrevisitQrLimiter, publicPrevisitQrRouter);
app.use("/api/public/documents", publicSecureDocumentsLimiter, publicDocumentsRouter);
app.use(
  "/api/documents/secure-download",
  publicSecureDocumentsLimiter,
  secureDocumentDownloadRouter,
);
app.use("/api/practice/dashboard", requireAuth, practiceOverviewDashboardRouter);
app.use("/api/practice/exports", requireAuth, practiceExportsRouter);
app.use("/api/practice", requireAuth, practiceAnalyticsRouter);
app.use("/api/practice", requireAuth, practicePortalRouter);
app.use("/api/practice/api", requireAuth, practiceApiDataRouter);
app.use("/api/places", requireAuth, placesRouter);
/** @deprecated — use /api/places; alias for older clients */
app.use("/api/practice-finder", requireAuth, practiceFinderRouter);

app.get(['/health', '/api/health'], (_req, res) =>
  res.json({
    ok: true,
    service: 'medscoutx-api',
    timestamp: new Date().toISOString(),
  })
);

app.get('/api/health/db', async (_req, res) => {
  try {
    await prismaHealth.$queryRaw`SELECT 1`;
    return res.json({ ok: true, db: true });
  } catch {
    return res.status(503).json({ ok: false, db: false });
  }
});

app.get('/api/health/openai', (_req, res) => {
  const key = process.env.OPENAI_API_KEY;
  const configured = typeof key === 'string' && key.length > 12;
  return res.json({ ok: true, openai: { configured } });
});

/**
 * Safe configuration snapshot — booleans only, no secrets or origins list.
 */
app.get('/api/health/config', (_req, res) =>
  res.json({
    ok: true,
    service: 'medscoutx-api',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    trustProxy: Boolean(app.get('trust proxy')),
    cors: {
      configured: allowedOrigins.length > 0,
      originCount: allowedOrigins.length,
    },
    features: {
      databaseUrl: Boolean(process.env.DATABASE_URL),
      jwt: Boolean(process.env.JWT_SECRET),
      openai: Boolean(process.env.OPENAI_API_KEY),
      resend: Boolean(process.env.RESEND_API_KEY),
      emailFrom: Boolean(process.env.EMAIL_FROM),
      apiBaseUrl: Boolean(process.env.API_BASE_URL),
      frontendUrl:
        Boolean(process.env.FRONTEND_URL) || Boolean(process.env.APP_BASE_URL),
      googlePlaces: Boolean(process.env.GOOGLE_PLACES_API_KEY),
    },
  }),
);

app.get('/', (_req, res) => {
  res.send(`
    <h1>🚀 MedScout API</h1>
    <p>Der Server läuft erfolgreich.</p>
    <ul>
      <li><a href="/health">/health</a></li>
      <li><a href="/api/health">/api/health</a></li>
      <li><a href="/api/symptom">/api/symptom</a></li>
      <li><a href="/api/auth">/api/auth</a></li>
    </ul>
  `);
});


app.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    const APP_BASE_URL =
      process.env.APP_BASE_URL ||
      process.env.VITE_APP_BASE_URL ||
      'https://medscout.app';
    const verifyLink = `${APP_BASE_URL}/verify-email?token=TEST123`;

    const info = await sendVerificationEmail(email, verifyLink);
    res.json({ ok: true, info });
  } catch (err) {
    console.error('[test-email]', err);
    res.status(500).json({ ok: false, error: 'Request failed.' });
  }
});

app.use((req, res, next) => {
  if (res.headersSent) return;
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }
  next();
});

app.use(httpErrorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server läuft unter http://localhost:${PORT}`);
});
