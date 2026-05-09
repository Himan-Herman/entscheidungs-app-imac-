/**
 * Deep-merge message trees: primary wins, then secondary, then tertiary.
 * Arrays and primitives are taken wholesale from the first defined branch.
 */
export function mergeFallbackMessages(primary, secondary, tertiary) {
  if (primary !== undefined && primary !== null) {
    if (typeof primary !== "object") return primary;
    if (Array.isArray(primary)) return primary;
    return mergeObjectFallback(primary, secondary, tertiary);
  }
  if (secondary !== undefined && secondary !== null) {
    if (typeof secondary !== "object") return secondary;
    if (Array.isArray(secondary)) return secondary;
    return mergeObjectFallback(undefined, secondary, tertiary);
  }
  if (tertiary !== undefined && tertiary !== null) {
    if (typeof tertiary !== "object") return tertiary;
    if (Array.isArray(tertiary)) return tertiary;
    return mergeObjectFallback(undefined, undefined, tertiary);
  }
  return undefined;
}

function mergeObjectFallback(primaryObj, secondary, tertiary) {
  const p =
    primaryObj && typeof primaryObj === "object" && !Array.isArray(primaryObj)
      ? primaryObj
      : {};
  const sObj =
    secondary && typeof secondary === "object" && !Array.isArray(secondary)
      ? secondary
      : {};
  const tObj =
    tertiary && typeof tertiary === "object" && !Array.isArray(tertiary)
      ? tertiary
      : {};
  const keys = new Set([
    ...Object.keys(p),
    ...Object.keys(sObj),
    ...Object.keys(tObj),
  ]);
  const out = {};
  for (const k of keys) {
    out[k] = mergeFallbackMessages(p[k], sObj[k], tObj[k]);
  }
  return out;
}
