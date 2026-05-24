/** @typedef {"female" | "male" | "diverse" | "none" | ""} GenderFormOfAddressCode */

export const GENDER_FORM_OF_ADDRESS_CODES = /** @type {const} */ ([
  "female",
  "male",
  "diverse",
  "none",
]);

/**
 * @param {string | null | undefined} raw
 * @returns {GenderFormOfAddressCode}
 */
export function mapProfileGenderToCode(raw) {
  if (!raw || typeof raw !== "string") return "";
  const s = raw.trim().toLowerCase();
  if (!s) return "";

  if (["female", "weiblich", "f", "woman", "frau"].includes(s)) return "female";
  if (["male", "männlich", "mannlich", "m", "man", "mann"].includes(s)) return "male";
  if (["diverse", "divers", "other", "non-binary", "nonbinary"].includes(s)) return "diverse";
  if (
    ["none", "keine_angabe", "keine angabe", "prefer not to say", "prefer not to say", "n/a"].includes(s)
  ) {
    return "none";
  }

  return "";
}

/**
 * @param {GenderFormOfAddressCode} code
 * @param {{ setup?: Record<string, string> }} t
 * @returns {string | null} Localized label for PDF/display, or null if omitted.
 */
export function resolveGenderFormOfAddressLabel(code, t) {
  if (!code || code === "none") return null;
  const setup = t?.setup || {};
  if (code === "female") return setup.genderFemale || "Female";
  if (code === "male") return setup.genderMale || "Male";
  if (code === "diverse") return setup.genderDiverse || "Diverse";
  return null;
}

/**
 * @param {GenderFormOfAddressCode} code
 * @returns {boolean}
 */
export function shouldIncludeGenderInPdf(code) {
  return Boolean(code && code !== "none");
}
