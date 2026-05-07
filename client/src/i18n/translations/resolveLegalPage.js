import { getMessages } from "./index.js";

/**
 * Legal copy fallback: selected locale → English → German.
 */
export function resolveLegalPage(pageKey, lang) {
  const primary = getMessages(lang).legal?.[pageKey];
  const en = getMessages("en").legal?.[pageKey];
  const de = getMessages("de").legal?.[pageKey];
  return mergeLegalDeep(primary, en, de);
}

function mergeLegalDeep(p, e, d) {
  if (p === undefined || p === null) {
    if (e !== undefined && e !== null) return e;
    return d;
  }
  if (typeof p === "string") {
    if (p.length > 0) return p;
    if (typeof e === "string" && e.length > 0) return e;
    return typeof d === "string" ? d : "";
  }
  if (Array.isArray(p)) {
    const el = Array.isArray(e) ? e : [];
    const dl = Array.isArray(d) ? d : [];
    const len = Math.max(p.length, el.length, dl.length);
    const out = [];
    for (let i = 0; i < len; i++) {
      const pv = p[i];
      const ev = el[i];
      const dv = dl[i];
      if (pv === undefined && ev === undefined && dv === undefined) continue;
      out.push(mergeLegalDeep(pv ?? ev ?? dv, ev, dv));
    }
    return out;
  }
  if (typeof p === "object") {
    const keys = new Set([
      ...Object.keys(p),
      ...Object.keys(e || {}),
      ...Object.keys(d || {}),
    ]);
    const out = {};
    for (const k of keys) {
      out[k] = mergeLegalDeep(p[k], e?.[k], d?.[k]);
    }
    return out;
  }
  return p ?? e ?? d;
}
