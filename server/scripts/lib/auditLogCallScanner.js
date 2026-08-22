/**
 * Finds misuse of the fire-and-forget audit helper.
 *
 * `writeAuditLog` is BEST EFFORT by design: it returns `undefined`, not a
 * promise, and swallows its own write failures (see services/auditLogService.js).
 * Chaining `.catch()` / `.then()` / `.finally()` onto it therefore throws a
 * TypeError AFTER the domain mutation has already been committed — the row is
 * written, the request fails, and the user is told the opposite of what happened.
 * `await`-ing it is harmless at runtime but signals the same misunderstanding.
 *
 * Deliberately NOT a regex over raw source: a naive scan matches the pattern
 * inside comments and documentation — including the warnings in the audit
 * service itself. This strips comments and strings first, then walks the call
 * expression with balanced parentheses so it sees where the call actually ends.
 *
 * `writeRequiredAuditLog` DOES return a promise and is not reported.
 */

/**
 * Replaces comment and string bodies with spaces, preserving offsets so
 * reported line numbers stay accurate.
 *
 * @param {string} src
 */
export function stripCommentsAndStrings(src) {
  const out = src.split("");
  let i = 0;
  const n = src.length;
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k += 1) if (out[k] !== "\n") out[k] = " ";
  };

  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (c === "/" && next === "/") {
      let end = src.indexOf("\n", i);
      if (end === -1) end = n;
      blank(i, end);
      i = end;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === quote) break;
        j += 1;
      }
      blank(i + 1, j);
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return out.join("");
}

/**
 * Replaces COMMENT bodies with spaces but leaves string literals intact,
 * preserving offsets.
 *
 * The policy guard has to find action names, which live inside string literals —
 * `stripCommentsAndStrings` blanks those out, so searching its output for
 * `"consent_record_granted"` silently finds nothing and the guard passes
 * vacuously. This keeps the strings and removes only the commentary.
 *
 * @param {string} src
 */
export function stripComments(src) {
  const out = src.split("");
  let i = 0;
  const n = src.length;
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k += 1) if (out[k] !== "\n") out[k] = " ";
  };

  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (c === "/" && next === "/") {
      let end = src.indexOf("\n", i);
      if (end === -1) end = n;
      blank(i, end);
      i = end;
      continue;
    }
    // Skip over string bodies so a quoted "//" is not mistaken for a comment.
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === quote) break;
        j += 1;
      }
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return out.join("");
}

/**
 * Index just past the closing parenthesis of the call starting at `openParen`.
 * Returns -1 when the parentheses never balance.
 *
 * @param {string} src comment/string-stripped source
 * @param {number} openParen index of "("
 */
function endOfCall(src, openParen) {
  let depth = 0;
  for (let i = openParen; i < src.length; i += 1) {
    if (src[i] === "(") depth += 1;
    else if (src[i] === ")") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Chained members that only make sense on a promise. */
const PROMISE_MEMBERS = ["catch", "then", "finally"];

/**
 * @param {string} source raw file contents
 * @param {string} [file] for reporting
 * @returns {{ file: string, line: number, kind: "chain" | "await", detail: string }[]}
 */
export function findAuditLogMisuse(source, file = "") {
  const src = stripCommentsAndStrings(source);
  const findings = [];
  const NAME = "writeAuditLog";

  for (let i = src.indexOf(NAME); i !== -1; i = src.indexOf(NAME, i + 1)) {
    // Skip writeRequiredAuditLog and any other identifier that merely ends with
    // the same characters, plus the declaration itself.
    const before = src[i - 1] ?? "";
    if (/[A-Za-z0-9_$]/.test(before)) continue;

    let j = i + NAME.length;
    while (j < src.length && /\s/.test(src[j])) j += 1;
    if (src[j] !== "(") continue;

    const lineOf = (idx) => source.slice(0, idx).split("\n").length;

    // `await writeAuditLog(...)` — harmless at runtime, wrong in intent.
    const preceding = src.slice(Math.max(0, i - 8), i);
    if (/\bawait\s*$/.test(preceding)) {
      // Offset of the `await` keyword itself, so a fixer can remove exactly it.
      const awaitStart = i - preceding.length + preceding.search(/\bawait\s*$/);
      findings.push({
        file,
        line: lineOf(i),
        kind: "await",
        detail: "await on a fire-and-forget helper that returns undefined",
        start: awaitStart,
        end: i,
      });
      continue;
    }

    const end = endOfCall(src, j);
    if (end === -1) continue;

    let k = end;
    while (k < src.length && /\s/.test(src[k])) k += 1;
    if (src[k] !== ".") continue;

    let m = k + 1;
    while (m < src.length && /\s/.test(src[m])) m += 1;
    const member = /^[A-Za-z]+/.exec(src.slice(m, m + 12))?.[0];
    if (!member || !PROMISE_MEMBERS.includes(member)) continue;

    // The whole chained segment, from the dot to its closing parenthesis.
    const chainEnd = endOfCall(src, src.indexOf("(", m));
    findings.push({
      file,
      line: lineOf(k),
      kind: "chain",
      detail: `.${member}() chained onto a helper that returns undefined`,
      start: k,
      end: chainEnd === -1 ? -1 : chainEnd,
    });
  }

  return findings;
}
