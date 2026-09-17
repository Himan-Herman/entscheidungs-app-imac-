/**
 * Provider configuration gate for Pre-Visit read-aloud.
 *
 * ── What this replaces ──────────────────────────────────────────────────────
 * `POST /api/previsit/audio/speak` reached OpenAI through the shared client
 * whenever OPENAI_API_KEY happened to be set — on a router with no
 * authentication. No flag, no allowlist, no endpoint decision.
 *
 * ── Why a gate of its own rather than the Pre-Visit input gate ──────────────
 * Approving the transmission of a patient's recorded voice to a recognition
 * provider is not approving the transmission of their preparation text to a
 * synthesis provider. Different processing, potentially a different company,
 * and an operator may want one without the other.
 *
 * ── Fail closed ─────────────────────────────────────────────────────────────
 * An incomplete configuration means unconfigured, and the service refuses
 * before any text is prepared. There is no fallback to the shared key and none
 * to the other audio features' keys — asserted by tests.
 */

/** Environment variables this feature reads. Nothing else. */
export const PREVISIT_SPEECH_ENV = Object.freeze({
  /** Which adapter. "fake" is test-only and never contacts anything. */
  PROVIDER: "PREVISIT_SPEECH_PROVIDER",
  /** Dedicated credential. Deliberately NOT OPENAI_API_KEY. */
  API_KEY: "PREVISIT_SPEECH_API_KEY",
  /** Explicit endpoint. No SDK default is accepted. */
  BASE_URL: "PREVISIT_SPEECH_BASE_URL",
  /** Synthesis model identifier. Never surfaced to a user. */
  MODEL: "PREVISIT_SPEECH_MODEL",
  /** The provider's name for the voice. Mapped from our internal name, never sent by a client. */
  VOICE: "PREVISIT_SPEECH_VOICE",
  /** Operator assertion about where processing happens. */
  DATA_REGION: "PREVISIT_SPEECH_DATA_REGION",
  /** Operator assertion about retention. Must be exactly "true". */
  ZERO_RETENTION: "PREVISIT_SPEECH_ZERO_RETENTION",
  /** Test-only behaviour selector. */
  FAKE_BEHAVIOUR: "PREVISIT_SPEECH_FAKE_BEHAVIOUR",
});

export const PREVISIT_SPEECH_KINDS = Object.freeze({
  OPENAI_COMPATIBLE: "openai",
  FAKE: "fake",
});

/** Synthesis of at most 1200 characters, plus transfer of the audio back. */
export const PREVISIT_SPEECH_TIMEOUT_MS = 30_000;

/**
 * Hosts a production deployment may send Pre-Visit text to for synthesis.
 *
 * Empty, like every other audio and translation gate here. Adding an entry is a
 * deliberate edit with its own review — and for this path that review also
 * needs an answer to what a guest of a practice was told before pressing play.
 */
export const APPROVED_PREVISIT_SPEECH_HOSTS = Object.freeze([]);

/** @param {string | undefined} baseUrl @param {boolean} isProduction */
export function checkPreVisitSpeechBaseUrl(baseUrl, isProduction) {
  let url;
  try {
    url = new URL(String(baseUrl));
  } catch {
    return { ok: false, reason: "base_url_invalid" };
  }
  const localhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !localhost) return { ok: false, reason: "base_url_not_https" };
  if (isProduction && !APPROVED_PREVISIT_SPEECH_HOSTS.includes(url.hostname)) {
    return { ok: false, reason: "base_url_not_approved" };
  }
  return { ok: true, host: url.hostname };
}

/**
 * Resolves the configuration, or explains exactly what is missing.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolvePreVisitSpeechConfig(env = process.env) {
  const kind = String(env?.[PREVISIT_SPEECH_ENV.PROVIDER] ?? "").trim().toLowerCase();
  const isProduction = env?.NODE_ENV === "production";

  if (!kind) return { configured: false, missing: [PREVISIT_SPEECH_ENV.PROVIDER] };

  if (kind === PREVISIT_SPEECH_KINDS.FAKE) {
    if (isProduction) {
      return { configured: false, missing: [], reason: "fake_provider_in_production" };
    }
    return {
      configured: true,
      kind,
      fakeBehaviour: env?.[PREVISIT_SPEECH_ENV.FAKE_BEHAVIOUR] || undefined,
      missing: [],
    };
  }

  if (kind !== PREVISIT_SPEECH_KINDS.OPENAI_COMPATIBLE) {
    return { configured: false, missing: [], reason: "provider_unknown" };
  }

  const missing = [];
  const apiKey = String(env?.[PREVISIT_SPEECH_ENV.API_KEY] ?? "").trim();
  const baseUrl = String(env?.[PREVISIT_SPEECH_ENV.BASE_URL] ?? "").trim();
  const model = String(env?.[PREVISIT_SPEECH_ENV.MODEL] ?? "").trim();
  const voice = String(env?.[PREVISIT_SPEECH_ENV.VOICE] ?? "").trim();
  const dataRegion = String(env?.[PREVISIT_SPEECH_ENV.DATA_REGION] ?? "").trim();
  const zeroRetention = String(env?.[PREVISIT_SPEECH_ENV.ZERO_RETENTION] ?? "").trim();

  if (!apiKey) missing.push(PREVISIT_SPEECH_ENV.API_KEY);
  if (!baseUrl) missing.push(PREVISIT_SPEECH_ENV.BASE_URL);
  if (!model) missing.push(PREVISIT_SPEECH_ENV.MODEL);
  if (!voice) missing.push(PREVISIT_SPEECH_ENV.VOICE);
  if (isProduction && !dataRegion) missing.push(PREVISIT_SPEECH_ENV.DATA_REGION);
  if (isProduction && zeroRetention !== "true") missing.push(PREVISIT_SPEECH_ENV.ZERO_RETENTION);
  if (missing.length > 0) return { configured: false, missing };

  const urlCheck = checkPreVisitSpeechBaseUrl(baseUrl, isProduction);
  if (!urlCheck.ok) {
    return { configured: false, missing: [PREVISIT_SPEECH_ENV.BASE_URL], reason: urlCheck.reason };
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
