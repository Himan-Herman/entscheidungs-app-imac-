/**
 * Deterministic medication-supply calculation (device-local, no AI, no network).
 *
 * From the package total, the amount per intake and the number of intakes per
 * day, it estimates how much is left and when the package runs out — so the UI
 * can warn ~2 days before it's empty. Pure arithmetic: no guessing, no rounding
 * surprises beyond an explicit floor to whole remaining days.
 */

/** Parse a user-entered number (accepts comma decimals); returns 0 if not > 0. */
export function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : 0;
  const n = parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function startOfDay(input) {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {object} entry own-medication entry
 * @param {Date} [now]
 * @returns {null | {
 *   dailyConsumption: number, remaining: number, daysLeft: number,
 *   runOutDate: Date, total: number, unit: string
 * }}
 */
export function computeSupply(entry, now = new Date()) {
  const total = toNumber(entry?.packageTotal);
  const dose = toNumber(entry?.dosePerIntake);
  const times = toNumber(entry?.timesPerDay);
  if (!total || !dose || !times) return null;

  const dailyConsumption = dose * times;
  if (!dailyConsumption) return null;

  const anchorIso = entry?.startDate || entry?.createdAt;
  const anchor = anchorIso ? startOfDay(anchorIso) : startOfDay(now);
  const today = startOfDay(now);

  const daysElapsed = Math.max(
    0,
    Math.floor((today.getTime() - anchor.getTime()) / MS_PER_DAY),
  );
  const consumed = dailyConsumption * daysElapsed;
  const remaining = Math.max(0, total - consumed);
  const daysLeft = Math.floor(remaining / dailyConsumption);
  const runOutDate = new Date(today.getTime() + daysLeft * MS_PER_DAY);

  return {
    dailyConsumption,
    remaining,
    daysLeft,
    runOutDate,
    total,
    unit: String(entry?.unit || "").trim(),
  };
}

/** True when the package runs out within `threshold` days (default 2). */
export function isRunningLow(supply, threshold = 2) {
  return !!supply && supply.daysLeft <= threshold;
}
