/**
 * Provider configuration gate for symptom read-aloud.
 *
 * ── What this replaces ──────────────────────────────────────────────────────
 * `/api/tts` constructed an OpenAI client at import time from OPENAI_API_KEY
 * and spoke whatever it was given. No flag, no allowlist, no endpoint decision:
 * a key configured for something else was, in practice, an approval to send a
 * patient's symptom conversation to a speech provider.
 *
 * ── Fail closed ─────────────────────────────────────────────────────────────
 * An incomplete configuration means unconfigured, and the service refuses
 * before any text is prepared. There is no fallback to the shared key and none
 * to the other audio features' keys — asserted by tests.
 */

/** Environment variables this feature reads. Nothing else. */
export const SYMPTOM_SPEECH_ENV = Object.freeze({
  /** Which adapter. "fake" is test-only and never contacts anything. */
  PROVIDER: "SYMPTOM_SPEECH_PROVIDER",
  /** Dedicated credential. Deliberately NOT OPENAI_API_KEY. */
  API_KEY: "SYMPTOM_SPEECH_API_KEY",
  /** Explicit endpoint. No SDK default is accepted. */
  BASE_URL: "SYMPTOM_SPEECH_BASE_URL",
  /** Synthesis model identifier. Never surfaced to a user. */
  MODEL: "SYMPTOM_SPEECH_MODEL",
  /** The provider's name for the voice. Mapped from our internal name, never sent by a client. */
  VOICE: "SYMPTOM_SPEECH_VOICE",
  /** Operator assertion about where processing happens. */
  DATA_REGION: "SYMPTOM_SPEECH_DATA_REGION",
  /** Operator assertion about retention. Must be exactly "true". */
  ZERO_RETENTION: "SYMPTOM_SPEECH_ZERO_RETENTION",
  /** Test-only behaviour selector. */
  FAKE_BEHAVIOUR: "SYMPTOM_SPEECH_FAKE_BEHAVIOUR",
});

export const SYMPTOM_SPEECH_KINDS = Object.freeze({
  OPENAI_COMPATIBLE: "openai",
  FAKE: "fake",
});

/** Synthesis of at most 1200 characters, plus transfer of the audio back. */
export const SYMPTOM_SPEECH_TIMEOUT_MS = 30_000;

/**
 * Hosts a production deployment may send symptom text to for synthesis.
 *
 * Empty, like every other audio and translation gate here. Adding an entry is a
 * deliberate edit with its own review, not configuration.
 */
export const APPROVED_SYMPTOM_SPEECH_HOSTS = Object.freeze([]);

/** @param {string | undefined} baseUrl @param {boolean} isProduction */
export function checkSymptomSpeechBaseUrl(baseUrl, isProduction) {
  let url;
  try {
    url = new URL(String(baseUrl));
  } catch {
    return { ok: false, reason: "base_url_invalid" };
  }
  const localhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !localhost) return { ok: false, reason: "base_url_not_https" };
  if (isProduction && !APPROVED_SYMPTOM_SPEECH_HOSTS.includes(url.hostname)) {
    return { ok: false, reason: "base_url_not_approved" };
  }
  return { ok: true, host: url.hostname };
}

/**
 * Resolves the configuration, or explains exactly what is missing.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveSymptomSpeechConfig(env = process.env) {
  const kind = String(env?.[SYMPTOM_SPEECH_ENV.PROVIDER] ?? "").trim().toLowerCase();
  const isProduction = env?.NODE_ENV === "production";

  if (!kind) return { configured: false, missing: [SYMPTOM_SPEECH_ENV.PROVIDER] };

  if (kind === SYMPTOM_SPEECH_KINDS.FAKE) {
    if (isProduction) {
      return { configured: false, missing: [], reason: "fake_provider_in_production" };
    }
    return {
      configured: true,
      kind,
      fakeBehaviour: env?.[SYMPTOM_SPEECH_ENV.FAKE_BEHAVIOUR] || undefined,
      missing: [],
    };
  }

  if (kind !== SYMPTOM_SPEECH_KINDS.OPENAI_COMPATIBLE) {
    return { configured: false, missing: [], reason: "provider_unknown" };
  }

  const missing = [];
  const apiKey = String(env?.[SYMPTOM_SPEECH_ENV.API_KEY] ?? "").trim();
  const baseUrl = String(env?.[SYMPTOM_SPEECH_ENV.BASE_URL] ?? "").trim();
  const model = String(env?.[SYMPTOM_SPEECH_ENV.MODEL] ?? "").trim();
  const voice = String(env?.[SYMPTOM_SPEECH_ENV.VOICE] ?? "").trim();
  const dataRegion = String(env?.[SYMPTOM_SPEECH_ENV.DATA_REGION] ?? "").trim();
  const zeroRetention = String(env?.[SYMPTOM_SPEECH_ENV.ZERO_RETENTION] ?? "").trim();

  if (!apiKey) missing.push(SYMPTOM_SPEECH_ENV.API_KEY);
  if (!baseUrl) missing.push(SYMPTOM_SPEECH_ENV.BASE_URL);
  if (!model) missing.push(SYMPTOM_SPEECH_ENV.MODEL);
  if (!voice) missing.push(SYMPTOM_SPEECH_ENV.VOICE);
  if (isProduction && !dataRegion) missing.push(SYMPTOM_SPEECH_ENV.DATA_REGION);
  if (isProduction && zeroRetention !== "true") missing.push(SYMPTOM_SPEECH_ENV.ZERO_RETENTION);
  if (missing.length > 0) return { configured: false, missing };

  const urlCheck = checkSymptomSpeechBaseUrl(baseUrl, isProduction);
  if (!urlCheck.ok) {
    return { configured: false, missing: [SYMPTOM_SPEECH_ENV.BASE_URL], reason: urlCheck.reason };
  }

  return {
    configured: true,
    kind,
    apiKey,
    baseUrl,
    model,
    voice,
    dataRegion: dataRegion || undefined,
    zeroRetention: zeroRetention === "true",
    missing: [],
  };
}
