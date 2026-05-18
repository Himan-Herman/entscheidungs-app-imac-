/**
 * Lightweight in-memory rate limiting by client IP (fixed windows).
 * Covers OpenAI-backed `/api/previsit/*`, `/api/ki`, outbound mail, auth, account GDPR routes.
 * No request bodies or sensitive fields are logged — only per-IP counters.
 */

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

/** Shared expiry window for all limiters in this module. */
export const RATE_LIMIT_WINDOW_MS = FIFTEEN_MIN_MS;

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) {
    const first = xf.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * @param {{ max: number; keyPrefix: string; windowMs?: number }} opts
 * @returns {import('express').RequestHandler}
 */
export function createIpRateLimiter({ max, keyPrefix, windowMs = FIFTEEN_MIN_MS }) {
  /** @type {Map<string, { count: number; windowStart: number }>} */
  const store = new Map();

  return function ipRateLimit(req, res, next) {
    const ip = getClientIp(req);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    let entry = store.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { count: 0, windowStart: now };
    }
    entry.count += 1;
    store.set(key, entry);
    if (entry.count > max) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
      });
    }
    next();
  };
}

/** POST /api/previsit/doctor-version — OpenAI-backed; 10 / 15 min / IP */
export const previsitDoctorVersionLimiter = createIpRateLimiter({
  max: 10,
  keyPrefix: 'previsit:doctor-version',
});

/** POST /api/previsit/audio/speak — TTS; 20 / 15 min / IP */
export const previsitAudioSpeakLimiter = createIpRateLimiter({
  max: 20,
  keyPrefix: 'previsit:audio:speak',
});

/** POST /api/previsit/audio/transcribe — transcription; 10 / 15 min / IP */
export const previsitAudioTranscribeLimiter = createIpRateLimiter({
  max: 10,
  keyPrefix: 'previsit:audio:transcribe',
});

/** POST .../doctor-contacts/:id/send-previsit-pdf — outbound email; 5 / 15 min / IP */
export const sendPrevisitPdfLimiter = createIpRateLimiter({
  max: 5,
  keyPrefix: 'doctor-contacts:send-previsit-pdf',
});

/** POST /api/previsit/history-diff — factual session comparison; 12 / 15 min / IP */
export const previsitHistoryDiffLimiter = createIpRateLimiter({
  max: 12,
  keyPrefix: 'previsit:history-diff',
});

/** POST /api/previsit/cases/:caseId/continuity-summary — case continuity; 10 / 15 min / IP */
export const previsitCaseContinuityLimiter = createIpRateLimiter({
  max: 10,
  keyPrefix: 'previsit:case-continuity',
});

const ONE_HOUR_MS = 60 * 60 * 1000;

/** POST /api/auth/login — brute-force mitigation */
export const authLoginLimiter = createIpRateLimiter({
  max: 40,
  keyPrefix: 'auth:login',
});

/** POST /api/auth/register */
export const authRegisterLimiter = createIpRateLimiter({
  max: 15,
  keyPrefix: 'auth:register',
});

/** POST /api/auth/request-password-reset */
export const authPasswordResetLimiter = createIpRateLimiter({
  max: 10,
  keyPrefix: 'auth:password-reset',
});

/** POST /api/auth/reset-password */
export const authResetPasswordLimiter = createIpRateLimiter({
  max: 15,
  keyPrefix: 'auth:reset-password',
});

/** POST /api/ki — OpenAI-backed image/chat */
export const kiOpenAiRouteLimiter = createIpRateLimiter({
  max: 45,
  keyPrefix: 'ki:openai',
});

/** POST /api/mail/send — generic outbound mail */
export const mailSendRouteLimiter = createIpRateLimiter({
  max: 25,
  keyPrefix: 'mail:send',
});

/** POST /api/transcribe — Whisper audio (symptom modules); not Pre-Visit chat audio */
export const transcribeRouteLimiter = createIpRateLimiter({
  max: 30,
  keyPrefix: 'transcribe:whisper',
});

/** GET /api/public/previsit/qr/:token — unauthenticated QR resolver */
export const publicPrevisitQrLimiter = createIpRateLimiter({
  max: 150,
  keyPrefix: 'public:previsit:qr',
});

/** GET /api/public/documents/:token — neutral PDF handout */
export const publicSecureDocumentsLimiter = createIpRateLimiter({
  max: 60,
  keyPrefix: "public:secure-documents",
});

/** GET /api/account/export — GDPR JSON export */
export const accountExportLimiter = createIpRateLimiter({
  max: 8,
  keyPrefix: 'account:export',
  windowMs: ONE_HOUR_MS,
});

/** DELETE /api/account/delete — destructive GDPR wipe */
export const accountDeleteLimiter = createIpRateLimiter({
  max: 4,
  keyPrefix: 'account:delete',
  windowMs: ONE_HOUR_MS,
});

/** POST /api/patient/exports — organizational export jobs */
export const patientExportLimiter = createIpRateLimiter({
  max: 20,
  keyPrefix: 'patient:exports',
});

/** POST /api/practice/exports and per-patient export */
export const practiceExportLimiter = createIpRateLimiter({
  max: 25,
  keyPrefix: 'practice:exports',
});

/** POST /api/practice/integrations — FHIR/HL7 parse & preview */
export const integrationParseLimiter = createIpRateLimiter({
  max: 40,
  keyPrefix: 'practice:integrations:parse',
});
