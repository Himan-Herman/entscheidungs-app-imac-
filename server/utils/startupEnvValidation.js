import { getRateLimitConfigProblems } from '../middleware/rateLimitConfig.js';
import { getStorageConfigProblems, STORAGE_ROOT_ENV } from '../config/storageRoot.js';
/**
 * Startup validation for production readiness.
 * Logs only variable names (never secret values).
 */

const EMAIL_FROM_PATTERN = /^[^<>]+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/;

function hasValue(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0;
}

function warnMissing(varName) {
  console.warn(`[startup] Missing env var: ${varName}`);
}

export function validateStartupEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'OPENAI_API_KEY',
    'RESEND_API_KEY',
    'EMAIL_FROM',
    'CORS_ORIGIN',
    'API_BASE_URL',
  ];

  /** @type {string[]} */
  const missingCritical = [];

  // Rate limits are overridable so a loopback test suite is not throttled
  // against itself. In production an out-of-band value is a configuration
  // error, not a preference: it either disables the limit or breaks the route.
  for (const problem of getRateLimitConfigProblems()) {
    console.error(`[startup] rate limit misconfigured: ${problem}`);
    missingCritical.push('RATE_LIMIT_CONFIG');
  }

  // Files that must outlive a deploy. Same shape as the rate-limit check above,
  // and the same reason: in production an unset value is not a preference, it
  // is a configuration error — here one that would write patient documents,
  // account exports and avatars into a directory the next release replaces.
  // Nothing would fail at the time; the files would simply not be there later.
  for (const problem of getStorageConfigProblems()) {
    console.error(`[startup] storage misconfigured: ${problem}`);
    missingCritical.push(STORAGE_ROOT_ENV);
  }

  for (const varName of required) {
    if (!hasValue(varName)) {
      warnMissing(varName);
      missingCritical.push(varName);
    }
  }

  if (!hasValue('FRONTEND_URL') && !hasValue('APP_BASE_URL')) {
    console.warn('[startup] Missing env var: FRONTEND_URL or APP_BASE_URL');
    missingCritical.push('FRONTEND_URL_OR_APP_BASE_URL');
  }

  const emailFrom = process.env.EMAIL_FROM;
  if (emailFrom && !EMAIL_FROM_PATTERN.test(emailFrom.trim())) {
    console.warn(
      '[startup] EMAIL_FROM format warning: expected "MedScoutX <no-reply@example.com>"'
    );
  }

  // Production-only warnings so localhost fallbacks are never silent.
  if (isProd) {
    if (!hasValue('CORS_ORIGIN')) {
      console.warn(
        '[startup] Production warning: CORS_ORIGIN missing; app.js fallback uses localhost origin.'
      );
    }
    if (!hasValue('API_BASE_URL')) {
      console.warn(
        '[startup] Production warning: API_BASE_URL missing; auth/email verify links may fallback to localhost.'
      );
    }
    if (!hasValue('FRONTEND_URL') && !hasValue('APP_BASE_URL')) {
      console.warn(
        '[startup] Production warning: FRONTEND_URL/APP_BASE_URL missing; password-reset and verify redirects may be broken.'
      );
    }
  }

  // In production fail fast for critical env gaps to prevent broken auth/email/API behavior.
  if (isProd && missingCritical.length > 0) {
    throw new Error(
      `[startup] Critical env missing: ${missingCritical.join(', ')}`
    );
  }
}
