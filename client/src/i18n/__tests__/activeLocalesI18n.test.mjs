/**
 * The six active product languages must be authored, not inherited.
 *
 * The repo's older convention lets any locale fall through to English. For
 * de, en, fr, es, it and ru that is no longer good enough: these are shipped
 * product languages, and an English string in a French practice interface is
 * a defect, not a graceful degradation. The remaining repo locales keep the
 * fallback convention — this guard says nothing about them.
 *
 * "Authored" is checked against the RAW sources, not against getMessages():
 * getMessages() merges English underneath every locale, so it can never tell
 * a translation from a fallback. de/ and en/ own their trees directly; fr, es,
 * it and ru own whatever their override bundle defines before that merge.
 */
import test from "node:test";
import assert from "node:assert/strict";

import de from "../translations/de/index.js";
import en from "../translations/en/index.js";
import fr from "../translations/overrides/fr.js";
import es from "../translations/overrides/es.js";
import it from "../translations/overrides/it.js";
import ru from "../translations/overrides/ru.js";

/** The languages MedScoutX actively ships. */
const ACTIVE = { de, en, fr, es, it, ru };
const TRANSLATED = ["fr", "es", "it", "ru"];

/**
 * The surfaces introduced by phases 5A–5C.
 *
 * `practicePatients` is an old, large namespace, so only the keys these
 * phases added are in scope; the rest is not this guard's business.
 */
const PHASE_SCOPE = {
  practiceInternalWork: null,
  notificationCenter: null,
  practicePatients: [
    "tabInternalWork",
    "filterOpenReminders",
    "filterOpenRemindersYes",
    "filterOpenRemindersNo",
    "openRemindersBadge",
    "openRemindersAria",
    "internalNotesBadge",
    "internalNotesAria",
  ],
};

/**
 * Strings that are legitimately spelled the same as English.
 *
 * Kept explicit and tiny: without it the untranslated-English check would
 * either miss real defects or block correct words. Each entry is a claim that
 * a human checked this one string.
 */
const SAME_AS_ENGLISH_ON_PURPOSE = new Set([
  // "note" is the French word too; "{count} notes" needs no change.
  "fr:practicePatients.internalNotesBadge",
]);

function flat(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flat(v, `${prefix}${k}.`));
    else if (typeof v === "string") out[`${prefix}${k}`] = v;
  }
  return out;
}

/** Every in-scope key, as `namespace.key`. */
function scopedKeys() {
  const keys = [];
  for (const [ns, only] of Object.entries(PHASE_SCOPE)) {
    const deFlat = flat(de[ns]);
    const names = only ? only.filter((k) => k in deFlat) : Object.keys(deFlat);
    for (const k of names) keys.push(`${ns}.${k}`);
  }
  return keys;
}

const read = (bundle, path) =>
  path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), bundle);

const KEYS = scopedKeys();

/**
 * The practice patient list, in full.
 *
 * Not a phase surface but a core one: it is the practice's daily screen, and
 * until now Russian had eight of its two hundred keys. Presence is checked for
 * all six languages; sameness-as-English is NOT, because this namespace is
 * full of legitimate homographs ("Tipo", "Documento", "Status") where
 * demanding a difference would force a worse translation.
 */
const FULL_NAMESPACES = ["practicePatients"];

/** Words that betray the wrong language, each verified against the real one. */
const FOREIGN_MARKERS = {
  it: [
    // Spanish that once leaked into the Italian bundle. "Leído" was found in
    // practiceInbox; the same words must never reappear here.
    "leído", "estado:", "última actividad", "abrir", "buscar", "mensaje",
    "ordenar por", "todos los", "solicitud", "nombre,",
  ],
  es: ["letto", "stato:", "ultima attività", "aprire", "cerca nel"],
  fr: ["estado:", "leído", "stato:", "letto"],
  ru: ["status:", "estado:", "stato:"],
};

function fullKeys(ns) {
  return Object.keys(flat(de[ns])).map((k) => `${ns}.${k}`);
}

const placeholders = (s) => [...String(s ?? "").matchAll(/\{[a-zA-Z]+\}/g)].map((m) => m[0]).sort();

test("the practice patient list is a real namespace, not a stub", () => {
  const n = fullKeys("practicePatients").length;
  assert.ok(n >= 150, `expected the full practicePatients namespace, found ${n} keys`);
});

