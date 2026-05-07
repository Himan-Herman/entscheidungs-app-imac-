/**
 * Deep-merge plain objects; arrays from `over` replace arrays in `base`.
 */
export function deepMerge(base, over) {
  if (over === undefined || over === null) return base;
  if (base === undefined || base === null) return over;
  if (Array.isArray(base) || Array.isArray(over)) {
    return over !== undefined ? over : base;
  }
  if (typeof base !== "object" || typeof over !== "object") {
    return over;
  }
  const out = { ...base };
  for (const key of Object.keys(over)) {
    const bv = base[key];
    const ov = over[key];
    if (
      ov &&
      typeof ov === "object" &&
      !Array.isArray(ov) &&
      bv &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      out[key] = deepMerge(bv, ov);
    } else {
      out[key] = ov;
    }
  }
  return out;
}
