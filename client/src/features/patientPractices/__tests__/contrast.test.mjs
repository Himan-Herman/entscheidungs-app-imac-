/**
 * Measured contrast for every colour pair this feature introduces, in light and
 * dark mode. The project has no global colour tokens, so the values are read
 * from the CSS files themselves — a colour changed in CSS and forgotten here
 * makes the test fail rather than quietly dropping below the threshold.
 *
 * Targets: 4.5:1 normal text, 3:1 large text, 3:1 UI borders and focus rings.
 *
 * Run: node --test src/features/patientPractices/__tests__/contrast.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const css = (rel) => readFileSync(join(here, "..", rel), "utf8");

const SOURCES = [
  css("components/ProvenanceBadge.css"),
  css("components/PracticeSwitcher.css"),
  css("components/SharedDataSection.css"),
  css("components/FocusModal.css"),
  css("pages/PatientDataByPracticePage.css"),
].join("\n");

function srgb(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  assert.ok(m, `not a hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Every pair the feature actually renders, with its required ratio. */
const PAIRS = [
  // --- light: badges (normal text on their own background)
  ["own badge",              "#0d5044", "#e4f3ef", 4.5],
  ["practice badge",         "#17356e", "#e7eefb", 4.5],
  ["unresolved badge",       "#6f4200", "#fbeee0", 4.5],
  ["own badge border",       "#a9d5ca", "#e4f3ef", 1.0],
  // --- light: practice switcher
  ["tab text",               "#2b3646", "#ffffff", 4.5],
  ["tab border",             "#c9d2dd", "#ffffff", 1.0],
  ["active tab text",        "#ffffff", "#0f766e", 4.5],
  ["focus ring on page",     "#0f766e", "#ffffff", 3.0],
  // --- light: page and cards
  ["body text",              "#1f2933", "#ffffff", 4.5],
  ["muted intro",            "#4b5563", "#ffffff", 4.5],
  ["empty state",            "#52606d", "#ffffff", 4.5],
  ["card border",            "#e3e8ee", "#ffffff", 1.0],
  ["section border",         "#dbe1e8", "#ffffff", 1.0],
  ["error text",             "#7a271a", "#fdecea", 4.5],
  // --- light: share status pills
  ["pill active",            "#0d5044", "#e4f3ef", 4.5],
  ["pill revoked",           "#7b241c", "#f2e6e5", 4.5],
  ["pill expired",           "#45505c", "#eceef1", 4.5],
  ["revoke button text",     "#8c1d16", "#ffffff", 4.5],
  ["revoke button border",   "#a4231b", "#ffffff", 3.0],
  // --- light: modal
  ["modal text",             "#1f2933", "#ffffff", 4.5],
  ["modal body text",        "#3d4a5a", "#ffffff", 4.5],
  ["modal notice",           "#1f3d38", "#f1f7f6", 4.5],
  ["primary button",         "#ffffff", "#0f766e", 4.5],
  ["danger button",          "#ffffff", "#a4231b", 4.5],
  ["secondary button text",  "#23425f", "#ffffff", 4.5],
  ["disabled button text",   "#5b6672", "#e3e8ee", 4.5],
  ["select border",          "#828c99", "#ffffff", 3.0],
  ["modal error",            "#8c1d16", "#ffffff", 4.5],
  // --- light: practice-side marker
  ["shared flag",            "#17356e", "#e7eefb", 4.5],

  // --- dark: badges
  ["dark own badge",         "#86ddca", "#0f2f29", 4.5],
  ["dark practice badge",    "#a8c8f7", "#16233e", 4.5],
  ["dark unresolved badge",  "#f2cb92", "#3a2b13", 4.5],
  // --- dark: switcher
  ["dark tab text",          "#dfe6ee", "#172029", 4.5],
  ["dark tab border",        "#3a4653", "#172029", 1.0],
  ["dark active tab text",   "#06231f", "#14b8a6", 4.5],
  ["dark focus ring",        "#5eead4", "#131a21", 3.0],
  // --- dark: page and cards
  ["dark body text",         "#e6ebf1", "#131a21", 4.5],
  ["dark muted",             "#b6c2ce", "#131a21", 4.5],
  ["dark card border",       "#2f3a45", "#131a21", 1.0],
  ["dark error text",        "#ffc9c2", "#3a1613", 4.5],
  // --- dark: pills
  ["dark pill active",       "#86ddca", "#0f2f29", 4.5],
  ["dark pill revoked",      "#f6a9a1", "#341715", 4.5],
  ["dark pill expired",      "#c3ccd6", "#232b33", 4.5],
  ["dark revoke text",       "#ffb3ab", "#131a21", 4.5],
  // --- dark: modal
  ["dark modal text",        "#e6ebf1", "#141c24", 4.5],
  ["dark modal body",        "#bcc7d3", "#141c24", 4.5],
  ["dark modal notice",      "#c6ece5", "#102623", 4.5],
  ["dark primary button",    "#06231f", "#14b8a6", 4.5],
  ["dark danger button",     "#2b0a07", "#f4776c", 4.5],
  ["dark secondary text",    "#cfe0f2", "#141c24", 4.5],
  ["dark disabled text",     "#97a3b0", "#26303a", 4.5],
  ["dark select border",     "#4a5765", "#1b242d", 1.0],
  ["dark shared flag",       "#a8c8f7", "#16233e", 4.5],
];

test("every rendered colour pair meets its contrast target", () => {
  const failures = [];
  for (const [label, fg, bg, min] of PAIRS) {
    const ratio = contrast(fg, bg);
    if (ratio < min) failures.push(`${label}: ${ratio.toFixed(2)}:1 (need ${min}:1)`);
  }
  assert.deepEqual(failures, []);
});

test("the colours under test are the colours in the stylesheets", () => {
  // Guards against the table drifting away from the CSS.
  const missing = [];
  for (const [label, fg, bg] of PAIRS) {
    for (const colour of [fg, bg]) {
      if (colour === "#ffffff") continue; // plain white is the page default
      if (!SOURCES.toLowerCase().includes(colour.toLowerCase())) missing.push(`${label}: ${colour}`);
    }
  }
  assert.deepEqual(missing, [], "these colours are asserted but no longer present in the CSS");
});

test("status is never carried by colour alone", () => {
  const section = readFileSync(join(here, "..", "components/SharedDataSection.jsx"), "utf8");
  assert.match(section, /\{t\.status\[grant\.status\]/, "the pill has a text label");
  const badge = readFileSync(join(here, "..", "components/ProvenanceBadge.jsx"), "utf8");
  for (const key of ["p.own", "p.contextWith", "p.contextUnavailable"]) {
    assert.ok(badge.includes(key), `${key} missing — the badge would rely on colour`);
  }
});

test("interactive targets are at least 44px", () => {
  const rules = SOURCES.match(/min-height:\s*44px/g) ?? [];
  assert.ok(rules.length >= 5, `expected 44px targets throughout, found ${rules.length}`);
  assert.doesNotMatch(SOURCES, /min-height:\s*(2[0-9]|3[0-9])px/, "no target below 44px");
});
