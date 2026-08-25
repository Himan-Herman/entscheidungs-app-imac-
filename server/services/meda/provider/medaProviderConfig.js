/**
 * Provider configuration gate for MEDA.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * Until this phase Meda had no switch of its own. `isMedaEnabled()` was
 *
 *     Boolean(process.env.OPENAI_API_KEY?.trim())
 *
 * so a key configured for any other feature silently turned on a chat that
 * answers patients' medical-literacy questions. That is the same inference the
 * translation and speech gates were built to prevent: the presence of a
 * credential somewhere is not a decision to send THIS data anywhere.
 *
 * Meda therefore requires its own, explicitly named configuration. Nothing is
 * inherited, nothing is defaulted, and OPENAI_API_KEY is not a substitute for
 * any of it.
 *
 * ── Fail closed ─────────────────────────────────────────────────────────────
 * Incomplete configuration reports as unconfigured and the service refuses. No
 * patient question leaves the server in that state.
 *
 * ── What the assertions mean ────────────────────────────────────────────────
 * DATA_REGION and ZERO_RETENTION record what the operator asserts. Setting
 * them creates neither; they exist so that enabling external processing is a
 * deliberate, attributable act.
 */

/** Environment variables this feature reads. Nothing else. */
export const MEDA_PROVIDER_ENV = Object.freeze({
  /** Which adapter. "fake" is test-only and never contacts anything. */
  PROVIDER: "MEDA_PROVIDER",
  /** Dedicated credential. Deliberately NOT OPENAI_API_KEY. */
  API_KEY: "MEDA_API_KEY",
  /** Explicit endpoint. No SDK default is accepted. */
  BASE_URL: "MEDA_BASE_URL",
  /** Chat model identifier. Never surfaced to a user (see the naming rule). */
  MODEL: "MEDA_MODEL",
  /** Operator assertion about where processing happens. */
  DATA_REGION: "MEDA_DATA_REGION",
  /** Operator assertion about retention. Must be exactly "true". */
  ZERO_RETENTION: "MEDA_ZERO_RETENTION",
  /** Test-only behaviour selector for the fake adapter. */
  FAKE_BEHAVIOUR: "MEDA_FAKE_BEHAVIOUR",
});

export const MEDA_PROVIDER_KINDS = Object.freeze({
  OPENAI_COMPATIBLE: "openai",
  /** In-process double. Never performs I/O; for tests only. */
  FAKE: "fake",
});

/** A short question and a short answer. */
export const MEDA_PROVIDER_TIMEOUT_MS = 20_000;

/**
 * Hosts a production deployment may send Meda questions to.
 *
 * Empty on purpose, exactly as for the other hardened paths: no endpoint has
 * been through the processing agreement and the patient-facing disclosure for
 * this data. Adding an entry is a deliberate edit with its own review — it is
 * not configuration.
 */
export const APPROVED_MEDA_PROVIDER_HOSTS = Object.freeze([]);

/**
 * @param {string | undefined} baseUrl
 * @param {boolean} isProduction
 */
export function checkMedaBaseUrl(baseUrl, isProduction) {
  let url;
  try {
    url = new URL(String(baseUrl));
  } catch {
    return { ok: false, reason: "base_url_invalid" };
  }
  const localhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !localhost) return { ok: false, reason: "base_url_not_https" };
  if (isProduction && !APPROVED_MEDA_PROVIDER_HOSTS.includes(url.hostname)) {
    return { ok: false, reason: "base_url_not_approved" };
  }
  return { ok: true, host: url.hostname };
}

const read = (env, name) => String(env?.[name] ?? "").trim();

/**
 * Resolves the configuration, or explains exactly what is missing.
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveMedaProviderConfig(env = process.env) {
  const kind = read(env, MEDA_PROVIDER_ENV.PROVIDER).toLowerCase();
  const isProduction = env?.NODE_ENV === "production";

  if (!kind) return { configured: false, missing: [MEDA_PROVIDER_ENV.PROVIDER] };

  if (kind === MEDA_PROVIDER_KINDS.FAKE) {
    // Never in production: the double answers instantly and plausibly, and a
    // deployment serving its output would present invented text as an answer
    // to a patient's question about their own health.
    if (isProduction) {
      return {
        configured: false,
        missing: [],
        reason: "fake_provider_not_allowed_in_production",
      };
    }
    return {
      configured: true,
      kind,
      fakeBehaviour: read(env, MEDA_PROVIDER_ENV.FAKE_BEHAVIOUR) || undefined,
      missing: [],
    };
  }

  if (kind !== MEDA_PROVIDER_KINDS.OPENAI_COMPATIBLE) {
    return { configured: false, missing: [], reason: "provider_unknown" };
  }

  const missing = [];
  const apiKey = read(env, MEDA_PROVIDER_ENV.API_KEY);
  const baseUrl = read(env, MEDA_PROVIDER_ENV.BASE_URL);
  const model = read(env, MEDA_PROVIDER_ENV.MODEL);
  const dataRegion = read(env, MEDA_PROVIDER_ENV.DATA_REGION);
  const zeroRetention = read(env, MEDA_PROVIDER_ENV.ZERO_RETENTION);

  if (!apiKey) missing.push(MEDA_PROVIDER_ENV.API_KEY);
  if (!baseUrl) missing.push(MEDA_PROVIDER_ENV.BASE_URL);
  if (!model) missing.push(MEDA_PROVIDER_ENV.MODEL);
  if (isProduction && !dataRegion) missing.push(MEDA_PROVIDER_ENV.DATA_REGION);
  if (isProduction && zeroRetention !== "true") missing.push(MEDA_PROVIDER_ENV.ZERO_RETENTION);
  if (missing.length > 0) return { configured: false, missing };

  // A deployment that pasted the shared key in here has not made the decision
  // this file exists to record. Refusing it is the whole point.
  if (apiKey === read(env, "OPENAI_API_KEY")) {
    return { configured: false, missing: [MEDA_PROVIDER_ENV.API_KEY], reason: "shared_key_refused" };
  }

  const urlCheck = checkMedaBaseUrl(baseUrl, isProduction);
  if (!urlCheck.ok) {
    return { configured: false, missing: [MEDA_PROVIDER_ENV.BASE_URL], reason: urlCheck.reason };
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
