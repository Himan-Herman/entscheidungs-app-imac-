/**
 * Adaptive Pre-Visit intake: prompt rules, multilingual notes, output hygiene patterns.
 * No diagnosis / triage / treatment — documentation + neutral clarification only.
 */

import {
  AI_MODULES,
  ALLOWED_COMMUNICATION_STYLE,
  getOutputSafetyPatterns,
} from "../../config/aiSafetyPolicy.js";

/** Compact system prompt — detailed rules live in user payload `instr` to save repetition tokens. */
export const ADAPTIVE_SYSTEM_PROMPT = `You are a pre-visit documentation assistant.
Hard bans: diagnosis, disease naming as fact, urgency/triage, treatment or medication advice, specialist referral suggestions, alarmist tone, inferred medical conclusions.
Style: one short question OR completion; calm; everyday words; no robotic phrasing; do not echo the patient's wording verbatim unless needed for clarity.
Output: JSON only as instructed in the user message.

Shared safety baseline:
${ALLOWED_COMMUNICATION_STYLE}`;

export const ADAPTIVE_INSTR_BLOCK = `Return JSON:
{"nextQuestion":"","isComplete":false,"compiledAnswer":"","safetyFlags":[]}

Rules:
- ONE short question only in nextQuestion; empty if isComplete.
- nextQuestion and compiledAnswer MUST match patientLanguage (payload.lng).
- Do NOT repeat or paraphrase the same ask as in payload.askedBefore; do NOT ask what is already answered in existing, current, or prevReplies.
- Keep the overall number/order of intake sections stable, but adapt the actual follow-up content to what this patient already described.
- payload.stage tells you whether one broad universal clarification is still acceptable ("opening") or whether you MUST switch to a patient-specific follow-up ("targeted").
- If payload.stage is "targeted", do NOT ask another stock generic question. The question MUST connect to the patient's actual words in payload.current, payload.existing, payload.prevReplies, or payload.otherCats.
- Use payload.qPlan as the category-specific question strategy. Ask about only ONE missing aspect that best fits this patient's symptom wording, course, medication wording, background wording, or visit priority.
- After the early opening turn(s), different symptoms and different patients should naturally lead to different follow-up questions.
- ONE information gap per turn; no bullet lists of asks; no "please elaborate regarding…" filler.
- Prefer isComplete=true as soon as payload.catRule is satisfied — fewer follow-ups is better than perfection.
- compiledAnswer: compact neutral documentation (short paragraphs/bullets OK); patient-stated facts only; mark gaps as "nicht angegeben"/"not stated"/"unclear"/"unklar" — never infer clinically.
- safetyFlags subset only: missing_information, unclear_statement, category_complete, needs_patient_confirmation
- Sound like a careful medical assistant preparing documentation, never like a doctor. Ask questions only; do not explain, interpret, reassure, or warn.
- Forbidden style: diagnostic guessing, urgency, alarm, treatment, referrals (see payload.forbiddenPatterns).`;

export const MULTILINGUAL_STYLE_NOTE = `For every supported patientLanguage (including de, en, fr, es, it, tr, ru, uk, pt, ar, fa, ckb, ku, el, ro, pl and regional variants): use simple everyday vocabulary; avoid stiff machine-translated wording; stay neutral, calm, and natural in that language.`;

/** Patterns applied to model OUTPUT (nextQuestion + compiledAnswer). Flags retry / fallback — no PHI logged. */
export const OUTPUT_VIOLATION_PATTERNS =
  getOutputSafetyPatterns(AI_MODULES.PREVISIT_ADAPTIVE);

export function listViolationPatternsSummary() {
  return [
    "no_diagnosis_or_disease_labels_as_facts",
    "no_urgency_or_emergency_directives",
    "no_referral_or_specialist_instructions",
    "no_this_sounds_like_or_may_indicate",
  ];
}

const FALLBACK_QUESTION = {
  de: "Möchten Sie dazu noch etwas ergänzen?",
  en: "Would you like to add anything else?",
  fr: "Souhaitez-vous préciser quelque chose ?",
  es: "¿Quiere añadir algo más?",
  it: "Vuole aggiungere ancora qualcosa?",
  tr: "Başka bir şey eklemek ister misiniz?",
  ru: "Хотите что-то добавить?",
  uk: "Хочете щось додати?",
  pt: "Gostaria de acrescentar mais alguma coisa?",
  ar: "هل تريد إضافة أي شيء آخر؟",
  fa: "می‌خواهید چیز دیگری اضافه کنید؟",
  ckb: "دەتەوێت شتێکی تر زیاد بکەیت؟",
  ku: "Tu dixwazî tiştekî din zêde bikî?",
  el: "Θέλετε να προσθέσετε κάτι ακόμη;",
  ro: "Doriți să mai adăugați ceva?",
  pl: "Czy chcesz coś jeszcze dodać?",
};

export function fallbackQuestionForLanguage(code) {
  const c = String(code || "de").trim().split(/[-_]/)[0].toLowerCase();
  return FALLBACK_QUESTION[c] || FALLBACK_QUESTION.en;
}

export const STRICT_RETRY_SUFFIX =
  "\n\nSTRICT: If your previous answer violated neutrality, fix it. No diagnostic or urgency wording. If you cannot comply, set isComplete=true and compiledAnswer to a concise factual summary of patient words only; nextQuestion empty.";
