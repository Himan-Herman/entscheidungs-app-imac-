/**
 * Activation readiness — one place that answers "could this run, and should it?"
 *
 * Two consumers: the startup log, so an operator sees the state of a deployment
 * without opening a shell, and /api/health/config, so they can see it without
 * reading logs. Both get booleans and variable names only.
 *
 * ── What this module does not claim ─────────────────────────────────────────
 * `ready: true` means the process is technically able to call a provider. It
 * says nothing about whether it is permitted to: the processing agreement, the
 * data-residency arrangement, the retention configuration and the patient-facing
 * disclosure are all external, and no code here can verify any of them. The
 * checklist under docs/production is what tracks those.
 *
 * Nothing here reads a document, and nothing here logs one.
 */

import { isDocumentTranslationEnabled } from "../../config/featureFlags.js";
import {
  APPROVED_PROVIDER_HOSTS,
  PROVIDER_ENV,
  resolveProviderConfig,
} from "./provider/documentTranslationProviderConfig.js";

/**
 * @typedef {object} TranslationReadiness
 * @property {boolean} featureEnabled     ENABLE_DOCUMENT_TRANSLATION
 * @property {boolean} providerConfigured provider config resolves completely
 * @property {boolean} endpointApproved   production host allowlist satisfied
 * @property {boolean} ready              feature on AND provider usable
 * @property {string[]} missing           env var names that are absent/rejected
 * @property {string} [reason]            why the configuration was refused
 */

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {TranslationReadiness}
 */
export function describeTranslationReadiness(env = process.env) {
  const featureEnabled = isDocumentTranslationEnabled();
  const config = resolveProviderConfig(env);
  const isProduction = env?.NODE_ENV === "production";

  return {
    featureEnabled,
    providerConfigured: config.configured,
    // In production an endpoint is only usable once its host has been approved
    // in code. Outside production the allowlist does not apply, so the flag
    // reports the same thing the configuration already decided.
    endpointApproved: isProduction
      ? config.configured && APPROVED_PROVIDER_HOSTS.length > 0
      : config.configured,
    ready: featureEnabled && config.configured,
    missing: config.missing ?? [],
    ...(config.reason ? { reason: config.reason } : {}),
  };
}

/**
 * Log the state once at startup.
 *
 * A partially configured deployment must not fail silently — an operator who
 * set ENABLE_DOCUMENT_TRANSLATION=true and expected the feature to work should
 * learn why it is refusing from the boot log rather than from a patient.
 *
 * It also must not take MedScoutX down. The feature is optional and its own
 * gate is fail-closed, so an incomplete configuration is a warning, not a fatal
 * error: refusing to boot the whole API over one switched-off feature would
 * trade a working product for a tidier invariant.
 *
 * @param {(msg: string) => void} [warn]
 * @param {(msg: string) => void} [info]
 */
export function logDocumentTranslationReadiness(warn = console.warn, info = console.log) {
  const state = describeTranslationReadiness();

  if (!state.featureEnabled) {
    info(
      `[startup] document translation: disabled (${PROVIDER_ENV.PROVIDER} ` +
        `${state.providerConfigured ? "configured" : "not configured"})`,
    );
    return;
  }

  if (state.ready) {
    // Deliberately not logged: the host, the region, the models, the key. An
    // operator confirms those in the deployment configuration, not in a log.
    info("[startup] document translation: enabled and provider configured");
    return;
  }

  warn(
    "[startup] document translation is ENABLED but the provider is not usable — " +
      "the feature will refuse every request (fail closed). " +
      `Missing or rejected: ${state.missing.join(", ") || "none"}` +
      (state.reason ? ` (${state.reason})` : ""),
  );
  if (state.reason === "base_url_host_not_approved") {
    warn(
      "[startup] the configured endpoint host is not in APPROVED_PROVIDER_HOSTS. " +
        "See docs/production/DOCUMENT_TRANSLATION_ACTIVATION_CHECKLIST.md.",
    );
  }
}
