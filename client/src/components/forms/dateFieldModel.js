/**
 * Pure date logic for <DateField>. No DOM, no React — so it can be tested with
 * plain `node --test`, and so the component itself stays about presentation.
 *
 * Every date here is a CALENDAR date, never an instant: "YYYY-MM-DD" strings in
 * and out, and Date objects only ever built at local midnight via
 * `new Date(y, m, d)`. Parsing "1999-09-11" with `new Date(string)` would read
 * it as UTC midnight and show the previous day west of Greenwich.
 */

const pad2 = (n) => String(n).padStart(2, "0");

/** Days in a month; `month` is 0-based. */
export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** "YYYY-MM-DD" from parts (month 0-based). */
export function toIso(year, month, day) {
  return `${String(year).padStart(4, "0")}-${pad2(month + 1)}-${pad2(day)}`;
}

/**
 * "YYYY-MM-DD" → { year, month (0-based), day }, or null for anything that is
 * not a real calendar date (31 February, month 13, …).
 */
export function parseIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (month < 0 || month > 11 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** Today as "YYYY-MM-DD" in local time. */
export function todayIso(now = new Date()) {
  return toIso(now.getFullYear(), now.getMonth(), now.getDate());
}

/** ISO strings of equal length compare correctly as strings. */
export function isWithin(iso, min, max) {
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}

/** Add days to an ISO date; crosses months and years correctly. */
export function addDays(iso, delta) {
  const p = parseIso(iso);
  if (!p) return iso;
  const d = new Date(p.year, p.month, p.day + delta);
  return toIso(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Move by whole months, clamping the day (31 Jan + 1 month = 28/29 Feb, not
 * 2/3 March — the jump the user asked for, not a surprise).
 */
export function addMonths(iso, delta) {
  const p = parseIso(iso);
  if (!p) return iso;
  const total = p.year * 12 + p.month + delta;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  return toIso(year, month, Math.min(p.day, daysInMonth(year, month)));
}

/** Clamp an ISO date into [min, max]. */
export function clampIso(iso, min, max) {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

/**
 * The weeks of one month as rows of 7 cells, Monday first. Cells outside the
 * month are `null` — the grid shows one month, not fragments of three.
 */
export function monthMatrix(year, month) {
  const first = new Date(year, month, 1).getDay(); // 0 = Sunday
  const lead = (first + 6) % 7; // Monday-first offset
  const total = daysInMonth(year, month);
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= total; d += 1) cells.push(toIso(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/*
 * ------------------------------------------------------------------ typing
 *
 * Every language this app ships writes dates day-month-year; only the
 * separator differs. A US-style month-first order is deliberately not offered:
 * a date of birth that silently swaps day and month is worse than one that
 * looks unfamiliar.
 */
const SEPARATOR = { de: ".", ru: ".", en: "/", fr: "/", it: "/", es: "/" };
const PLACEHOLDER = {
  de: "TT.MM.JJJJ",
  en: "DD/MM/YYYY",
  fr: "JJ/MM/AAAA",
  it: "GG/MM/AAAA",
  es: "DD/MM/AAAA",
  ru: "ДД.ММ.ГГГГ",
};

export function separatorFor(language) {
  return SEPARATOR[language] || SEPARATOR.de;
}

export function placeholderFor(language) {
  return PLACEHOLDER[language] || PLACEHOLDER.de;
}

/** ISO → what the field shows, e.g. "11.09.1999". Empty for no/invalid date. */
export function formatForInput(iso, language) {
  const p = parseIso(iso);
  if (!p) return "";
  const sep = separatorFor(language);
  return `${pad2(p.day)}${sep}${pad2(p.month + 1)}${sep}${p.year}`;
}

/**
 * Tidy what is being typed: digits only, separators inserted as the user goes,
 * at most DD MM YYYY. "11091999" becomes "11.09.1999"; "11/9" stays editable.
 * A typed separator after a single digit pads it ("1." → "01.").
 *
 * `deleting`: while the user is erasing, no separator is appended — otherwise
 * Backspace on "11." would put the dot straight back and never get past it.
 */
export function maskTyping(raw, language, { deleting = false } = {}) {
  const sep = separatorFor(language);
  const text = String(raw || "");
  const groups = [];
  let current = "";
  for (const ch of text) {
    if (/\d/.test(ch)) {
      current += ch;
      const limit = groups.length < 2 ? 2 : 4;
      if (current.length === limit && groups.length < 2) {
        groups.push(current);
        current = "";
      } else if (current.length > limit) {
        current = current.slice(0, limit);
      }
    } else if (/[./\-\s,]/.test(ch) && current.length === 1 && groups.length < 2) {
      groups.push(`0${current}`);
      current = "";
    }
  }
  const parts = [...groups];
  if (current) parts.push(current);
  let out = parts.join(sep);
  // Show the separator the moment a group completes, so the next digit lands
  // in the right place visually.
  if (!deleting && !current && groups.length > 0 && groups.length < 3) out += sep;
  return out.slice(0, 10);
}

/**
 * What the user typed → ISO, or null when it is not (yet) a real date.
 * Accepts ".", "/", "-" and spaces as separators, one- or two-digit day and
 * month, and only four-digit years (a two-digit year of birth is ambiguous).
 */
export function parseTyped(text) {
  const m = /^\s*(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{4})\s*$/.exec(String(text || ""));
  if (!m) return null;
  const iso = toIso(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return parseIso(iso) ? iso : null;
}
