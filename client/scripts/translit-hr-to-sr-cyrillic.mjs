/**
 * Convert Croatian Latin legal / UI strings to Serbian Cyrillic.
 * - Skips ASCII-only slugs, paths, type keys, emails, URLs.
 * - Preserves HTML tags and attributes inside template literals; transliterates text nodes only.
 * - Keeps brand "MedScoutX" in Latin.
 */
import fs from "node:fs";
import path from "node:path";

const DIGRAPHS = [
  ["Lj", "Љ"],
  ["Nj", "Њ"],
  ["Dž", "Џ"],
  ["lj", "љ"],
  ["nj", "њ"],
  ["dž", "џ"],
];

const SINGLE = {
  a: "а",
  b: "б",
  c: "ц",
  č: "ч",
  ć: "ћ",
  d: "д",
  đ: "ђ",
  e: "е",
  f: "ф",
  g: "г",
  h: "х",
  i: "и",
  j: "ј",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  r: "р",
  s: "с",
  š: "ш",
  t: "т",
  u: "у",
  v: "в",
  z: "з",
  ž: "ж",
  A: "А",
  B: "Б",
  C: "Ц",
  Č: "Ч",
  Ć: "Ћ",
  D: "Д",
  Đ: "Ђ",
  E: "Е",
  F: "Ф",
  G: "Г",
  H: "Х",
  I: "И",
  J: "Ј",
  K: "К",
  L: "Л",
  M: "М",
  N: "Н",
  O: "О",
  P: "П",
  R: "Р",
  S: "С",
  Š: "Ш",
  T: "Т",
  U: "У",
  V: "В",
  Z: "З",
  Ž: "Ж",
};

const BRAND_CHAR = "\uE140";

function protectBrand(s) {
  return s.replace(/MedScoutX/g, BRAND_CHAR);
}

function restoreBrand(s) {
  return s.replace(new RegExp(BRAND_CHAR, "g"), "MedScoutX");
}

function transliterateWordForms(text) {
  return (
    text
      .replace(/Лијечник/g, "Лекар")
      .replace(/лијечник/g, "лекар")
      .replace(/лијечника/g, "лекара")
      .replace(/лијечнику/g, "лекару")
      .replace(/лијечником/g, "лекаром")
      .replace(/лијечницима/g, "лекарима")
      .replace(/лијечницу/g, "лекару")
      .replace(/Лијечницима/g, "Лекарима")
      .replace(/лијекови/g, "лекови")
      .replace(/лијекова/g, "лекова")
      .replace(/лијекове/g, "лекове")
      .replace(/лијеком/g, "леком")
      .replace(/лијек/g, "лек")
      .replace(/лијечење/g, "лечење")
      .replace(/лијечења/g, "лечења")
      .replace(/лијечењу/g, "лечењу")
      .replace(/лијечењем/g, "лечењем")
      .replace(/Нјемачка/g, "Немачка")
      .replace(/нјемачког/g, "немачког")
      .replace(/нјемачком/g, "немачком")
  );
}

