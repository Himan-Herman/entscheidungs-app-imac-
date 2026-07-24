/**
 * Shared vital-measurement constants + validation.
 * Single source of truth for both manual entry (patientVitals) and wearable import
 * (wearables service), so plausibility bounds can never drift between the two paths.
 * Documentation only — no diagnosis, triage, or interpretation.
 */

export const VALID_TYPES = ["blood_pressure", "heart_rate", "glucose", "weight", "oxygen", "temperature"];

export const DEFAULT_UNITS = Object.freeze({
  blood_pressure: "mmHg",
  heart_rate: "bpm",
  glucose: "mg/dL",
  weight: "kg",
  oxygen: "%",
  temperature: "°C",
});

/** Plausibility bounds — reject physically impossible values, NOT a medical judgement. */
export const MAX_VALUES = Object.freeze({
  blood_pressure: { primary: [40, 300], secondary: [20, 200] },
  heart_rate: { primary: [20, 300] },
  glucose: { primary: [20, 1000] },
  weight: { primary: [10, 700] },
  oxygen: { primary: [50, 100] },
  temperature: { primary: [25, 45] },
});

/**
 * Validate a single vital measurement. Returns an error string, or null when valid.
 * @param {{type?:string, valuePrimary?:unknown, valueSecondary?:unknown, unit?:unknown, measuredAt?:unknown}} body
 */
export function validateVital(body) {
  const { type, valuePrimary, valueSecondary, unit, measuredAt } = body || {};
  if (!VALID_TYPES.includes(type)) return "invalid_type";
  const p = Number(valuePrimary);
  if (!Number.isFinite(p)) return "invalid_value";
  const limits = MAX_VALUES[type];
  if (limits?.primary && (p < limits.primary[0] || p > limits.primary[1])) return "value_out_of_range";
  if (type === "blood_pressure") {
    const s = Number(valueSecondary);
    if (!Number.isFinite(s)) return "missing_diastolic";
    if (s < limits.secondary[0] || s > limits.secondary[1]) return "value_out_of_range";
  }
  if (!measuredAt || isNaN(Date.parse(measuredAt))) return "invalid_date";
  const d = new Date(measuredAt);
  if (d > new Date()) return "date_in_future";
  if (unit && String(unit).length > 20) return "invalid_unit";
  return null;
}
