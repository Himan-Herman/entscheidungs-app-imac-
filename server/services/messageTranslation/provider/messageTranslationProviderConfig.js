/**
 * Provider configuration gate for MESSAGE translation.
 *
 * ── Why this is a second gate and not the document one ──────────────────────
 * The document translation module refuses to inherit OPENAI_API_KEY, on the
 * grounds that a key configured for the symptom checker says nothing about
 * whether the full text of a medical letter may be sent to that same project.
 *
 * The same argument applies one step further, and it is the reason this file
 * exists. A processing agreement covering practice documents says nothing about
 * live correspondence between a patient and their practice: different data,
 * different retention question, different disclosure to the patient. Reusing
 * DOCUMENT_TRANSLATION_API_KEY here would turn "documents were approved" into
 * implicit permission to transmit conversations, which is exactly the kind of
 * inference the document gate was built to prevent.
 *
 * So message translation requires its OWN, explicitly named configuration.
 * Nothing is inherited, nothing is defaulted, and neither OPENAI_API_KEY nor
 * DOCUMENT_TRANSLATION_API_KEY is a substitute for any of it.
 *
 * ── Fail closed ─────────────────────────────────────────────────────────────
 * If the configuration is incomplete, resolveMessageProviderConfig reports it
 * as unconfigured and the service refuses. No message text leaves the server in
 * that state — not truncated, not masked, not "just for a test".
 *
 * ── What the assertions mean, and what they do not ──────────────────────────
 * DATA_REGION and ZERO_RETENTION record what the operator asserts. Setting them
 * does not create data residency or zero retention, and nothing here can verify
 * either. They exist so that enabling external processing is a deliberate,
 * attributable act rather than a side effect of a key appearing in the
 * environment.
 */

/** Environment variables this feature reads. Nothing else. */
export const MESSAGE_PROVIDER_ENV = Object.freeze({
  /** Which adapter to use. "fake" is test-only and never contacts anything. */
  PROVIDER: "MESSAGE_TRANSLATION_PROVIDER",
  /** Dedicated credential. Deliberately NOT OPENAI_API_KEY and NOT the document key. */
  API_KEY: "MESSAGE_TRANSLATION_API_KEY",
  /** Explicit endpoint. No SDK default is accepted. */
  BASE_URL: "MESSAGE_TRANSLATION_BASE_URL",
  /** Model identifier. Never surfaced to a user (see the naming rule). */
  MODEL: "MESSAGE_TRANSLATION_MODEL",
  /** Operator assertion about where processing happens. */
  DATA_REGION: "MESSAGE_TRANSLATION_DATA_REGION",
  /** Operator assertion about retention. Must be exactly "true". */
  ZERO_RETENTION: "MESSAGE_TRANSLATION_ZERO_RETENTION",
  /** Test-only behaviour selector for the fake adapter. */
  FAKE_BEHAVIOUR: "MESSAGE_TRANSLATION_FAKE_BEHAVIOUR",
});

export const MESSAGE_PROVIDER_KINDS = Object.freeze({
  OPENAI_COMPATIBLE: "openai",
  FAKE: "fake",
});

/** A single short message; far below the document timeout for a whole file. */
export const MESSAGE_PROVIDER_TIMEOUT_MS = 20_000;

/**
 * Hosts a production deployment may send message text to.
 *
 * Empty on purpose. Until a specific endpoint has been through the processing
 * agreement and the patient-facing disclosure, production has nowhere to send a
 * conversation to, and the gate says so by having no answer. Adding an entry is
 * a deliberate edit with its own review — it is not configuration.
 */
export const APPROVED_MESSAGE_PROVIDER_HOSTS = Object.freeze([]);

/**
 * @typedef {object} MessageProviderConfig
 * @property {boolean} configured
 * @property {string} [kind]
 * @property {string} [apiKey]
 * @property {string} [baseUrl]
 * @property {string} [model]
 * @property {string} [dataRegion]
 * @property {boolean} [zeroRetention]
 * @property {string} [fakeBehaviour]
 * @property {string[]} missing
 * @property {string} [reason]
 */

