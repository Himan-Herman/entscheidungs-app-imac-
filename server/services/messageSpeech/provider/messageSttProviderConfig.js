/**
 * Provider configuration gate for DICTATION.
 *
 * ── Why a third gate ────────────────────────────────────────────────────────
 * Document translation refuses to inherit OPENAI_API_KEY. Message translation
 * refuses to inherit the document key. This refuses to inherit either, and the
 * reason is a step further again: those two transmit text that someone chose to
 * write. This transmits a recording of someone speaking.
 *
 * A recording is not the sentence it contains. It carries a voice, and whatever
 * else was audible — a second person in the room, a child, a name said aloud
 * and then corrected. None of it can be masked the way a written dose is
 * masked, because recognising it is the very thing being outsourced. So the
 * decision to send audio somewhere is its own decision, and it is made here.
 *
 * There is also an existing /api/transcribe in this codebase running on the
 * shared OPENAI_API_KEY with no flag at all. It is deliberately not reused:
 * inheriting it would make an unrelated feature's key into permission to
 * transmit patient-practice dictation.
 *
 * ── Fail closed ─────────────────────────────────────────────────────────────
 * An incomplete configuration means unconfigured, and the service refuses
 * before a microphone byte is read. No audio leaves the server in that state.
 *
 * ── What the assertions mean ────────────────────────────────────────────────
 * DATA_REGION and ZERO_RETENTION record what the operator asserts. Setting them
 * neither creates data residency nor deletes anything at the provider, and
 * nothing here can verify either. They exist so enabling external audio
 * processing is a deliberate, attributable act.
 */

/** Environment variables this feature reads. Nothing else. */
export const STT_PROVIDER_ENV = Object.freeze({
  /** Which adapter. "fake" is test-only and never contacts anything. */
  PROVIDER: "MESSAGE_STT_PROVIDER",
  /** Dedicated credential — not OPENAI_API_KEY, not the translation keys. */
  API_KEY: "MESSAGE_STT_API_KEY",
  /** Explicit endpoint. No SDK default is accepted. */
  BASE_URL: "MESSAGE_STT_BASE_URL",
  /** Recognition model identifier. Never surfaced to a user. */
  MODEL: "MESSAGE_STT_MODEL",
  /** Operator assertion about where processing happens. */
  DATA_REGION: "MESSAGE_STT_DATA_REGION",
  /** Operator assertion about retention. Must be exactly "true". */
  ZERO_RETENTION: "MESSAGE_STT_ZERO_RETENTION",
  /** Test-only behaviour selector for the fake adapter. */
  FAKE_BEHAVIOUR: "MESSAGE_STT_FAKE_BEHAVIOUR",
});

export const STT_PROVIDER_KINDS = Object.freeze({
  OPENAI_COMPATIBLE: "openai",
  FAKE: "fake",
});

/** Ninety seconds of audio, plus transfer. Generous, still bounded. */
export const STT_PROVIDER_TIMEOUT_MS = 45_000;

/**
 * Hosts a production deployment may send a recording to.
 *
 * Empty on purpose, and for a stricter reason than the text gates: until a
 * specific endpoint has been through the processing agreement AND the patient
 * has been told that dictation transmits a recording, production has nowhere to
 * send one. Adding an entry is a deliberate edit with its own review.
 */
export const APPROVED_STT_PROVIDER_HOSTS = Object.freeze([]);

/**
 * @param {string | undefined} baseUrl
 * @param {boolean} isProduction
 */
export function checkSttBaseUrl(baseUrl, isProduction) {
  let url;
  try {
    url = new URL(String(baseUrl));
  } catch {
    return { ok: false, reason: "base_url_invalid" };
  }
  const localhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !localhost) return { ok: false, reason: "base_url_not_https" };
  if (isProduction && !APPROVED_STT_PROVIDER_HOSTS.includes(url.hostname)) {
    return { ok: false, reason: "base_url_not_approved" };
  }
  return { ok: true, host: url.hostname };
}

/**
 * Resolves the configuration, or explains exactly what is missing.
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveSttProviderConfig(env = process.env) {
  const kind = String(env?.[STT_PROVIDER_ENV.PROVIDER] ?? "").trim().toLowerCase();
  const isProduction = env?.NODE_ENV === "production";

  if (!kind) return { configured: false, missing: [STT_PROVIDER_ENV.PROVIDER] };

  if (kind === STT_PROVIDER_KINDS.FAKE) {
    // Never in production. A double returns a plausible transcript instantly,
    // and a deployment serving one would put invented words in a patient's
    // mouth, in a field they are about to press send on.
    if (isProduction) {
      return { configured: false, missing: [], reason: "fake_provider_in_production" };
    }
    return {
      configured: true,
      kind,
      fakeBehaviour: env?.[STT_PROVIDER_ENV.FAKE_BEHAVIOUR] || undefined,
      missing: [],
    };
  }

  if (kind !== STT_PROVIDER_KINDS.OPENAI_COMPATIBLE) {
    return { configured: false, missing: [], reason: "provider_unknown" };
  }

  const missing = [];
  const apiKey = String(env?.[STT_PROVIDER_ENV.API_KEY] ?? "").trim();
  const baseUrl = String(env?.[STT_PROVIDER_ENV.BASE_URL] ?? "").trim();
  const model = String(env?.[STT_PROVIDER_ENV.MODEL] ?? "").trim();
  const dataRegion = String(env?.[STT_PROVIDER_ENV.DATA_REGION] ?? "").trim();
  const zeroRetention = String(env?.[STT_PROVIDER_ENV.ZERO_RETENTION] ?? "").trim();

  if (!apiKey) missing.push(STT_PROVIDER_ENV.API_KEY);
  if (!baseUrl) missing.push(STT_PROVIDER_ENV.BASE_URL);
  if (!model) missing.push(STT_PROVIDER_ENV.MODEL);
  if (isProduction && !dataRegion) missing.push(STT_PROVIDER_ENV.DATA_REGION);
  if (isProduction && zeroRetention !== "true") missing.push(STT_PROVIDER_ENV.ZERO_RETENTION);
  if (missing.length > 0) return { configured: false, missing };

  const urlCheck = checkSttBaseUrl(baseUrl, isProduction);
  if (!urlCheck.ok) {
    return { configured: false, missing: [STT_PROVIDER_ENV.BASE_URL], reason: urlCheck.reason };
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

/** The configuration WITHOUT its secret, for logs and health output. */
export function describeSttProviderConfig(config) {
  return {
    configured: Boolean(config?.configured),
    kind: config?.kind ?? null,
    model: config?.model ?? null,
    dataRegion: config?.dataRegion ?? null,
    zeroRetention: config?.zeroRetention ?? null,
    missing: config?.missing ?? [],
    reason: config?.reason ?? null,
  };
}
