/**
 * Medical Interpreter — IP rate limits with consistent JSON error bodies.
 * No request bodies or transcripts are logged.
 */

import { RATE_LIMIT_WINDOW_MS, getClientIp } from "./ipRateLimit.js";

const RATE_LIMIT_BODY = {
  ok: false,
  error: "rate_limited",
  message: "Too many requests. Please wait a moment.",
};

/**
 * @param {{ max: number; keyPrefix: string; windowMs?: number }} opts
 * @returns {import('express').RequestHandler}
 */
export function createInterpreterIpRateLimiter({
  max,
  keyPrefix,
  windowMs = RATE_LIMIT_WINDOW_MS,
}) {
  /** @type {Map<string, { count: number; windowStart: number }>} */
  const store = new Map();

  return function interpreterIpRateLimit(req, res, next) {
    const key = `${keyPrefix}:${getClientIp(req)}`;
    const now = Date.now();
    let entry = store.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { count: 0, windowStart: now };
    }
    entry.count += 1;
    store.set(key, entry);
    if (entry.count > max) {
      return res.status(429).json(RATE_LIMIT_BODY);
    }
    return next();
  };
}

/** All interpreter POST endpoints combined — abuse ceiling per IP */
export const interpreterSharedLimiter = createInterpreterIpRateLimiter({
  max: 85,
  keyPrefix: "interpreter:shared",
});

/** POST /api/interpreter/transcribe */
export const interpreterTranscribeLimiter = createInterpreterIpRateLimiter({
  max: 8,
  keyPrefix: "interpreter:transcribe",
});

/** POST /api/interpreter/translate */
export const interpreterTranslateLimiter = createInterpreterIpRateLimiter({
  max: 24,
  keyPrefix: "interpreter:translate",
});

/** POST /api/interpreter/simplify */
export const interpreterSimplifyLimiter = createInterpreterIpRateLimiter({
  max: 16,
  keyPrefix: "interpreter:simplify",
});

/** POST /api/interpreter/speak */
export const interpreterSpeakLimiter = createInterpreterIpRateLimiter({
  max: 12,
  keyPrefix: "interpreter:speak",
});

/** Cloud session routes — combined ceiling */
export const interpreterCloudSharedLimiter = createInterpreterIpRateLimiter({
  max: 40,
  keyPrefix: "interpreter:cloud:shared",
});

/** GET cloud sessions */
export const interpreterCloudReadLimiter = createInterpreterIpRateLimiter({
  max: 30,
  keyPrefix: "interpreter:cloud:read",
});

/** POST/PUT cloud sessions */
export const interpreterCloudWriteLimiter = createInterpreterIpRateLimiter({
  max: 20,
  keyPrefix: "interpreter:cloud:write",
});

/** DELETE cloud sessions (single or all) */
export const interpreterCloudDeleteLimiter = createInterpreterIpRateLimiter({
  max: 10,
  keyPrefix: "interpreter:cloud:delete",
});

/** GET public invite token status — enumeration protection */
export const interpreterInviteValidateLimiter = createInterpreterIpRateLimiter({
  max: 40,
  keyPrefix: "interpreter:invite:validate",
});

/** Practice invite list */
export const interpreterInviteManageReadLimiter = createInterpreterIpRateLimiter({
  max: 60,
  keyPrefix: "interpreter:invite:manage:read",
});

/** Practice invite create/revoke */
export const interpreterInviteManageWriteLimiter = createInterpreterIpRateLimiter({
  max: 25,
  keyPrefix: "interpreter:invite:manage:write",
});

/** Practice share grant/revoke + public invite start */
export const interpreterInviteShareLimiter = createInterpreterIpRateLimiter({
  max: 20,
  keyPrefix: "interpreter:practice:share",
});

/** Practice session list/detail */
export const interpreterPracticeSessionReadLimiter = createInterpreterIpRateLimiter({
  max: 60,
  keyPrefix: "interpreter:practice:session:read",
});

/** Streaming STT — combined ceiling */
export const interpreterStreamSharedLimiter = createInterpreterIpRateLimiter({
  max: 40,
  keyPrefix: "interpreter:stream:shared",
});

/** Streaming STT chunk upload */
export const interpreterStreamChunkLimiter = createInterpreterIpRateLimiter({
  max: 90,
  keyPrefix: "interpreter:stream:chunk",
});

/** Near-realtime preview translate (Phase 5.4) */
export const interpreterNearRealtimeTranslateLimiter = createInterpreterIpRateLimiter({
  max: 18,
  keyPrefix: "interpreter:near-realtime:translate",
});

/** Streaming / near-realtime TTS (Phase 5.5) */
export const interpreterStreamSpeakLimiter = createInterpreterIpRateLimiter({
  max: 14,
  keyPrefix: "interpreter:stream:speak",
});
