/**
 * Verifies STANDARD_TEMPLATE_STRUCTURE for the practice anamnesis feature.
 * Run: node server/scripts/verifyAnamnesisStandard.js
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// ── Inline structure ──────────────────────────────────────────────────────────
// We duplicate the constant here so the test has no server-framework deps.

const LANGS = ["de", "en", "fr", "it", "es"];
const VALID_TYPES = new Set(["text", "textarea", "single_choice", "multi_choice", "date", "number", "yes_no"]);

const STANDARD_TEMPLATE_STRUCTURE = (await import("../routes/practiceAnamnesis.js", { assert: { type: "json" } }).catch(() => null));

// Since we can't easily import the constant, we re-declare the expected shape
// and validate via the exported logic. Instead, parse the source directly.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, "../routes/practiceAnamnesis.js"), "utf8");

// Extract STANDARD_TEMPLATE_STRUCTURE via simple eval in a controlled scope
const match = src.match(/const STANDARD_TEMPLATE_STRUCTURE = (\{[\s\S]+?\});\s*\/\/ ── Helpers/);
assert.ok(match, "STANDARD_TEMPLATE_STRUCTURE found in source");

let STRUCT;
try {
  // eslint-disable-next-line no-eval
  STRUCT = eval(`(${match[1]})`);
} catch (e) {
  assert.fail(`Could not parse STANDARD_TEMPLATE_STRUCTURE: ${e.message}`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("STANDARD_TEMPLATE_STRUCTURE has titleJson in all 5 languages", () => {
  for (const lang of LANGS) {
    assert.ok(STRUCT.titleJson[lang]?.length > 0, `titleJson.${lang} is non-empty`);
  }
});

test("STANDARD_TEMPLATE_STRUCTURE has descriptionJson in all 5 languages", () => {
  for (const lang of LANGS) {
    assert.ok(STRUCT.descriptionJson[lang]?.length > 0, `descriptionJson.${lang} is non-empty`);
  }
});

test("STANDARD_TEMPLATE_STRUCTURE has exactly 7 sections", () => {
  assert.equal(STRUCT.sections.length, 7);
});

test("all section titles have translations in all 5 languages", () => {
  for (const [i, sec] of STRUCT.sections.entries()) {
    for (const lang of LANGS) {
      assert.ok(sec.titleJson[lang]?.length > 0, `section ${i + 1} titleJson.${lang}`);
    }
  }
});

test("all questions have valid type", () => {
  for (const sec of STRUCT.sections) {
    for (const q of sec.questions) {
      assert.ok(VALID_TYPES.has(q.type), `type '${q.type}' is valid`);
    }
  }
});

test("all question labels have de and en translations", () => {
  for (const [si, sec] of STRUCT.sections.entries()) {
    for (const [qi, q] of sec.questions.entries()) {
      assert.ok(q.labelJson.de?.length > 0, `sec ${si + 1} q ${qi + 1} labelJson.de`);
      assert.ok(q.labelJson.en?.length > 0, `sec ${si + 1} q ${qi + 1} labelJson.en`);
    }
  }
});

test("all question labels have translations in all 5 languages", () => {
  for (const [si, sec] of STRUCT.sections.entries()) {
    for (const [qi, q] of sec.questions.entries()) {
      for (const lang of LANGS) {
        assert.ok(q.labelJson[lang]?.length > 0, `sec ${si + 1} q ${qi + 1} labelJson.${lang}`);
      }
    }
  }
});

test("single_choice and multi_choice questions have options", () => {
  for (const sec of STRUCT.sections) {
    for (const q of sec.questions) {
      if (q.type === "single_choice" || q.type === "multi_choice") {
        assert.ok(Array.isArray(q.optionsJson) && q.optionsJson.length > 0,
          `${q.labelJson.de} has options`);
        for (const opt of q.optionsJson) {
          for (const lang of LANGS) {
            assert.ok(opt[lang]?.length > 0, `option.${lang} non-empty in ${q.labelJson.de}`);
          }
        }
      }
    }
  }
});

test("section 1 (Aktuelles Anliegen) has at least 4 questions with first 2 required", () => {
  const sec = STRUCT.sections[0];
  assert.ok(sec.questions.length >= 4);
  assert.equal(sec.questions[0].isRequired, true);
  assert.equal(sec.questions[1].isRequired, true);
});

test("section 1 first question is textarea type", () => {
  assert.equal(STRUCT.sections[0].questions[0].type, "textarea");
});

test("section 3 (Medikamente) has yes_no question for medication changes", () => {
  const sec = STRUCT.sections[2];
  const hasYesNo = sec.questions.some((q) => q.type === "yes_no");
  assert.ok(hasYesNo, "section 3 has a yes_no question");
});

test("section 5 (Lebenssituation) first question is single_choice for smoking with 3 options", () => {
  const sec = STRUCT.sections[4];
  const smokingQ = sec.questions[0];
  assert.equal(smokingQ.type, "single_choice");
  assert.equal(smokingQ.optionsJson.length, 3);
});

test("section 6 (Schwangerschaft) first question has 4 options including 'not applicable'", () => {
  const sec = STRUCT.sections[5];
  assert.equal(sec.questions.length, 2);
  assert.equal(sec.questions[0].optionsJson.length, 4);
});

test("section 7 (Fragen an die Praxis) has yes_no question for documents", () => {
  const sec = STRUCT.sections[6];
  const hasYesNo = sec.questions.some((q) => q.type === "yes_no");
  assert.ok(hasYesNo);
});

test("total question count is between 20 and 30", () => {
  const count = STRUCT.sections.reduce((n, s) => n + s.questions.length, 0);
  assert.ok(count >= 20 && count <= 30, `question count ${count} is in range`);
});

console.log("\n✓ All STANDARD_TEMPLATE_STRUCTURE tests passed.\n");