/**
 * @param {string | undefined} baseUrl
 * @param {boolean} isProduction
 * @returns {{ ok: true, host: string } | { ok: false, reason: string }}
 */
export function checkMessageBaseUrl(baseUrl, isProduction) {
  let url;
  try {
    url = new URL(String(baseUrl));
  } catch {
    return { ok: false, reason: "base_url_invalid" };
  }
  // Plain HTTP would put the conversation on the wire in clear text. Localhost
  // is exempt so a developer can point at a stub without a certificate.
  const localhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !localhost) return { ok: false, reason: "base_url_not_https" };
  if (isProduction && !APPROVED_MESSAGE_PROVIDER_HOSTS.includes(url.hostname)) {
    return { ok: false, reason: "base_url_not_approved" };
  }
  return { ok: true, host: url.hostname };
}

/**
 * Resolves the configuration, or explains exactly what is missing.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {MessageProviderConfig}
 */
export function resolveMessageProviderConfig(env = process.env) {
  const kind = String(env?.[MESSAGE_PROVIDER_ENV.PROVIDER] ?? "").trim().toLowerCase();
  const isProduction = env?.NODE_ENV === "production";

  if (!kind) {
    return { configured: false, missing: [MESSAGE_PROVIDER_ENV.PROVIDER] };
  }

  if (kind === MESSAGE_PROVIDER_KINDS.FAKE) {
    // Never in production, whatever else is set: the double answers instantly
    // and convincingly, and a deployment serving its output would be presenting
    // invented text as a translation of someone's medical message.
    if (isProduction) {
      return { configured: false, missing: [], reason: "fake_provider_in_production" };
    }
    return {
      configured: true,
      kind,
      fakeBehaviour: env?.[MESSAGE_PROVIDER_ENV.FAKE_BEHAVIOUR] || undefined,
      missing: [],
    };
  }

  if (kind !== MESSAGE_PROVIDER_KINDS.OPENAI_COMPATIBLE) {
    return { configured: false, missing: [], reason: "provider_unknown" };
  }

  const missing = [];
  const apiKey = String(env?.[MESSAGE_PROVIDER_ENV.API_KEY] ?? "").trim();
  const baseUrl = String(env?.[MESSAGE_PROVIDER_ENV.BASE_URL] ?? "").trim();
  const model = String(env?.[MESSAGE_PROVIDER_ENV.MODEL] ?? "").trim();
  const dataRegion = String(env?.[MESSAGE_PROVIDER_ENV.DATA_REGION] ?? "").trim();
  const zeroRetention = String(env?.[MESSAGE_PROVIDER_ENV.ZERO_RETENTION] ?? "").trim();

  if (!apiKey) missing.push(MESSAGE_PROVIDER_ENV.API_KEY);
  if (!baseUrl) missing.push(MESSAGE_PROVIDER_ENV.BASE_URL);
  if (!model) missing.push(MESSAGE_PROVIDER_ENV.MODEL);
  // Both assertions are required in production. An operator who cannot state
  // them has not decided to send conversations anywhere.
  if (isProduction && !dataRegion) missing.push(MESSAGE_PROVIDER_ENV.DATA_REGION);
  if (isProduction && zeroRetention !== "true") missing.push(MESSAGE_PROVIDER_ENV.ZERO_RETENTION);
  if (missing.length > 0) return { configured: false, missing };

  const urlCheck = checkMessageBaseUrl(baseUrl, isProduction);
  if (!urlCheck.ok) {
    return { configured: false, missing: [MESSAGE_PROVIDER_ENV.BASE_URL], reason: urlCheck.reason };
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

/**
 * The configuration WITHOUT its secret, for logs and health output.
 *
 * @param {MessageProviderConfig} config
 */
export function describeMessageProviderConfig(config) {
  return {
    configured: Boolean(config?.configured),
    kind: config?.kind ?? null,
    // The model identifier is operational, not user-facing. It appears here and
    // in the audit trail, never in an interface.
    model: config?.model ?? null,
    dataRegion: config?.dataRegion ?? null,
    zeroRetention: config?.zeroRetention ?? null,
    missing: config?.missing ?? [],
    reason: config?.reason ?? null,
  };
}