test("every active language owns the whole practice patient list", () => {
  const missing = [];
  for (const ns of FULL_NAMESPACES) {
    for (const key of fullKeys(ns)) {
      for (const [code, bundle] of Object.entries(ACTIVE)) {
        const v = read(bundle, key);
        if (typeof v !== "string" || !v.trim()) missing.push(`${code}:${key}`);
      }
    }
  }
  assert.equal(
    missing.length,
    0,
    `${missing.length} keys still need the English fallback:\n  ${missing.slice(0, 40).join("\n  ")}`,
  );
});

test("the practice patient list keeps exactly the canonical placeholders", () => {
  const wrong = [];
  for (const ns of FULL_NAMESPACES) {
    for (const key of fullKeys(ns)) {
      const canonical = placeholders(read(de, key));
      for (const [code, bundle] of Object.entries(ACTIVE)) {
        const own = placeholders(read(bundle, key));
        if (own.join(",") !== canonical.join(",")) {
          wrong.push(`${code}:${key} has [${own}], canonical is [${canonical}]`);
        }
      }
    }
  }
  assert.deepEqual(wrong, [], `placeholder mismatch:\n  ${wrong.join("\n  ")}`);
});

/**
 * Inbox namespaces are checked for wrong-language words only.
 *
 * They are not phase surfaces and their completeness is a separate question,
 * but the leak that started this — "Leído" sitting in the Italian practice
 * inbox — lived here, so this is where it must not come back.
 */
const FOREIGN_CHECK_ALSO = ["practiceInbox", "patientInbox"];

/**
 * Leaks that are real, known, and deliberately still unfixed.
 *
 * Empty, and that is a statement: the Italian practice inbox leaks that this
 * list once held have been fixed. It stays here because the guard above holds
 * it to reality — an entry may only exist while the string it names is still
 * broken, so the list can never drift into fiction.
 */
const KNOWN_UNFIXED = new Map([]);

test("the known-leak list describes strings that are actually still there", () => {
  // Stops the list from rotting: once a leak is fixed its entry must go, or
  // the next real leak at that key would be waved through.
  const stale = [];
  for (const [id, expected] of KNOWN_UNFIXED) {
    const [code, key] = id.split(":");
    if (read(ACTIVE[code], key) !== expected) stale.push(`${id} no longer reads ${JSON.stringify(expected)}`);
  }
  assert.deepEqual(stale, [], `remove these from KNOWN_UNFIXED:\n  ${stale.join("\n  ")}`);
});

test("no active locale carries a word from the wrong language", () => {
  const offenders = [];
  const all = [
    ...KEYS,
    ...FULL_NAMESPACES.flatMap(fullKeys),
    ...FOREIGN_CHECK_ALSO.flatMap(fullKeys),
  ];
  for (const [code, markers] of Object.entries(FOREIGN_MARKERS)) {
    for (const key of all) {
      const v = String(read(ACTIVE[code], key) ?? "").toLowerCase();
      if (KNOWN_UNFIXED.has(`${code}:${key}`)) continue;
      for (const m of markers) if (v.includes(m)) offenders.push(`${code}:${key} — "${m}" in ${JSON.stringify(v)}`);
    }
  }
  assert.deepEqual(offenders, [], `wrong language:\n  ${offenders.join("\n  ")}`);
});

test("the link, the profile and the account stay three different words in every language", () => {
  // These name three different objects, and the whole access model rests on
  // not confusing them. A translation that collapses two into one word would
  // make the record screen lie about what it is showing.
  for (const code of Object.keys(ACTIVE)) {
    const link = read(ACTIVE[code], "practicePatients.detailLinkId");
    const profile = read(ACTIVE[code], "practicePatients.detailPatientProfileId");
    const account = read(ACTIVE[code], "practicePatients.detailPatientUserId");
    const set = new Set([link, profile, account]);
    assert.equal(set.size, 3, `${code}: link/profile/account collapsed into ${[...set].join(" / ")}`);
  }
});


test("phases 5A-5C actually introduced translatable surface", () => {
  assert.ok(KEYS.length >= 60, `expected the 5A-5C surface, found ${KEYS.length} keys`);
});

test("every active language owns every key directly", () => {
  const missing = [];
  for (const [code, bundle] of Object.entries(ACTIVE)) {
    for (const key of KEYS) {
      const v = read(bundle, key);
      if (typeof v !== "string" || !v.trim()) missing.push(`${code}:${key}`);
    }
  }
  assert.deepEqual(missing, [], `not authored in the locale itself:\n  ${missing.join("\n  ")}`);
});

