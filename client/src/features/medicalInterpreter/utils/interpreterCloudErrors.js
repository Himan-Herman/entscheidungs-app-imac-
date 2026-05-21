/**
 * Map cloud API error codes to medicalInterpreter.cloud.errors keys.
 * @param {string} [code]
 * @param {object} t — medicalInterpreter messages
 */
export function cloudErrorMessage(code, t) {
  const e = t?.cloud?.errors ?? {};
  switch (code) {
    case "unauthorized":
      return e.unauthorized || t?.errors?.unauthorized;
    case "rate_limited":
      return e.rateLimited || t?.errors?.rateLimited;
    case "network":
      return e.network || t?.errors?.network;
    case "interpreter_cloud_disabled":
      return e.cloudDisabled;
    case "interpreter_cloud_encryption_not_configured":
      return e.encryptionUnavailable;
    case "interpreter_cloud_consent_required":
      return e.consentRequired;
    case "interpreter_cloud_quota_exceeded":
      return e.quotaExceeded;
    case "interpreter_session_not_found":
      return e.sessionNotFound;
    case "validation_unsafe_content":
    case "validation_empty_turn":
    case "validation_too_many_turns":
    case "validation_session_too_large":
    case "validation_payload_too_large":
    case "validation_too_many_fields":
    case "validation_duplicate_turn_id":
      return e.validationRejected;
    default:
      return e.generic;
  }
}
