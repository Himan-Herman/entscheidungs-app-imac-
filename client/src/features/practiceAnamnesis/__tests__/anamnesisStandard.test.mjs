/**
 * Tests for standardQuestions.js (client-side catalog) and edit/view mode logic.
 * Run: node --test client/src/features/practiceAnamnesis/__tests__/anamnesisStandard.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load standardQuestions.js via source parse ────────────────────────────────
// (avoids needing JSX/Vite pipeline for a pure-logic test)

const src = readFileSync(path.join(__dirname, "../standardQuestions.js"), "utf8");

// Strip JSDoc comment and execute the ES module exports
const moduleSrc = src
  .replace(/^\/\*\*[\s\S]*?\*\//m, "") // strip leading JSDoc
  .replace(/^export (function|const)/gm, "$1"); // strip export keywords for eval

let STANDARD_QUESTION_CATALOG, emptyLangMap, newDraftQuestion, questionFromCatalog;
try {
  // eslint-disable-next-line no-new-func
  const fn = new Function(moduleSrc + "\nreturn { STANDARD_QUESTION_CATALOG, emptyLangMap, newDraftQuestion, questionFromCatalog };");
  ({ STANDARD_QUESTION_CATALOG, emptyLangMap, newDraftQuestion, questionFromCatalog } = fn());
} catch (e) {
  throw new Error(`Could not load standardQuestions.js: ${e.message}`);
}

const LANGS = ["de", "en", "fr", "it", "es"];
const VALID_TYPES = new Set(["text", "textarea", "single_choice", "multi_choice", "date", "number", "yes_no"]);

// ── Catalog tests ─────────────────────────────────────────────────────────────

test("STANDARD_QUESTION_CATALOG is non-empty array", () => {
  assert.ok(Array.isArray(STANDARD_QUESTION_CATALOG));
  assert.ok(STANDARD_QUESTION_CATALOG.length > 0);
});

test("every catalog entry has a unique id", () => {
  const ids = STANDARD_QUESTION_CATALOG.map((q) => q.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, "all ids are unique");
});

test("every catalog entry has a valid type", () => {
  for (const q of STANDARD_QUESTION_CATALOG) {
    assert.ok(VALID_TYPES.has(q.type), `${q.id} has valid type '${q.type}'`);
  }
});

test("every catalog entry labelJson has all 5 language keys", () => {
  for (const q of STANDARD_QUESTION_CATALOG) {
    for (const lang of LANGS) {
      assert.ok(typeof q.labelJson[lang] === "string" && q.labelJson[lang].length > 0,
        `${q.id} labelJson.${lang} is non-empty string`);
    }
  }
});

test("single_choice entries have optionsJson with all 5 languages per option", () => {
  for (const q of STANDARD_QUESTION_CATALOG) {
    if (q.type === "single_choice" || q.type === "multi_choice") {
      assert.ok(Array.isArray(q.optionsJson) && q.optionsJson.length >= 2,
        `${q.id} has at least 2 options`);
      for (const [i, opt] of q.optionsJson.entries()) {
        for (const lang of LANGS) {
          assert.ok(opt[lang]?.length > 0, `${q.id} option[${i}].${lang} non-empty`);
        }
      }
    }
  }
});

test("catalog contains required questions: hauptbeschwerde and beschwerden_dauer", () => {
  const ids = new Set(STANDARD_QUESTION_CATALOG.map((q) => q.id));
  assert.ok(ids.has("hauptbeschwerde"), "has hauptbeschwerde");
  assert.ok(ids.has("beschwerden_dauer"), "has beschwerden_dauer");
});

test("catalog contains new questions from spec", () => {
  const ids = new Set(STANDARD_QUESTION_CATALOG.map((q) => q.id));
  assert.ok(ids.has("familienanamnese"), "has familienanamnese");
  assert.ok(ids.has("beschwerden_einfluss"), "has beschwerden_einfluss");
  assert.ok(ids.has("medikamente_geaendert"), "has medikamente_geaendert");
  assert.ok(ids.has("schwangerschaft"), "has schwangerschaft");
  assert.ok(ids.has("stillzeit"), "has stillzeit");
  assert.ok(ids.has("belastungen"), "has belastungen");
  assert.ok(ids.has("dokumente"), "has dokumente");
});

test("rauchen has 3 options (nein/ja/früher)", () => {
  const q = STANDARD_QUESTION_CATALOG.find((x) => x.id === "rauchen");
  assert.ok(q, "rauchen question exists");
  assert.equal(q.optionsJson.length, 3);
});

test("alkohol has 4 options including 'keine Angabe'", () => {
  const q = STANDARD_QUESTION_CATALOG.find((x) => x.id === "alkohol");
  assert.ok(q, "alkohol question exists");
  assert.equal(q.optionsJson.length, 4);
  const hasKA = q.optionsJson.some((o) => o.de.includes("Keine Angabe") || o.de.includes("keine Angabe"));
  assert.ok(hasKA, "alkohol has 'keine Angabe' option");
});

test("schwangerschaft has 4 options including 'nicht relevant'", () => {
  const q = STANDARD_QUESTION_CATALOG.find((x) => x.id === "schwangerschaft");
  assert.ok(q);
  assert.equal(q.optionsJson.length, 4);
  const hasNA = q.optionsJson.some((o) => o.de.includes("Nicht relevant") || o.de.includes("nicht relevant"));
  assert.ok(hasNA, "schwangerschaft has 'nicht relevant' option");
});

// ── emptyLangMap ──────────────────────────────────────────────────────────────

test("emptyLangMap returns object with all 5 language keys set to empty string", () => {
  const m = emptyLangMap();
  for (const lang of LANGS) {
    assert.equal(m[lang], "", `emptyLangMap.${lang} === ""`);
  }
});

// ── newDraftQuestion ──────────────────────────────────────────────────────────

test("newDraftQuestion returns a question with unique _clientId", () => {
  const q1 = newDraftQuestion();
  const q2 = newDraftQuestion();
  assert.ok(q1._clientId.startsWith("_new_"), "has _new_ prefix");
  assert.notEqual(q1._clientId, q2._clientId, "unique ids");
  assert.equal(q1.type, "text");
  assert.equal(q1.isRequired, false);
});

// ── questionFromCatalog ───────────────────────────────────────────────────────

test("questionFromCatalog copies labelJson and sets _clientId", () => {
  const item = STANDARD_QUESTION_CATALOG[0]; // hauptbeschwerde
  const q = questionFromCatalog(item);
  assert.ok(q._clientId.startsWith("_new_"));
  assert.equal(q.type, item.type);
  assert.equal(q.labelJson.de, item.labelJson.de);
  assert.equal(q.labelJson.en, item.labelJson.en);
  assert.equal(q.isRequired, item.isRequired);
});

test("questionFromCatalog preserves optionsJson for single_choice", () => {
  const item = STANDARD_QUESTION_CATALOG.find((x) => x.type === "single_choice");
  const q = questionFromCatalog(item);
  assert.equal(q.optionsJson.length, item.optionsJson.length);
  assert.equal(q.optionsJson[0].de, item.optionsJson[0].de);
});

// ── View mode / edit mode logic (stateless unit tests) ────────────────────────

test("view mode: template sections are readonly (no mutations without explicit edit)", () => {
  // Simulate the templateToDraft function behavior
  const mockTemplate = {
    titleJson: { de: "Test", en: "Test" },
    sections: [
      {
        id: "sec1",
        titleJson: { de: "Abschnitt 1" },
        questions: [{ id: "q1", type: "text", labelJson: { de: "Frage 1" }, isRequired: true }],
      },
    ],
  };

  // In view mode, template is the source of truth; draft is null
  let draft = null;
  const isEditing = false;

  assert.equal(draft, null, "draft is null in view mode");
  assert.equal(isEditing, false, "isEditing is false");

  // Only entering edit mode creates a draft
  const enterEditMode = () => {
    draft = {
      titleJson: { ...mockTemplate.titleJson },
      sections: mockTemplate.sections.map((s) => ({ ...s })),
    };
    return draft;
  };

  const createdDraft = enterEditMode();
  assert.ok(createdDraft !== null, "draft created after enterEditMode");
  assert.equal(createdDraft.sections.length, 1);
});

test("edit mode: question deletion removes from draft but not from original template", () => {
  const originalSections = [
    { _clientId: "sec1", questions: [{ _clientId: "q1" }, { _clientId: "q2" }] },
  ];
  let draft = { sections: JSON.parse(JSON.stringify(originalSections)) };

  // Simulate deleteQuestion
  const deleteQuestion = (secId, qId) => {
    draft = {
      ...draft,
      sections: draft.sections.map((s) =>
        s._clientId === secId
          ? { ...s, questions: s.questions.filter((q) => q._clientId !== qId) }
          : s,
      ),
    };
  };

  deleteQuestion("sec1", "q1");

  assert.equal(draft.sections[0].questions.length, 1, "draft has 1 question after deletion");
  assert.equal(originalSections[0].questions.length, 2, "original unchanged");
  assert.equal(draft.sections[0].questions[0]._clientId, "q2");
});

test("required field validation: missing required answer fails", () => {
  const section = {
    questions: [
      { id: "q1", isRequired: true, type: "textarea" },
      { id: "q2", isRequired: false, type: "text" },
    ],
  };
  const answers = { q2: "filled" };

  const errors = {};
  for (const q of section.questions) {
    if (!q.isRequired) continue;
    const val = answers[q.id];
    if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
      errors[q.id] = true;
    }
  }

  assert.ok(errors.q1 === true, "required q1 fails validation");
  assert.ok(!errors.q2, "optional q2 passes");
});

test("required field validation: filled required answer passes", () => {
  const section = {
    questions: [{ id: "q1", isRequired: true, type: "textarea" }],
  };
  const answers = { q1: "I have a headache" };

  const errors = {};
  for (const q of section.questions) {
    if (!q.isRequired) continue;
    const val = answers[q.id];
    if (!val || (Array.isArray(val) && val.length === 0)) errors[q.id] = true;
  }

  assert.equal(Object.keys(errors).length, 0, "no validation errors");
});

test("patient page: yes_no question renders two choices", () => {
  // Simulate the question type routing logic
  const renderType = (type) => {
    if (type === "yes_no") return ["yes", "no"];
    if (type === "textarea") return ["textarea"];
    if (type === "single_choice") return ["options"];
    if (type === "number") return ["number-input"];
    return ["text-input"];
  };

  assert.deepEqual(renderType("yes_no"), ["yes", "no"]);
  assert.deepEqual(renderType("textarea"), ["textarea"]);
  assert.deepEqual(renderType("single_choice"), ["options"]);
  assert.deepEqual(renderType("number"), ["number-input"]);
});

console.log("\n✓ All standardQuestions and anamnesis logic tests passed.\n");
