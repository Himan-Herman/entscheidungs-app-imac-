/**
 * Provider configuration gate for Pre-Visit voice input.
 *
 * ── What this replaces ──────────────────────────────────────────────────────
 * Until this phase, POST /api/previsit/audio/transcribe reached OpenAI whenever
 * OPENAI_API_KEY happened to be set — on a route that required no
 * authentication at all. Anyone who could reach the server could spend the
 * deployment's budget and send arbitrary audio to a third party.
 *
 * ── Why a fifth gate rather than reusing one ────────────────────────────────
 * An approval to transmit a chat dictation, or a symptom description typed into
 * one's own account, is not an approval to transmit a pre-visit preparation.
 * The material is different — a patient recounting their history and their
 * questions for a consultation — and so, often, is the person: the Pre-Visit
 * flow is reachable as a guest through a practice's QR code, so the speaker may
 * have no account and no prior relationship with this product at all.
 *
 * ── Fail closed ─────────────────────────────────────────────────────────────
 * An incomplete configuration means unconfigured, and the service refuses
 * before any audio is read. There is no fallback to the shared key, and none to
 * the other features' keys either.
 */

/** Environment variables this feature reads. Nothing else. */
export const PREVISIT_VOICE_ENV = Object.freeze({
  /** Which adapter. "fake" is test-only and never contacts anything. */
  PROVIDER: "PREVISIT_VOICE_PROVIDER",
  /** Dedicated credential. Not OPENAI_API_KEY, and not the other audio keys. */
  API_KEY: "PREVISIT_VOICE_API_KEY",
  /** Explicit endpoint. No SDK default is accepted. */
  BASE_URL: "PREVISIT_VOICE_BASE_URL",
  /** Recognition model identifier. Never surfaced to a user. */
  MODEL: "PREVISIT_VOICE_MODEL",
  /** Operator assertion about where processing happens. */
  DATA_REGION: "PREVISIT_VOICE_DATA_REGION",
  /** Operator assertion about retention. Must be exactly "true". */
  ZERO_RETENTION: "PREVISIT_VOICE_ZERO_RETENTION",
  /** Test-only behaviour selector. */
  FAKE_BEHAVIOUR: "PREVISIT_VOICE_FAKE_BEHAVIOUR",
});

export const PREVISIT_VOICE_KINDS = Object.freeze({
  OPENAI_COMPATIBLE: "openai",
  FAKE: "fake",
});

/** Three minutes of audio, plus transfer. */
export const PREVISIT_VOICE_TIMEOUT_MS = 60_000;

/**
 * Hosts a production deployment may send a pre-visit recording to.
 *
 * Empty, like every other audio and translation gate in this codebase. Adding
 * an entry is a deliberate edit with its own review, not configuration — and
 * for this path it also needs an answer to what a guest of a practice was told
 * before they pressed record.
 */
export const APPROVED_PREVISIT_VOICE_HOSTS = Object.freeze([]);

/** @param {string | undefined} baseUrl @param {boolean} isProduction */
export function checkPreVisitVoiceBaseUrl(baseUrl, isProduction) {
  let url;
  try {
    url = new URL(String(baseUrl));
  } catch {
    return { ok: false, reason: "base_url_invalid" };
  }
  const localhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !localhost) return { ok: false, reason: "base_url_not_https" };
  if (isProduction && !APPROVED_PREVISIT_VOICE_HOSTS.includes(url.hostname)) {
    return { ok: false, reason: "base_url_not_approved" };
  }
  return { ok: true, host: url.hostname };
}

/**
 * Resolves the configuration, or explains exactly what is missing.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolvePreVisitVoiceConfig(env = process.env) {
  const kind = String(env?.[PREVISIT_VOICE_ENV.PROVIDER] ?? "").trim().toLowerCase();
  const isProduction = env?.NODE_ENV === "production";

  if (!kind) return { configured: false, missing: [PREVISIT_VOICE_ENV.PROVIDER] };

  if (kind === PREVISIT_VOICE_KINDS.FAKE) {
    if (isProduction) {
      return { configured: false, missing: [], reason: "fake_provider_in_production" };
    }
    return {
      configured: true,
      kind,
      fakeBehaviour: env?.[PREVISIT_VOICE_ENV.FAKE_BEHAVIOUR] || undefined,
      missing: [],
    };
  }

  if (kind !== PREVISIT_VOICE_KINDS.OPENAI_COMPATIBLE) {
    return { configured: false, missing: [], reason: "provider_unknown" };
  }

  const missing = [];
  const apiKey = String(env?.[PREVISIT_VOICE_ENV.API_KEY] ?? "").trim();
  const baseUrl = String(env?.[PREVISIT_VOICE_ENV.BASE_URL] ?? "").trim();
  const model = String(env?.[PREVISIT_VOICE_ENV.MODEL] ?? "").trim();
  const dataRegion = String(env?.[PREVISIT_VOICE_ENV.DATA_REGION] ?? "").trim();
  const zeroRetention = String(env?.[PREVISIT_VOICE_ENV.ZERO_RETENTION] ?? "").trim();

  if (!apiKey) missing.push(PREVISIT_VOICE_ENV.API_KEY);
  if (!baseUrl) missing.push(PREVISIT_VOICE_ENV.BASE_URL);
  if (!model) missing.push(PREVISIT_VOICE_ENV.MODEL);
  if (isProduction && !dataRegion) missing.push(PREVISIT_VOICE_ENV.DATA_REGION);
  if (isProduction && zeroRetention !== "true") missing.push(PREVISIT_VOICE_ENV.ZERO_RETENTION);
  if (missing.length > 0) return { configured: false, missing };

  const urlCheck = checkPreVisitVoiceBaseUrl(baseUrl, isProduction);
  if (!urlCheck.ok) {
    return { configured: false, missing: [PREVISIT_VOICE_ENV.BASE_URL], reason: urlCheck.reason };
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
