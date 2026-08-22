/**
 * Provider configuration gate for symptom voice input.
 *
 * ── What this replaces ──────────────────────────────────────────────────────
 * Until this phase, `/api/transcribe` reached OpenAI whenever OPENAI_API_KEY
 * happened to be set. Nothing else was required: no flag, no endpoint decision,
 * no allowlist. A key configured for an unrelated feature was, in practice, an
 * approval to transmit a patient's spoken description of their symptoms.
 *
 * That is the same inference the document, message-translation and dictation
 * gates were each built to prevent, and it survived here because this path is
 * older than all of them. It does not survive any more.
 *
 * ── Fail closed ─────────────────────────────────────────────────────────────
 * An incomplete configuration means unconfigured, and the service refuses
 * before any audio is read. There is no fallback to the shared key — that is
 * the entire point, and it is asserted by a test.
 */

/** Environment variables this feature reads. Nothing else. */
export const SYMPTOM_VOICE_ENV = Object.freeze({
  /** Which adapter. "fake" is test-only and never contacts anything. */
  PROVIDER: "SYMPTOM_VOICE_PROVIDER",
  /** Dedicated credential. Deliberately NOT OPENAI_API_KEY. */
  API_KEY: "SYMPTOM_VOICE_API_KEY",
  /** Explicit endpoint. No SDK default is accepted. */
  BASE_URL: "SYMPTOM_VOICE_BASE_URL",
  /** Recognition model identifier. Never surfaced to a user. */
  MODEL: "SYMPTOM_VOICE_MODEL",
  /** Operator assertion about where processing happens. */
  DATA_REGION: "SYMPTOM_VOICE_DATA_REGION",
  /** Operator assertion about retention. Must be exactly "true". */
  ZERO_RETENTION: "SYMPTOM_VOICE_ZERO_RETENTION",
  /** Test-only behaviour selector. */
  FAKE_BEHAVIOUR: "SYMPTOM_VOICE_FAKE_BEHAVIOUR",
});

export const SYMPTOM_VOICE_KINDS = Object.freeze({
  OPENAI_COMPATIBLE: "openai",
  FAKE: "fake",
});

export const SYMPTOM_VOICE_TIMEOUT_MS = 45_000;

/**
 * Hosts a production deployment may send a symptom recording to.
 *
 * Empty, like every other audio and translation gate in this codebase. Adding
 * an entry is a deliberate edit with its own review, not configuration.
 */
export const APPROVED_SYMPTOM_VOICE_HOSTS = Object.freeze([]);

/** @param {string | undefined} baseUrl @param {boolean} isProduction */
export function checkSymptomVoiceBaseUrl(baseUrl, isProduction) {
  let url;
  try {
    url = new URL(String(baseUrl));
  } catch {
    return { ok: false, reason: "base_url_invalid" };
  }
  const localhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !localhost) return { ok: false, reason: "base_url_not_https" };
  if (isProduction && !APPROVED_SYMPTOM_VOICE_HOSTS.includes(url.hostname)) {
    return { ok: false, reason: "base_url_not_approved" };
  }
  return { ok: true, host: url.hostname };
}

/**
 * Resolves the configuration, or explains exactly what is missing.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveSymptomVoiceConfig(env = process.env) {
  const kind = String(env?.[SYMPTOM_VOICE_ENV.PROVIDER] ?? "").trim().toLowerCase();
  const isProduction = env?.NODE_ENV === "production";

  if (!kind) return { configured: false, missing: [SYMPTOM_VOICE_ENV.PROVIDER] };

  if (kind === SYMPTOM_VOICE_KINDS.FAKE) {
    if (isProduction) {
      return { configured: false, missing: [], reason: "fake_provider_in_production" };
    }
    return {
      configured: true,
      kind,
      fakeBehaviour: env?.[SYMPTOM_VOICE_ENV.FAKE_BEHAVIOUR] || undefined,
      missing: [],
    };
  }

  if (kind !== SYMPTOM_VOICE_KINDS.OPENAI_COMPATIBLE) {
    return { configured: false, missing: [], reason: "provider_unknown" };
  }

  const missing = [];
  const apiKey = String(env?.[SYMPTOM_VOICE_ENV.API_KEY] ?? "").trim();
  const baseUrl = String(env?.[SYMPTOM_VOICE_ENV.BASE_URL] ?? "").trim();
  const model = String(env?.[SYMPTOM_VOICE_ENV.MODEL] ?? "").trim();
  const dataRegion = String(env?.[SYMPTOM_VOICE_ENV.DATA_REGION] ?? "").trim();
  const zeroRetention = String(env?.[SYMPTOM_VOICE_ENV.ZERO_RETENTION] ?? "").trim();

  if (!apiKey) missing.push(SYMPTOM_VOICE_ENV.API_KEY);
  if (!baseUrl) missing.push(SYMPTOM_VOICE_ENV.BASE_URL);
  if (!model) missing.push(SYMPTOM_VOICE_ENV.MODEL);
  if (isProduction && !dataRegion) missing.push(SYMPTOM_VOICE_ENV.DATA_REGION);
  if (isProduction && zeroRetention !== "true") missing.push(SYMPTOM_VOICE_ENV.ZERO_RETENTION);
  if (missing.length > 0) return { configured: false, missing };

  const urlCheck = checkSymptomVoiceBaseUrl(baseUrl, isProduction);
  if (!urlCheck.ok) {
    return { configured: false, missing: [SYMPTOM_VOICE_ENV.BASE_URL], reason: urlCheck.reason };
  }

  return {
    configured: true,
    kind,
    apiKey,
    baseUrl,
    model,
    dataRegion: dataRegion || undefined,
    zeroRetention: zeroRetention === "true",
    missing: [],
  };
}
