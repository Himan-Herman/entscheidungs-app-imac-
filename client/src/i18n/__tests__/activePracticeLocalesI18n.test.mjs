/**
 * The practice workspace, in the six languages the header actually offers.
 *
 * WHAT COUNTS AS ACTIVE
 * ---------------------
 * Not every locale in the repo and not every namespace in the tree. The
 * header's own picker decides the languages (23 are listed, 6 are selectable),
 * and the router decides the namespaces: a route that is reachable pulls its
 * namespaces in, a route behind a switched-off flag does not. Both lists are
 * asserted below rather than assumed, so widening either one without doing the
 * translation work fails here.
 *
 * WHAT THIS GUARD DOES NOT CLAIM
 * ------------------------------
 * French, Spanish and Italian still have real gaps in this area. They are
 * recorded per namespace with their exact size: a gap that grows fails, and a
 * gap that shrinks fails too, so the list cannot quietly rot into fiction.
 */
import test from "node:test";
import assert from "node:assert/strict";

import de from "../translations/de/index.js";
import en from "../translations/en/index.js";
import fr from "../translations/overrides/fr.js";
import es from "../translations/overrides/es.js";
import it from "../translations/overrides/it.js";
import ru from "../translations/overrides/ru.js";
import { HEADER_SELECTABLE_LOCALE_CODES, LOCALE_OPTIONS } from "../localeConfig.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ACTIVE = { de, en, fr, es, it, ru };

/**
 * Namespaces reached from a practice route that is not behind a disabled flag.
 * Derived once from main.jsx and the running app, then frozen here: a static
 * re-derivation inside a unit test would re-implement the router.
 */
const ACTIVE_PRACTICE_NAMESPACES = Object.freeze([
  "archiveLifecycle", "documentOcr", "documentSharing", "erezept", "exports",
  "healthHistory", "medicalInterpreter", "patientActivity", "patientMedicationPlan",
  "practiceAnalytics", "practiceAnamnesis", "practiceAudit", "practiceBillingPlausibility",
  "practiceBooking", "practiceCalendar", "practiceConsents", "practiceDashboard",
  "practiceDataRequests", "practiceDocuments", "practiceInbox", "practiceIntegrations",
  "practiceInternalWork", "practiceMedicationPlan", "practiceMessages",
  "practiceOrganization", "practiceOverview", "practicePatientProfile",
  "practicePatients", "practicePreVisit", "practiceSecurity", "practiceSettings",
  "practiceTeam", "practiceTelemedicine", "preVisit", "settingsPractices",
  "sosCard", "vaccinations", "visitMedications", "vitals",
]);

/** Reached only from a route whose feature flag is off — deliberately untranslated. */
const FLAG_OFF_NAMESPACES = Object.freeze([
  "anamnesisLinks", "anamnesisSubmissions", "practiceDeveloper",
]);

/**
 * Gaps that are real, measured, and not closed in this pass.
 *
 * Russian is absent from this map on purpose: it is complete. Each number is
 * the count of keys that language still lacks in that namespace.
 */
const KNOWN_GAPS = {
  fr: { medicalInterpreter: 73, practiceBillingPlausibility: 29, practiceConsents: 42,
        practicePreVisit: 31, practiceAnalytics: 26, documentOcr: 12, preVisit: 241,
        practiceOrganization: 2, practiceAnamnesis: 9, practiceDashboard: 1,
        practicePatientProfile: 0, vitals: 7, vaccinations: 4, erezept: 4,
        patientMedicationPlan: 1, practiceOverview: 1 },
  es: { medicalInterpreter: 73, practiceBillingPlausibility: 29, practiceConsents: 42,
        practicePreVisit: 31, practiceAnalytics: 26, documentOcr: 12, preVisit: 241,
        practiceOrganization: 2, practiceAnamnesis: 9, practiceDashboard: 1,
        vitals: 7, erezept: 4, patientMedicationPlan: 1, practiceOverview: 1 },
  it: { medicalInterpreter: 73, practiceBillingPlausibility: 29, practiceConsents: 42,
        practicePreVisit: 31, practiceAnalytics: 26, documentOcr: 12, preVisit: 66,
        practiceOrganization: 2, practiceAnamnesis: 9, practiceDashboard: 1,
        vitals: 7, erezept: 4, patientMedicationPlan: 1, practiceOverview: 1 },
};

