/**
 * BMI for display only — not a diagnosis or treatment indicator.
 * @returns {number|null} rounded to one decimal
 */
export function computeBmi(heightCm, weightKg) {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!Number.isFinite(h) || !Number.isFinite(w) || h < 50 || h > 250 || w < 20 || w > 500) {
    return null;
  }
  const meters = h / 100;
  const bmi = w / (meters * meters);
  if (!Number.isFinite(bmi) || bmi < 10 || bmi > 80) return null;
  return Math.round(bmi * 10) / 10;
}
