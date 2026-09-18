import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  addMonths,
  clampIso,
  daysInMonth,
  formatForInput,
  isWithin,
  maskTyping,
  monthMatrix,
  parseIso,
  parseTyped,
  todayIso,
} from "../dateFieldModel.js";

test("parseIso accepts real calendar dates only", () => {
  assert.deepEqual(parseIso("1999-09-11"), { year: 1999, month: 8, day: 11 });
  assert.equal(parseIso("1999-02-29"), null);
  assert.deepEqual(parseIso("2000-02-29"), { year: 2000, month: 1, day: 29 });
  assert.equal(parseIso("1999-13-01"), null);
  assert.equal(parseIso("11.09.1999"), null);
  assert.equal(parseIso(""), null);
});

test("daysInMonth handles leap years", () => {
  assert.equal(daysInMonth(2024, 1), 29);
  assert.equal(daysInMonth(1900, 1), 28);
  assert.equal(daysInMonth(2026, 8), 30);
});

test("addDays and addMonths cross boundaries without drifting", () => {
  assert.equal(addDays("1999-12-31", 1), "2000-01-01");
  assert.equal(addDays("2000-03-01", -1), "2000-02-29");
  assert.equal(addMonths("2001-01-31", 1), "2001-02-28");
  assert.equal(addMonths("2000-01-15", -1), "1999-12-15");
  assert.equal(addMonths("2000-01-15", 12), "2001-01-15");
});

test("clampIso and isWithin respect min and max", () => {
  assert.equal(clampIso("1850-01-01", "1900-01-01", "2026-09-18"), "1900-01-01");
  assert.equal(clampIso("2030-01-01", "1900-01-01", "2026-09-18"), "2026-09-18");
  assert.equal(isWithin("2026-09-19", "1900-01-01", "2026-09-18"), false);
  assert.equal(isWithin("2026-09-18", "1900-01-01", "2026-09-18"), true);
});

test("monthMatrix is Monday-first with blanks outside the month", () => {
  // 1 September 1999 was a Wednesday.
  const rows = monthMatrix(1999, 8);
  assert.deepEqual(rows[0].slice(0, 3), [null, null, "1999-09-01"]);
  assert.ok(rows.every((r) => r.length === 7));
  assert.equal(rows.flat().filter(Boolean).length, 30);
});

test("maskTyping formats digits as the user types", () => {
  assert.equal(maskTyping("11091999", "de"), "11.09.1999");
  assert.equal(maskTyping("11", "de"), "11.");
  assert.equal(maskTyping("1109", "fr"), "11/09/");
  assert.equal(maskTyping("1.9.1999", "de"), "01.09.1999");
  assert.equal(maskTyping("11.09.19991", "de"), "11.09.1999");
  assert.equal(maskTyping("", "de"), "");
  // Backspace on "11." must not put the dot straight back.
  assert.equal(maskTyping("11", "de", { deleting: true }), "11");
  assert.equal(maskTyping("11.09", "de", { deleting: true }), "11.09");
});

test("parseTyped → ISO only for complete, real dates", () => {
  assert.equal(parseTyped("11.09.1999"), "1999-09-11");
  assert.equal(parseTyped("1/9/1999"), "1999-09-01");
  assert.equal(parseTyped("31.02.1999"), null);
  assert.equal(parseTyped("11.09.99"), null);
  assert.equal(parseTyped("11.09."), null);
});

test("formatForInput uses the language's separator", () => {
  assert.equal(formatForInput("1999-09-11", "de"), "11.09.1999");
  assert.equal(formatForInput("1999-09-11", "en"), "11/09/1999");
  assert.equal(formatForInput("nonsense", "de"), "");
});

test("todayIso is local, not UTC", () => {
  assert.equal(todayIso(new Date(2026, 8, 18, 23, 30)), "2026-09-18");
});
