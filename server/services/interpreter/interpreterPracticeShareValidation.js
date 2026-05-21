import { validateInterpreterCloudSessionBody } from "./interpreterCloudSessionValidation.js";

/**
 * Validates patient session payload for practice sharing (explicit consent required).
 * @param {unknown} body
 */
export function validatePracticeShareSessionBody(body) {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      code: "validation_invalid_body",
      message: "Invalid body.",
      statusCode: 400,
    };
  }

  if (body.practiceShareConsent !== true) {
    return {
      ok: false,
      code: "practice_share_consent_required",
      message: "Explicit practice sharing consent is required.",
      statusCode: 403,
    };
  }

  const withCloudFlag = { ...body, cloudStorageConsent: true };
  const result = validateInterpreterCloudSessionBody(withCloudFlag);
  if (!result.ok) {
    return {
      ...result,
      statusCode: result.statusCode || 400,
    };
  }
  return result;
}
