/**
 * Lightweight in-memory rate limiting by client IP (fixed windows).
 * Covers OpenAI-backed `/api/previsit/*`, outbound mail, auth, account GDPR routes.
 * No request bodies or sensitive fields are logged — only per-IP counters.
 */

import { rateLimitMax } from "./rateLimitConfig.js";

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

/** Shared expiry window for all limiters in this module. */
export const RATE_LIMIT_WINDOW_MS = FIFTEEN_MIN_MS;

export function getClientIp(req) {
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

/** POST /api/previsit/audio/speak — read-aloud; 20 / 15 min / IP (in addition to the flag and the participation boundary). */
export const previsitAudioSpeakLimiter = createIpRateLimiter({
  max: 20,
  keyPrefix: 'previsit:audio:speak',
});

/** POST /api/previsit/audio/transcribe — transcription; 10 / 15 min / IP */
export const previsitAudioTranscribeLimiter = createIpRateLimiter({
  max: rateLimitMax("PREVISIT_VOICE_IP_MAX", {
    fallback: 10,
    min: 3,
    max: 120,
    why: "Each request uploads audio and reaches a speech provider; a wide band would make one address expensive.",
  }),
  keyPrefix: 'previsit:audio:transcribe',
});

/**
 * POST /api/tts — symptom read-aloud; 30 / 15 min / IP.
 *
 * The endpoint had no limit at all. Thirty covers reading back every reply in a
 * long symptom conversation and still bounds what one address can spend at a
 * speech provider; the route also requires a session, so this is a second
 * bound, not the only one.
 */
export const symptomSpeechLimiter = createIpRateLimiter({
  max: rateLimitMax("SYMPTOM_SPEECH_IP_MAX", {
    fallback: 30,
    min: 5,
    max: 300,
    why: "Speech synthesis is per-request billable; the band allows a busy session, not a scraper.",
  }),
  keyPrefix: 'symptom:speech',
});

/** POST .../doctor-contacts/:id/send-previsit-pdf — outbound email; 5 / 15 min / IP */
export const sendPrevisitPdfLimiter = createIpRateLimiter({
  max: 5,
  keyPrefix: 'doctor-contacts:send-previsit-pdf',
});

/** POST /api/previsit/history-diff — factual session comparison; 12 / 15 min / IP */
/**
 * POST /api/previsit/symptoms-followup and /api/previsit/adaptive-intake.
 *
 * Both reach a provider and both are deliberately usable without an account:
 * a patient who opens Pre-Visit directly, with no QR code and no login, is a
 * legitimate flow, so there is no session to bind to. Measured before this
 * limiter existed, an arbitrary anonymous request produced an outbound
 * provider call in 2.5 seconds, unbounded.
 *
 * The band is generous enough for a real intake conversation — each answer is
 * one call and a session is a handful of turns — and far below what makes the
 * endpoint worth abusing.
 */
export const previsitAdaptiveTurnLimiter = createIpRateLimiter({
  max: rateLimitMax("PREVISIT_ADAPTIVE_IP_MAX", {
    fallback: 30,
    min: 5,
    max: 300,
    why: "One provider call per answered question; an intake conversation is tens of turns, not hundreds.",
  }),
  keyPrefix: "previsit_adaptive",
});

export const previsitHistoryDiffLimiter = createIpRateLimiter({
  max: 12,
  keyPrefix: 'previsit:history-diff',
});

/** POST /api/previsit/assistant-questions — bilingual orientation questions; 10 / 15 min / IP */
export const previsitAssistantQuestionsLimiter = createIpRateLimiter({
  max: 10,
  keyPrefix: 'previsit:assistant-questions',
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

/**
 * POST /api/practice/patients/link-request — practice-initiated link request by patient email.
 * Tight cap to prevent account-fishing (the endpoint always responds neutrally regardless of
 * whether an account exists, but rate-limiting adds defence in depth).
 */
export const practiceLinkRequestLimiter = createIpRateLimiter({
  max: 12,
  keyPrefix: 'practice:link-request',
});

/** POST /api/practice/meda/pdf-link — authenticated PDF upload for the QR link */
export const medaPdfLinkLimiter = createIpRateLimiter({
  max: 30,
  keyPrefix: 'practice:meda-pdf-link',
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

/** POST /api/mail/send — generic outbound mail */
export const mailSendRouteLimiter = createIpRateLimiter({
  max: 25,
  keyPrefix: 'mail:send',
});

/**
 * POST /api/transcribe — voice input in the symptom modules.
 *
 * Renamed from transcribeRouteLimiter so the limiter says which feature it
 * bounds rather than which technique it uses. Tighter than before: every
 * accepted request transmits a recording, and twenty per quarter hour is far
 * more dictation than describing symptoms involves.
 */
export const symptomVoiceRouteLimiter = createIpRateLimiter({
  max: rateLimitMax("SYMPTOM_VOICE_IP_MAX", {
    fallback: 20,
    min: 5,
    max: 200,
    why: "Audio upload plus transcription; same reasoning as the pre-visit voice limit.",
  }),
  // Named for the feature, not for the technique that happens to implement it.
  keyPrefix: 'symptom_voice',
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

/** GET /api/public/emergency/:token — unauthenticated SOS-Karte view */
export const publicEmergencyLimiter = createIpRateLimiter({
  max: 120,
  keyPrefix: 'public:emergency',
});

/** /api/sos/wallet/* — authenticated SOS wallet status + pass generation; 30 / 15 min / IP */
export const sosWalletLimiter = createIpRateLimiter({
  max: 30,
  keyPrefix: 'sos:wallet',
});

/** GET /api/patient/practice-documents/:id/lab-explanation — OpenAI-backed; 8 / 15 min / IP */
export const labExplanationIpLimiter = createIpRateLimiter({
  max: 8,
  keyPrefix: 'patient:lab-explanation',
});

/** GET /api/public/anamnesis/qr/:token + POST …/submit — unauthenticated patient intake */
export const publicAnamnesisLimiter = createIpRateLimiter({
  max: 100,
  keyPrefix: 'public:anamnesis',
});

/** POST /api/practice/booking/appointments/:id/assist — OpenAI-backed B2B scheduling assistant; 10 / 15 min / IP */
export const bookingAssistLimiter = createIpRateLimiter({
  max: 10,
  keyPrefix: 'practice:booking:assist',
});

/**
 * Patient document transformation.
 *
 * Tighter than the other AI limiters: every accepted request costs a worker
 * thread for extraction and an external model call. Per-patient concurrency is
 * enforced separately in the service, since an IP limit does not stop one
 * patient firing many requests from one address.
 */
/**
 * POST .../messages/:messageId/translation
 *
 * Looser than the document limiter — one short message costs a fraction of a
 * whole file — but present all the same. Most repeat requests never reach a
 * provider at all: an unchanged message in the same language is served from
 * the store, so the limiter is there for the case the cache cannot answer,
 * which is a genuinely new translation.
 */
/**
 * POST .../dictation
 *
 * Tighter than the text limiters, and for a different reason than cost: every
 * accepted request transmits a recording. Twenty per quarter hour is far more
 * dictation than composing messages to a practice involves, and it bounds how
 * much audio one address can push outwards if something goes wrong at the other
 * end of the microphone button.
 */
export const messageSttIpLimiter = createIpRateLimiter({
  max: rateLimitMax("MESSAGE_STT_IP_MAX", {
    fallback: 20,
    min: 5,
    max: 200,
    why: "Dictation into a practice message; one clinician dictates far below this.",
  }),
  keyPrefix: "message_stt",
});

export const messageTranslationIpLimiter = createIpRateLimiter({
  max: rateLimitMax("MESSAGE_TRANSLATION_IP_MAX", {
    fallback: 60,
    min: 10,
    max: 600,
    why: "Text-only and cheap per call, so the band is wider — but still a band.",
  }),
  keyPrefix: "message_translation",
});

export const documentTranslationIpLimiter = createIpRateLimiter({
  // Overridable so a deployment can tune it and so HTTP tests, which all
  // originate from one loopback address, are not throttled by each other.
  // The default is what production runs on.
  max: rateLimitMax("DOCUMENT_TRANSLATION_IP_MAX", {
    fallback: 20,
    min: 5,
    max: 200,
    why: "A whole document per call; the most expensive of these paths.",
  }),
  keyPrefix: "document_translation",
});

/**
 * PUBLIC invitation preview by link token.
 *
 * This is the only unauthenticated endpoint of the onboarding module, so it is
 * also the only one an outsider can point a script at. Guessing the token is not
 * the threat — 256 bits does not fall to brute force — the threat is using the
 * endpoint as an oracle at volume. The limit is generous enough that a real
 * person following a link, reloading, and switching between devices never
 * notices, and small enough that scripted enumeration is pointless.
 *
 * Deliberately NOT overridable towards zero: the band's floor keeps a
 * misconfiguration from locking out ordinary patients.
 */
export const invitationPreviewLimiter = createIpRateLimiter({
  max: rateLimitMax("INVITATION_PREVIEW_IP_MAX", {
    fallback: 60,
    min: 20,
    max: 600,
    why: "A patient reloading a link must never be blocked; scripted probing must be.",
  }),
  keyPrefix: "invitation:preview",
});

/**
 * PUBLIC check of a typed on-site code.
 *
 * Much tighter than the link preview, because the credential is much shorter:
 * ~60 bits typed by hand versus 256 bits in a URL. Nobody types a code sixty
 * times; a script would. The 60-minute lifetime and this ceiling together mean
 * the reachable fraction of the code space stays negligible.
 */
export const invitationManualCodeLimiter = createIpRateLimiter({
  max: rateLimitMax("INVITATION_MANUAL_CODE_IP_MAX", {
    fallback: 10,
    min: 5,
    max: 100,
    why: "A short typed credential; the window must stay far too small to search.",
  }),
  keyPrefix: "invitation:manual-code",
});

/**
 * AUTHENTICATED practice-side issuing of invitations and codes.
 *
 * Not an anti-guessing measure — the caller is already a known member of a known
 * practice — but a ceiling on how fast one practice can produce credentials and
 * on how much a stolen practice session could generate before anyone notices.
 * A day of normal reception work sits far below this.
 */
export const invitationIssueLimiter = createIpRateLimiter({
  max: rateLimitMax("INVITATION_ISSUE_IP_MAX", {
    fallback: 60,
    min: 20,
    max: 600,
    why: "A busy reception desk must fit comfortably; a runaway script must not.",
  }),
  keyPrefix: "invitation:issue",
});
