/**
 * Provider configuration gate — the release tor for external processing.
 *
 * ── Why this exists as its own module ───────────────────────────────────────
 * Every other AI feature in this codebase reaches for the shared client:
 *
 *     new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
 *
 * That is exactly what document translation must NOT do. A generic key being
 * present for the symptom checker says nothing about whether the full text of a
 * medical letter may be sent to that same project — different data category,
 * different processing agreement, different retention question. Inheriting the
 * key would turn "someone configured an unrelated feature" into implicit
 * permission to transmit medical documents.
 *
 * So this feature requires its OWN, explicitly named configuration. Nothing is
 * inferred, nothing is defaulted, and the presence of OPENAI_API_KEY is not a
 * substitute for any of it.
 *
 * ── Fail closed ─────────────────────────────────────────────────────────────
 * If the configuration below is incomplete, resolveProviderConfig() reports it
 * as unconfigured and the service refuses with
 * document_translation_provider_not_configured. No document content leaves the
 * server in that state — not truncated, not masked, not "just a test segment".
 *
 * ── What the flags mean, and what they do not ───────────────────────────────
 * DOCUMENT_TRANSLATION_DATA_REGION and DOCUMENT_TRANSLATION_ZERO_RETENTION are
 * ASSERTIONS BY THE OPERATOR, recorded so the running configuration is
 * inspectable and auditable. Setting them does not create data residency or
 * zero retention, and this module cannot verify either. They exist so that
 * enabling external processing is a deliberate, attributable act rather than a
 * side effect of an API key appearing in the environment.
 */

/** Environment variables this feature reads. Nothing else. */
export const PROVIDER_ENV = Object.freeze({
  /** Which adapter to use. "fake" is test-only and never contacts anything. */
  PROVIDER: "DOCUMENT_TRANSLATION_PROVIDER",
  /** Dedicated credential. Deliberately NOT OPENAI_API_KEY. */
  API_KEY: "DOCUMENT_TRANSLATION_API_KEY",
  /** Explicit endpoint. No SDK default is accepted. */
  BASE_URL: "DOCUMENT_TRANSLATION_BASE_URL",
  /** Operator's assertion about where processing happens, e.g. "eu". */
  DATA_REGION: "DOCUMENT_TRANSLATION_DATA_REGION",
  /** Operator's assertion that retention is disabled. Must be exactly "true". */
  ZERO_RETENTION: "DOCUMENT_TRANSLATION_ZERO_RETENTION",
  /** Model slot for faithful translation. */
  MODEL_STRICT: "DOCUMENT_TRANSLATION_MODEL_STRICT",
  /** Model slot for plain-language rendering. */
  MODEL_PLAIN: "DOCUMENT_TRANSLATION_MODEL_PLAIN",
  /**
   * Which failure the fake adapter should simulate. Read only when the fake is
   * selected, which cannot happen in production — see resolveProviderConfig.
   */
  FAKE_BEHAVIOUR: "DOCUMENT_TRANSLATION_FAKE_BEHAVIOUR",
});

/** Adapters this build knows about. */
export const PROVIDER_KINDS = Object.freeze({
  OPENAI: "openai",
  /** In-process double. Never performs I/O; for tests only. */
  FAKE: "fake",
});

/** Request deadline for a single provider call. */
export const PROVIDER_TIMEOUT_MS = 60_000;

/**
 * @typedef {object} ProviderConfig
 * @property {boolean} configured
 * @property {string[]} missing         env var names that are absent or empty
 * @property {string} [kind]
 * @property {string} [apiKey]
 * @property {string} [baseUrl]
 * @property {string} [dataRegion]
 * @property {boolean} [zeroRetention]
 * @property {{ strict: string, plain: string }} [models]
 */

/**
 * Resolve the translation provider configuration from the environment.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {ProviderConfig}
 */
export function resolveProviderConfig(env = process.env) {
  const kind = read(env, PROVIDER_ENV.PROVIDER);

  if (!kind) {
    return { configured: false, missing: [PROVIDER_ENV.PROVIDER] };
  }

  // The fake adapter exists so the whole chain can be tested without a network
  // and without credentials. It is a normal, fully configured provider from the
  // service's point of view — it simply never leaves the process.
  if (kind === PROVIDER_KINDS.FAKE) {
    // In production it must be unreachable. A deployment that set it by mistake
    // would hand patients echo-prefixed text that looks like a translation of
    // their own medical letter, which is worse than the feature being off.
    if (read(env, "NODE_ENV") === "production") {
      return {
        configured: false,
        missing: [PROVIDER_ENV.PROVIDER],
        reason: "fake_provider_not_allowed_in_production",
      };
    }
    return {
      configured: true,
      missing: [],
      kind: PROVIDER_KINDS.FAKE,
      models: { strict: "fake-strict", plain: "fake-plain" },
      dataRegion: "in-process",
      zeroRetention: true,
      // Only meaningful for the double; lets a test drive a specific failure
      // through the real route and service rather than around them.
      fakeBehaviour: read(env, PROVIDER_ENV.FAKE_BEHAVIOUR) || undefined,
    };
  }

  if (kind !== PROVIDER_KINDS.OPENAI) {
    return { configured: false, missing: [PROVIDER_ENV.PROVIDER] };
  }

  const apiKey = read(env, PROVIDER_ENV.API_KEY);
  const baseUrl = read(env, PROVIDER_ENV.BASE_URL);
  const dataRegion = read(env, PROVIDER_ENV.DATA_REGION);
  const zeroRetention = read(env, PROVIDER_ENV.ZERO_RETENTION);
  const modelStrict = read(env, PROVIDER_ENV.MODEL_STRICT);
  const modelPlain = read(env, PROVIDER_ENV.MODEL_PLAIN);

  const missing = [];
  if (!apiKey) missing.push(PROVIDER_ENV.API_KEY);
  if (!baseUrl) missing.push(PROVIDER_ENV.BASE_URL);
  if (!dataRegion) missing.push(PROVIDER_ENV.DATA_REGION);
  // Anything other than an explicit "true" counts as not asserted. An absent
  // or ambiguous value must never read as "retention is off".
  if (zeroRetention !== "true") missing.push(PROVIDER_ENV.ZERO_RETENTION);
  if (!modelStrict) missing.push(PROVIDER_ENV.MODEL_STRICT);
  if (!modelPlain) missing.push(PROVIDER_ENV.MODEL_PLAIN);

  if (missing.length > 0) return { configured: false, missing };

  // Guard against the exact shortcut this module exists to prevent: pointing the
  // dedicated key at the generic one and calling it configured.
  if (apiKey === read(env, "OPENAI_API_KEY")) {
    return { configured: false, missing: [PROVIDER_ENV.API_KEY], reason: "reused_generic_key" };
  }

  return {
    configured: true,
    missing: [],
    kind: PROVIDER_KINDS.OPENAI,
    apiKey,
    baseUrl,
    dataRegion,
    zeroRetention: true,
    models: { strict: modelStrict, plain: modelPlain },
  };
}

/**
 * Configuration summary safe to record in an audit entry.
 * Never includes the key, and never the base URL host as a secret — but the
 * key is omitted entirely rather than truncated.
 *
 * @param {ProviderConfig} config
 */
export function describeProviderConfig(config) {
  if (!config?.configured) {
    return { configured: false, missing: config?.missing ?? [] };
  }
  return {
    configured: true,
    kind: config.kind,
    dataRegion: config.dataRegion,
    zeroRetention: config.zeroRetention,
  };
}

/** @param {NodeJS.ProcessEnv} env @param {string} name */
function read(env, name) {
  const value = env?.[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