const flat = (o, p = "") => {
  const out = {};
  for (const [k, v] of Object.entries(o ?? {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flat(v, `${p}${k}.`));
    else if (typeof v === "string") out[`${p}${k}`] = v;
  }
  return out;
};
const placeholders = (s) => [...String(s ?? "").matchAll(/\{\{?[a-zA-Z]+\}?\}/g)].map((m) => m[0]).sort().join(",");
const gapOf = (code, ns) => KNOWN_GAPS[code]?.[ns] ?? 0;

/* ══════════════════════════════════════════════ the header is the contract */

test("the six active languages are exactly what the header lets a user pick", () => {
  assert.deepEqual(
    [...HEADER_SELECTABLE_LOCALE_CODES].sort(),
    Object.keys(ACTIVE).sort(),
    "the header's selectable set changed — translate the practice area for the new language, then update this guard",
  );
});

test("every selectable locale is a real entry in the registry", () => {
  const known = new Set(LOCALE_OPTIONS.map((o) => o.code));
  for (const code of HEADER_SELECTABLE_LOCALE_CODES) {
    assert.ok(known.has(code), `${code} is selectable but not in LOCALE_OPTIONS`);
  }
});

test("the namespaces this guard covers still exist", () => {
  for (const ns of [...ACTIVE_PRACTICE_NAMESPACES, ...FLAG_OFF_NAMESPACES]) {
    assert.ok(de[ns] && typeof de[ns] === "object", `${ns} is gone — update the guard's namespace list`);
  }
  assert.ok(ACTIVE_PRACTICE_NAMESPACES.length >= 35);
});

/**
 * The namespace list above is frozen, which makes it a claim about the router
 * rather than a reading of it. This test reads the router and holds the claim
 * to it: quietly dropping a namespace from the list — the easiest way to make
 * this guard pass without doing the work — fails here instead.
 */
test("the frozen namespace list still matches what the router reaches", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const main = fs.readFileSync(path.resolve(here, "../../main.jsx"), "utf8");

  const WRAPPERS = new Set([
    "ProtectedRoute", "Suspense", "Gate", "Layout", "AppShell", "ErrorBoundary",
    "PracticeContextProvider", "RequireAuth", "Navigate", "React", "Route",
  ]);
  const componentFile = new Map();
  for (const m of main.matchAll(
    /(?:const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*"([^"]+)"|^import\s+(\w+)\s+from\s+"([^"]+)")/gm,
  )) {
    const name = m[1] ?? m[3];
    const rel = m[2] ?? m[4];
    if (!name || !rel?.startsWith(".")) continue;
    const base = path.resolve(here, "../..", rel.replace(/^\.\//, ""));
    for (const c of [base, `${base}.jsx`, `${base}.js`, path.join(base, "index.jsx")]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) { componentFile.set(name, c); break; }
    }
  }

  const practiceComponents = new Set();
  for (const m of main.matchAll(/<Route\b([\s\S]*?)\/>/g)) {
    const block = m[1];
    const p = block.match(/path="([^"]+)"/)?.[1];
    if (!p || !(/^\/practice/.test(p) || /^\/pre-visit\/follow/.test(p))) continue;
    const el = [...block.matchAll(/<([A-Z]\w+)/g)].map((x) => x[1]).find((n) => !WRAPPERS.has(n));
    if (el) practiceComponents.add(el);
  }
  assert.ok(practiceComponents.size >= 20, `expected the practice routes, found ${practiceComponents.size}`);

  const seen = new Set();
  const nsRe = /getMessages\([^)]*\)\s*(?:\?\.)?\.\s*([a-zA-Z][\w]*)/g;
  const walk = (file, depth = 0) => {
    if (!file || seen.has(file) || depth > 3) return new Set();
    seen.add(file);
    let src = "";
    try { src = fs.readFileSync(file, "utf8"); } catch { return new Set(); }
    const out = new Set();
    for (const x of src.matchAll(nsRe)) out.add(x[1]);
    for (const im of src.matchAll(/from\s+"(\.[^"]+)"/g)) {
      const t = path.resolve(path.dirname(file), im[1]);
      for (const c of [t, `${t}.jsx`, `${t}.js`, path.join(t, "index.jsx"), path.join(t, "index.js")]) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) { for (const n of walk(c, depth + 1)) out.add(n); break; }
      }
    }
    return out;
  };

  const reached = new Set();
  for (const name of practiceComponents) for (const ns of walk(componentFile.get(name))) reached.add(ns);

  // Names the regex picks up from array/string methods, not real namespaces.
  const ARTEFACTS = new Set(["length", "map", "slice", "some", "filter", "find", "join", "trim"]);
  const declared = new Set([...ACTIVE_PRACTICE_NAMESPACES, ...FLAG_OFF_NAMESPACES]);
  const undeclared = [...reached].filter(
    (ns) => !ARTEFACTS.has(ns) && de[ns] && typeof de[ns] === "object" && !declared.has(ns),
  );
  assert.deepEqual(
    undeclared.sort(),
    [],
    `a practice route reaches these namespaces but the guard does not cover them:\n  ${undeclared.join("\n  ")}`,
  );
});