function transliterateSegment(raw) {
  const branded = protectBrand(raw);
  let out = "";
  let i = 0;
  while (i < branded.length) {
    let matched = false;
    for (const [lat, cyr] of DIGRAPHS) {
      if (branded.startsWith(lat, i)) {
        out += cyr;
        i += lat.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const ch = branded[i];
    out += SINGLE[ch] ?? ch;
    i += 1;
  }
  return restoreBrand(transliterateWordForms(out));
}

function shouldTranslitPlainString(s) {
  const t = s.trim();
  if (!t) return false;
  if (/^[A-Z][a-z]+ [A-Z][a-z'-]+$/.test(t)) return false;
  if (/^(html|p|richContact|ul|li)$/i.test(t)) return false;
  if (/^(true|false|null)$/i.test(t)) return false;
  if (/^[a-z0-9_-]+$/.test(t) && !/[čćđšžČĆĐŠŽ]/.test(t)) return false;
  if (/\.(js|mjs|css|png|jpe?g|webp|svg)(\?|$)/i.test(t)) return false;
  if (/^(mailto:|tel:|https?:)/i.test(t)) return false;
  if (/^\/[a-z0-9/_-]*$/i.test(t)) return false;
  if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(t)) return false;
  if (/^\+?[\d\s().-]+$/.test(t)) return false;
  if (!/[čćđšžČĆĐŠŽ]/.test(t) && !t.includes(" ") && t.length <= 14) return false;

  if (/[čćđšžČĆĐŠŽ]/.test(t)) return true;
  if (t.includes(" ") && /[a-z]/i.test(t) && t.length > 6) return true;
  if (t.length > 48) return true;
  return false;
}

function transliterateHtmlTemplate(html) {
  const parts = html.split(/(<[^>]*>)/g);
  return parts
    .map((part) => {
      if (part.startsWith("<")) return part;
      if (/^\s*$/.test(part)) return part;
      const trimmed = part.trim();
      if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
        return part;
      }
      return transliterateSegment(part);
    })
    .join("");
}

function transformJs(source) {
  let out = "";
  let i = 0;
  const n = source.length;

  while (i < n) {
    const ch = source[i];

    if (ch === "/" && source[i + 1] === "/") {
      let j = i + 2;
      while (j < n && source[j] !== "\n") j += 1;
      const line = source.slice(i, j);
      out +=
        /[čćđšžČĆĐŠŽ]/.test(line) ? transliterateSegment(line) : line;
      i = j;
      continue;
    }

    if (ch === "/" && source[i + 1] === "*") {
      let j = i + 2;
      while (j + 1 < n && !(source[j] === "*" && source[j + 1] === "/")) j += 1;
      j = Math.min(j + 2, n);
      const block = source.slice(i, j);
      out +=
        /[čćđšžČĆĐŠŽ]/.test(block) ? transliterateSegment(block) : block;
      i = j;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      let seg = '"';
      while (j < n) {
        const c = source[j];
        seg += c;
        if (c === "\\" && j + 1 < n) {
          seg += source[j + 1];
          j += 2;
          continue;
        }
        if (c === '"') {
          j += 1;
          break;
        }
        j += 1;
      }
      const inner = seg.slice(1, -1);
      if (!inner.includes("\\") && shouldTranslitPlainString(inner)) {
        out += '"' + transliterateSegment(inner) + '"';
      } else {
        out += seg;
      }
      i = j;
      continue;
    }

    if (ch === "'") {
      let j = i + 1;
      let seg = "'";
      while (j < n) {
        const c = source[j];
        seg += c;
        if (c === "\\" && j + 1 < n) {
          seg += source[j + 1];
          j += 2;
          continue;
        }
        if (c === "'") {
          j += 1;
          break;
        }
        j += 1;
      }
      const inner = seg.slice(1, -1);
      if (!inner.includes("\\") && shouldTranslitPlainString(inner)) {
        out += "'" + transliterateSegment(inner) + "'";
      } else {
        out += seg;
      }
      i = j;
      continue;
    }

    if (ch === "`") {
      let j = i + 1;
      let inner = "";
      while (j < n) {
        const c = source[j];
        if (c === "\\" && j + 1 < n) {
          inner += c + source[j + 1];
          j += 2;
          continue;
        }
        if (c === "`") {
          j += 1;
          break;
        }
        inner += c;
        j += 1;
      }
      out += "`" + transliterateHtmlTemplate(inner) + "`";
      i = j;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("Usage: node translit-hr-to-sr-cyrillic.mjs <file.js> ...");
  process.exit(1);
}

for (const file of targets) {
  const abs = path.resolve(file);
  const src = fs.readFileSync(abs, "utf8");
  fs.writeFileSync(abs, transformJs(src), "utf8");
}
