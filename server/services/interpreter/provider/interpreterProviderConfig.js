/**
 * Provider configuration gate for the MEDICAL INTERPRETER.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * The interpreter already had feature flags, all defaulting to false, so the
 * feature could not switch itself on. What it did not have was a credential of
 * its own: `isInterpreterAiConfigured()` was
 *
 *     Boolean(process.env.OPENAI_API_KEY?.trim())
 *
 * and all four services — transcribe, translate, simplify, speak — used the
 * shared client built from that key.
 *
 * The material here is the most sensitive of any provider path in the product:
 * a live consultation between a patient and a clinician, spoken aloud. An
 * approval to send symptom text somewhere is not an approval to send that.
 *
 * ── Fail closed ─────────────────────────────────────────────────────────────
 * Incomplete configuration reports as unconfigured and every service refuses
 * before any audio or text is prepared.
 */

/** Environment variables this feature reads. Nothing else. */
export const INTERPRETER_PROVIDER_ENV = Object.freeze({
  /** Which adapter. "fake" is test-only and never contacts anything. */
  PROVIDER: "INTERPRETER_PROVIDER",
  /** Dedicated credential. Deliberately NOT OPENAI_API_KEY. */
  API_KEY: "INTERPRETER_API_KEY",
  /** Explicit endpoint. No SDK default is accepted. */
  BASE_URL: "INTERPRETER_BASE_URL",
  /** Chat model for translation and plain-language rendering. */
  MODEL: "INTERPRETER_MODEL",
  /** Transcription model. */
  STT_MODEL: "INTERPRETER_STT_MODEL",
  /** Synthesis model. */
  TTS_MODEL: "INTERPRETER_TTS_MODEL",
  /** Operator assertion about where processing happens. */
  DATA_REGION: "INTERPRETER_DATA_REGION",
  /** Operator assertion about retention. Must be exactly "true". */
  ZERO_RETENTION: "INTERPRETER_ZERO_RETENTION",
  /** Test-only behaviour selector for the fake adapter. */
  FAKE_BEHAVIOUR: "INTERPRETER_FAKE_BEHAVIOUR",
});

export const INTERPRETER_PROVIDER_KINDS = Object.freeze({
  OPENAI_COMPATIBLE: "openai",
  FAKE: "fake",
});

/** One spoken turn, transcribed or synthesised. */
export const INTERPRETER_PROVIDER_TIMEOUT_MS = 45_000;

/**
 * Hosts a production deployment may send interpreter material to.
 *
 * Empty on purpose, as for every other hardened path: no endpoint has been
 * through the processing agreement and the disclosure required for recording
 * a live medical conversation. Adding an entry is a deliberate edit.
 */
export const APPROVED_INTERPRETER_PROVIDER_HOSTS = Object.freeze([]);

export function checkInterpreterBaseUrl(baseUrl, isProduction) {
  let url;
  try {
    url = new URL(String(baseUrl));
  } catch {
    return { ok: false, reason: "base_url_invalid" };
  }
  const localhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !localhost) return { ok: false, reason: "base_url_not_https" };
  if (isProduction && !APPROVED_INTERPRETER_PROVIDER_HOSTS.includes(url.hostname)) {
    return { ok: false, reason: "base_url_not_approved" };
  }
  return { ok: true, host: url.hostname };
}

const read = (env, name) => String(env?.[name] ?? "").trim();

/** @param {NodeJS.ProcessEnv} [env] */
export function resolveInterpreterProviderConfig(env = process.env) {
  const kind = read(env, INTERPRETER_PROVIDER_ENV.PROVIDER).toLowerCase();
  const isProduction = env?.NODE_ENV === "production";

  if (!kind) return { configured: false, missing: [INTERPRETER_PROVIDER_ENV.PROVIDER] };

  if (kind === INTERPRETER_PROVIDER_KINDS.FAKE) {
    // Never in production: invented text presented as an interpretation of
    // what a patient just said is worse than the feature being unavailable.
    if (isProduction) {
      return { configured: false, missing: [], reason: "fake_provider_not_allowed_in_production" };
    }
    return {
      configured: true,
      kind,
      fakeBehaviour: read(env, INTERPRETER_PROVIDER_ENV.FAKE_BEHAVIOUR) || undefined,
      missing: [],
    };
  }

  if (kind !== INTERPRETER_PROVIDER_KINDS.OPENAI_COMPATIBLE) {
    return { configured: false, missing: [], reason: "provider_unknown" };
  }

  const missing = [];
  const apiKey = read(env, INTERPRETER_PROVIDER_ENV.API_KEY);
  const baseUrl = read(env, INTERPRETER_PROVIDER_ENV.BASE_URL);
  const model = read(env, INTERPRETER_PROVIDER_ENV.MODEL);
  const dataRegion = read(env, INTERPRETER_PROVIDER_ENV.DATA_REGION);
  const zeroRetention = read(env, INTERPRETER_PROVIDER_ENV.ZERO_RETENTION);

  if (!apiKey) missing.push(INTERPRETER_PROVIDER_ENV.API_KEY);
  if (!baseUrl) missing.push(INTERPRETER_PROVIDER_ENV.BASE_URL);
  if (!model) missing.push(INTERPRETER_PROVIDER_ENV.MODEL);
  if (isProduction && !dataRegion) missing.push(INTERPRETER_PROVIDER_ENV.DATA_REGION);
  if (isProduction && zeroRetention !== "true") missing.push(INTERPRETER_PROVIDER_ENV.ZERO_RETENTION);
  if (missing.length > 0) return { configured: false, missing };

  if (apiKey === read(env, "OPENAI_API_KEY")) {
    return {
      configured: false,
      missing: [INTERPRETER_PROVIDER_ENV.API_KEY],
      reason: "shared_key_refused",
    };
  }

  const urlCheck = checkInterpreterBaseUrl(baseUrl, isProduction);
  if (!urlCheck.ok) {
    return { configured: false, missing: [INTERPRETER_PROVIDER_ENV.BASE_URL], reason: urlCheck.reason };
  }

  return {
    configured: true,
    kind,
    apiKey,
    baseUrl,
    model,
    sttModel: read(env, INTERPRETER_PROVIDER_ENV.STT_MODEL) || undefined,
    ttsModel: read(env, INTERPRETER_PROVIDER_ENV.TTS_MODEL) || undefined,
    dataRegion: dataRegion || undefined,
    zeroRetention: zeroRetention === "true",
    missing: [],
  };
}

/**
 * The single question every interpreter service asks before touching input.
 *
 * Replaces `Boolean(process.env.OPENAI_API_KEY)`. A feature flag says the
 * operator wants the feature; this says they have configured somewhere for it
 * to go. Both are required.
 */
export function isInterpreterProviderConfigured(env = process.env) {
  return resolveInterpreterProviderConfig(env).configured === true;
}