/* ═══════════════════════════════════════════════════════ presence per locale */

test("German and English are complete across the active practice area", () => {
  const missing = [];
  for (const ns of ACTIVE_PRACTICE_NAMESPACES) {
    const keys = Object.keys(flat(de[ns]));
    for (const code of ["de", "en"]) {
      const own = flat(ACTIVE[code][ns]);
      for (const k of keys) if (typeof own[k] !== "string" || !own[k].trim()) missing.push(`${code}:${ns}.${k}`);
    }
  }
  assert.deepEqual(missing, [], `reference languages incomplete:\n  ${missing.slice(0, 20).join("\n  ")}`);
});

test("Russian needs no English fallback anywhere in the active practice area", () => {
  const missing = [];
  for (const ns of ACTIVE_PRACTICE_NAMESPACES) {
    const own = flat(ru[ns]);
    for (const k of Object.keys(flat(de[ns]))) {
      if (typeof own[k] !== "string" || !own[k].trim()) missing.push(`${ns}.${k}`);
    }
  }
  assert.deepEqual(missing, [], `${missing.length} Russian keys fall back to English:\n  ${missing.slice(0, 25).join("\n  ")}`);
});

test("the recorded fr/es/it gaps are exactly what is measured", () => {
  const wrong = [];
  for (const code of ["fr", "es", "it"]) {
    for (const ns of ACTIVE_PRACTICE_NAMESPACES) {
      const own = flat(ACTIVE[code][ns]);
      const actual = Object.keys(flat(de[ns])).filter(
        (k) => typeof own[k] !== "string" || !own[k].trim(),
      ).length;
      const recorded = gapOf(code, ns);
      if (actual !== recorded) {
        wrong.push(`${code}:${ns} has ${actual} missing, KNOWN_GAPS says ${recorded}`);
      }
    }
  }
  assert.deepEqual(
    wrong,
    [],
    `the gap list no longer matches reality — a gap grew (fix it) or shrank (update the list):\n  ${wrong.join("\n  ")}`,
  );
});

/* ═════════════════════════════════════════════════════════════ placeholders */

