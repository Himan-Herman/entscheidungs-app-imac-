/**
 * Adaptive Pre-Visit intake: prompt rules, multilingual notes, output hygiene patterns.
 * No diagnosis / triage / treatment — documentation + neutral clarification only.
 */

/** Compact system prompt — detailed rules live in user payload `instr` to save repetition tokens. */
export const ADAPTIVE_SYSTEM_PROMPT = `You are a pre-visit documentation assistant.
Hard bans: diagnosis, disease naming as fact, urgency/triage, treatment or medication advice, specialist referral suggestions, alarmist tone, inferred medical conclusions.
Style: one short question OR completion; calm; everyday words; no robotic phrasing; do not echo the patient's wording verbatim unless needed for clarity.
Output: JSON only as instructed in the user message.`;

export const ADAPTIVE_INSTR_BLOCK = `Return JSON:
{"nextQuestion":"","isComplete":false,"compiledAnswer":"","safetyFlags":[]}

Rules:
- ONE short question only in nextQuestion; empty if isComplete.
- nextQuestion and compiledAnswer MUST match patientLanguage (payload.lng).
- Do NOT repeat or paraphrase the same ask as in payload.askedBefore; do NOT ask what is already answered in existing, current, or prevReplies.
- ONE information gap per turn; no bullet lists of asks; no "please elaborate regarding…" filler.
- Prefer isComplete=true as soon as payload.catRule is satisfied — fewer follow-ups is better than perfection.
- compiledAnswer: compact neutral documentation (short paragraphs/bullets OK); patient-stated facts only; mark gaps as "nicht angegeben"/"not stated"/"unclear"/"unklar" — never infer clinically.
- safetyFlags subset only: missing_information, unclear_statement, category_complete, needs_patient_confirmation
- Forbidden style: diagnostic guessing, urgency, alarm, treatment, referrals (see payload.forbiddenPatterns).`;

export const MULTILINGUAL_STYLE_NOTE = `If patientLanguage is ar, fa, ckb, tr, ru, fr, es (or regional variants): use simple everyday vocabulary; avoid stiff formal "machine translation" tone; stay neutral and calm.`;

/** Patterns applied to model OUTPUT (nextQuestion + compiledAnswer). Flags retry / fallback — no PHI logged. */
export const OUTPUT_VIOLATION_PATTERNS = [
  /\bDIAGNOSE\b/i,
  /\bdiagnosis\b/i,
  /\burgent(ly)?\b/i,
  /\bimmediately\b/i,
  /\bsofort (?:zu )?(?:einem )?(?:Arzt|Ärztin)/i,
  /\bNotfall\b/i,
  /\byou should see (a )?(?:doctor|specialist|cardiologist|neurologist)/i,
  /\bsee (a )?(cardiologist|neurologist|specialist)\b/i,
  /\bbei (einem )?(Kardiologen|Neurologen|Facharzt)/i,
  /\bmay indicate\b/i,
  /\bcould indicate\b/i,
  /\bthis sounds like\b/i,
  /\bDas (klingt|deutet) (nach|auf)\b/i,
  /\bpossibly (a |an )?\w+ (disorder|disease|syndrome)\b/i,
];

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
  tr: "Başka bir şey eklemek ister misiniz?",
  ru: "Хотите что-то добавить?",
  ar: "هل تريد إضافة أي شيء آخر؟",
  fa: "می‌خواهید چیز دیگری اضافه کنید؟",
  ckb: "دەتەوێت شتێکی تر زیاد بکەیت؟",
};

export function fallbackQuestionForLanguage(code) {
  const c = String(code || "de").trim().split(/[-_]/)[0].toLowerCase();
  return FALLBACK_QUESTION[c] || FALLBACK_QUESTION.en;
}

export const STRICT_RETRY_SUFFIX =
  "\n\nSTRICT: If your previous answer violated neutrality, fix it. No diagnostic or urgency wording. If you cannot comply, set isComplete=true and compiledAnswer to a concise factual summary of patient words only; nextQuestion empty.";
