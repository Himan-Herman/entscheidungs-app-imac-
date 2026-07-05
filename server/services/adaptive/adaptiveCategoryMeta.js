/**
 * Short category hints for adaptive intake (documentation-oriented, non-diagnostic).
 * Keep in sync with client adaptiveCategories.js intent (not UI copy).
 */

export const CATEGORY_MICRO_RULES = {
  symptomsOwnWords:
    "Focus: plain patient wording. Start with at most one broad clarifier if the complaint is still very vague; then switch to one symptom-specific clarification tied to the patient's own words. Stop when the complaint is understandable without adding interpretation.",
  onsetAndCourse:
    "Focus: timing and change since start (when, sudden/gradual). Start broadly only if the timeline is still unclear; then ask one course-specific question based on the patient's described pattern. Stop when timeline is clear enough.",
  medications:
    "Focus: names/doses/frequency as patient knows them. Ask only documentation-focused clarifiers that fit the medicines already mentioned. Stop when list is usable for documentation.",
  preExistingConditions:
    "Focus: prior conditions as reported by patient. Clarify only missing plain-language background details already hinted at by the patient. Stop when background is clear in everyday words.",
  patientQuestions:
    "Focus: questions/priorities for the visit. After one broad priority check at most, ask only a question that fits the patient's stated concerns and visit goals. Stop when priorities are clear and concise.",
};

const CATEGORY_TURN_STRATEGIES = {
  symptomsOwnWords: {
    genericIntroTurns: 1,
    opening:
      "If the complaint is still broad, ask one universal clarification such as what is felt most strongly, where it is noticed, or what is most limiting.",
    targeted:
      "Once the patient has named a concrete symptom, body area, visible change, trigger, or limiting situation, anchor the next question to exactly that content instead of using a stock generic question. Good neutral targets are: exact body area, sensation quality, visible change, trigger, spread, frequency, or functional limitation.",
    always:
      "Do not name a disease, cause, or diagnosis. Stay in careful assistant-style documentation mode only.",
  },
  onsetAndCourse: {
    genericIntroTurns: 1,
    opening:
      "If timing is still missing, ask one broad question about when it started or whether it came suddenly or gradually.",
    targeted:
      "After that, tie the next question to the reported course: duration of episodes, recurrence pattern, time of day, relation to meals, movement, rest, or a specific change over time. Ask only the single most relevant missing detail.",
    always:
      "Do not interpret the course medically. Only clarify timeline and change in the patient's own wording.",
  },
  medications: {
    genericIntroTurns: 0,
    opening:
      "No generic opener is needed beyond the seed question.",
    targeted:
      "Ask only about the medicines already named or clearly implied by the patient, for example missing name, dose, frequency, or whether something is taken only when needed.",
    always:
      "Do not suggest medicines, changes, or recommendations.",
  },
  preExistingConditions: {
    genericIntroTurns: 0,
    opening:
      "No generic opener is needed beyond the seed question.",
    targeted:
      "If the patient already mentioned a background condition or diagnosis in plain words, clarify only one missing neutral documentation detail related to that background. If no concrete background condition is mentioned, prefer completion over generic fishing questions.",
    always:
      "Do not infer new conditions and do not translate patient wording into medical claims.",
  },
  patientQuestions: {
    genericIntroTurns: 0,
    opening:
      "No generic opener is needed beyond the seed question.",
    targeted:
      "Ask only a follow-up that fits the patient's stated worries, visit reason, symptoms, or priorities. Good neutral targets are: what they want explained first, what decision they want clarified, or which daily limitation matters most to discuss.",
    always:
      "Do not suggest what the patient should ask because of a suspected disease. Only help document their own priorities.",
  },
};

export function getAdaptiveTurnStrategy(categoryKey, followupCount = 0) {
  const meta = CATEGORY_TURN_STRATEGIES[categoryKey];
  const count = Math.max(0, Number(followupCount) || 0);
  if (!meta) {
    return {
      stage: "targeted",
      genericIntroTurns: 0,
      strategy:
        "Ask one neutral documentation question that fits what the patient already said. Do not use repetitive stock questions.",
    };
  }
  const stage = count < meta.genericIntroTurns ? "opening" : "targeted";
  const stageRule = stage === "opening" ? meta.opening : meta.targeted;
  return {
    stage,
    genericIntroTurns: meta.genericIntroTurns,
    strategy: `${stageRule} ${meta.always}`,
  };
}