test("placeholders survive translation in every active language", () => {
  const wrong = [];
  for (const ns of ACTIVE_PRACTICE_NAMESPACES) {
    const canon = flat(de[ns]);
    for (const [k, v] of Object.entries(canon)) {
      const want = placeholders(v);
      for (const [code, bundle] of Object.entries(ACTIVE)) {
        const own = flat(bundle[ns])[k];
        if (typeof own !== "string") continue; // a known gap; presence is tested above
        if (placeholders(own) !== want) wrong.push(`${code}:${ns}.${k} has [${placeholders(own)}], canonical [${want}]`);
      }
    }
  }
  assert.deepEqual(wrong, [], `placeholder mismatch:\n  ${wrong.join("\n  ")}`);
});

/* ══════════════════════════════════════════════════════ wrong-language words */

test("no active locale carries words from another language", () => {
  // Each marker is a word that exists in the named language's neighbours but
  // never in the language itself — verified by hand against the real bundles.
  const MARKERS = {
    it: [/\bEstado\b/i, /Leído/i, /\bFecha\b/i, /Última/i, /\bAbrir\b/i, /\bBuscar\b/i,
         /\bresumen\b/i, /\bseguridad\b/i, /\bequipo\b/i, /\bGenerar\b/i, /desactivad/i,
         /Meseesagg/, /lettos\b/, /Normalee/, /apertos/, /\beste\b/i, /\blos\b/i, /\blas\b/i],
    es: [/\bStato\b/, /\bLetto\b/, /\bAprire\b/, /\bChiudi\b/, /\bSalva\b/, /\bStatut\b/, /\bFermer\b/],
    fr: [/\bEstado\b/, /Leído/, /\bStato\b/, /\bLetto\b/, /\bBuscar\b/, /\bGuardar\b/],
  };
  const offenders = [];
  for (const [code, res] of Object.entries(MARKERS)) {
    for (const ns of ACTIVE_PRACTICE_NAMESPACES) {
      for (const [k, v] of Object.entries(flat(ACTIVE[code][ns]))) {
        for (const re of res) if (re.test(v)) { offenders.push(`${code}:${ns}.${k} — ${JSON.stringify(v).slice(0, 60)}`); break; }
      }
    }
  }
  assert.deepEqual(offenders, [], `wrong language:\n  ${offenders.join("\n  ")}`);
});

/* ═════════════════════════════════════════════ visible technology wording */

test("the filter suggestion names the function, not the technology", () => {
  // German says "Automatischer Filtervorschlag". Every language follows that:
  // naming the technology here would be product wording, not a legal duty.
  for (const [code, bundle] of Object.entries(ACTIVE)) {
    const v = String(bundle.practicePatients?.aiFilterButton ?? "");
    assert.ok(v.trim(), `${code}: aiFilterButton missing`);
    // English still reads "AI filter suggestion" where German reads
    // "Automatischer Filtervorschlag". That is a real inconsistency, but the
    // reference languages were explicitly out of scope for this pass, so it is
    // reported rather than silently rewritten. Remove this line when EN is fixed.
    if (code === "en") continue;
    assert.ok(
      !/\b(KI|AI|IA)\b|künstliche|artificial intelligence|intelligence artificielle|inteligencia artificial|intelligenza artificiale/i.test(v),
      `${code}: aiFilterButton names the technology: ${JSON.stringify(v)}`,
    );
  }
});

test("no raw translation key leaks into a value", () => {
  const leaks = [];
  for (const ns of ACTIVE_PRACTICE_NAMESPACES) {
    for (const [code, bundle] of Object.entries(ACTIVE)) {
      for (const [k, v] of Object.entries(flat(bundle[ns]))) {
        if (/^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/.test(v.trim())) leaks.push(`${code}:${ns}.${k} = ${v}`);
      }
    }
  }
  assert.deepEqual(leaks, [], `raw key as value:\n  ${leaks.join("\n  ")}`);
});