test("fr/es/it/ru are translations, not English left in place", () => {
  const untranslated = [];
  for (const code of TRANSLATED) {
    for (const key of KEYS) {
      const own = read(ACTIVE[code], key);
      const english = read(en, key);
      if (own !== english) continue;
      if (SAME_AS_ENGLISH_ON_PURPOSE.has(`${code}:${key}`)) continue;
      untranslated.push(`${code}:${key} = ${JSON.stringify(own)}`);
    }
  }
  assert.deepEqual(
    untranslated,
    [],
    `identical to English — translate it, or justify it in SAME_AS_ENGLISH_ON_PURPOSE:\n  ${untranslated.join("\n  ")}`,
  );
});

test("a count placeholder survives every translation", () => {
  const broken = [];
  for (const [code, bundle] of Object.entries(ACTIVE)) {
    for (const key of KEYS) {
      const german = read(de, key);
      if (typeof german !== "string" || !german.includes("{count}")) continue;
      const own = read(bundle, key);
      if (!String(own).includes("{count}")) broken.push(`${code}:${key} = ${JSON.stringify(own)}`);
    }
  }
  assert.deepEqual(broken, [], `lost {count}:\n  ${broken.join("\n  ")}`);
});

test("no placeholder is invented that German does not have", () => {
  const extra = [];
  for (const [code, bundle] of Object.entries(ACTIVE)) {
    for (const key of KEYS) {
      const own = String(read(bundle, key) ?? "");
      const german = String(read(de, key) ?? "");
      for (const token of own.match(/\{[a-zA-Z]+\}/g) ?? []) {
        if (!german.includes(token)) extra.push(`${code}:${key} has ${token}`);
      }
    }
  }
  assert.deepEqual(extra, [], `unknown placeholder:\n  ${extra.join("\n  ")}`);
});

test("the practice-team-only wording stays unmistakable", () => {
  // This one string is what stops an internal note from being mistaken for
  // something the patient can read, so it may never quietly become generic.
  const expected = {
    de: ["praxisteam"],
    en: ["practice team"],
    fr: ["équipe"],
    es: ["equipo"],
    it: ["team"],
    ru: ["команды", "команда"],
  };
  for (const [code, needles] of Object.entries(expected)) {
    const badge = String(read(ACTIVE[code], "practiceInternalWork.teamOnlyBadge") ?? "").toLowerCase();
    assert.ok(
      needles.some((n) => badge.includes(n)),
      `${code}: teamOnlyBadge lost the team reference: ${JSON.stringify(badge)}`,
    );
  }
});

test("follow-ups are never worded as clinical urgency", () => {
  // "Offene Wiedervorlage" is a work marker. A translation that says urgent,
  // critical or emergency would turn an organisational label into a medical
  // claim the product does not make.
  const forbidden = [
    "urgent", "urgente", "urgency", "dringend", "срочно", "срочн",
    "critical", "critique", "crítico", "critico", "критич",
    "emergency", "urgence", "emergencia", "emergenza", "экстренн",
  ];
  const offenders = [];
  for (const [code, bundle] of Object.entries(ACTIVE)) {
    for (const key of KEYS) {
      const v = String(read(bundle, key) ?? "").toLowerCase();
      for (const word of forbidden) if (v.includes(word)) offenders.push(`${code}:${key} — "${word}"`);
    }
  }
  assert.deepEqual(offenders, [], `clinical urgency wording:\n  ${offenders.join("\n  ")}`);
});

test("the notification badge stays 'new' or 'unread', never a task count", () => {
  const expected = {
    de: ["ungelesen", "neu"],
    en: ["unread", "new"],
    fr: ["non lu", "nouveau", "nouveaux"],
    es: ["sin leer", "nuevo", "nuevos"],
    it: ["non lett", "nuovo", "nuovi"],
    ru: ["непрочит", "нов"],
  };
  for (const [code, needles] of Object.entries(expected)) {
    for (const key of ["notificationCenter.unreadLabel", "notificationCenter.newLabel"]) {
      const v = String(read(ACTIVE[code], key) ?? "").toLowerCase();
      assert.ok(
        needles.some((n) => v.includes(n)),
        `${code}.${key} no longer says new/unread: ${JSON.stringify(v)}`,
      );
    }
  }
});
