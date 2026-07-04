export const ADAPTIVE_CATEGORIES = {
  symptomsOwnWords: {
    key: "symptomsOwnWords",
    maxFollowups: 4,
    seedPrompts: {
      de: "Beschreiben Sie kurz Ihre Beschwerden mit eigenen Worten (neutral, ohne Fachbegriffe).",
      en: "Briefly describe how you feel in your own words (plain language, no jargon).",
      fr: "Décrivez brièvement vos symptômes avec vos propres mots (simplement, sans jargon).",
      es: "Describa brevemente sus síntomas con sus propias palabras (de forma sencilla y sin tecnicismos).",
      it: "Descrivi brevemente i tuoi sintomi con parole tue (in modo semplice, senza termini tecnici).",
      tr: "Semptomlarınızı kendi sözlerinizle kısaca anlatın (basit şekilde, teknik terim kullanmadan).",
      ru: "Кратко опишите свои симптомы своими словами (просто, без специальных терминов).",
      uk: "Коротко опишіть свої симптоми своїми словами (просто, без спеціальних термінів).",
    },
    allowedFollowupTypes: ["clarification", "missing_information", "patient_confirmation"],
    completionRule:
      "Complete when description is understandable without adding medical interpretation.",
  },
  onsetAndCourse: {
    key: "onsetAndCourse",
    maxFollowups: 3,
    seedPrompts: {
      de: "Beschreiben Sie Beginn und Verlauf zeitlich (wann, wie entwickelt, Muster).",
      en: "Describe onset and course over time (when, how it changed, pattern).",
      fr: "Décrivez le début et l'évolution dans le temps (quand, comment cela a évolué, schéma).",
      es: "Describa el inicio y la evolución en el tiempo (cuándo empezó, cómo cambió, patrón).",
      it: "Descrivi l'inizio e l'andamento nel tempo (quando, come è cambiato, eventuali schemi).",
      tr: "Başlangıcı ve zaman içindeki seyri anlatın (ne zaman başladı, nasıl değişti, bir düzen var mı).",
      ru: "Опишите начало и течение во времени (когда началось, как менялось, есть ли повторяющийся характер).",
      uk: "Опишіть початок і перебіг у часі (коли почалося, як змінювалося, чи є певна повторюваність).",
    },
    allowedFollowupTypes: ["timing", "pattern", "clarification"],
    completionRule:
      "Complete when timeline and course are sufficiently clear in patient wording.",
  },
  medications: {
    key: "medications",
    maxFollowups: 3,
    seedPrompts: {
      de: "Welche Medikamente nehmen Sie ein? (Name, wie oft — wenn Sie es wissen)",
      en: "Which medicines do you take? (name and how often — if you know)",
      fr: "Quels médicaments prenez-vous ? (nom et fréquence, si vous les connaissez)",
      es: "¿Qué medicamentos toma? (nombre y frecuencia, si lo sabe)",
      it: "Quali farmaci assumi? (nome e frequenza, se li conosci)",
      tr: "Hangi ilaçları kullanıyorsunuz? (ad ve ne sıklıkla kullandığınız — biliyorsanız)",
      ru: "Какие лекарства вы принимаете? (название и как часто — если знаете)",
      uk: "Які ліки ви приймаєте? (назва і як часто — якщо знаєте)",
    },
    allowedFollowupTypes: ["missing_information", "clarification", "patient_confirmation"],
    completionRule:
      "Complete when medication info is clear enough for documentation.",
  },
  preExistingConditions: {
    key: "preExistingConditions",
    maxFollowups: 2,
    seedPrompts: {
      de: "Nennen Sie bekannte Vorerkrankungen nur nach Ihren eigenen Angaben.",
      en: "List known pre-existing conditions only as you personally report them.",
      fr: "Indiquez les antécédents connus uniquement tels que vous les décrivez vous-même.",
      es: "Indique las enfermedades previas conocidas solo según su propia descripción.",
      it: "Indica le patologie pregresse note solo come le descrivi tu.",
      tr: "Bilinen hastalık geçmişinizi yalnızca sizin anlattığınız şekilde yazın.",
      ru: "Укажите известные заболевания только так, как вы сами их описываете.",
      uk: "Вкажіть відомі захворювання лише так, як ви самі їх описуєте.",
    },
    allowedFollowupTypes: ["clarification", "missing_information"],
    completionRule:
      "Complete when known background conditions are understandable in plain language.",
  },
  patientQuestions: {
    key: "patientQuestions",
    maxFollowups: 2,
    seedPrompts: {
      de: "Welche Fragen möchten Sie im Termin klären?",
      en: "What questions do you want to clarify during the appointment?",
      fr: "Quelles questions souhaitez-vous clarifier pendant le rendez-vous ?",
      es: "¿Qué preguntas quiere aclarar durante la cita?",
      it: "Quali domande vuoi chiarire durante l'appuntamento?",
      tr: "Randevu sırasında hangi soruları netleştirmek istiyorsunuz?",
      ru: "Какие вопросы вы хотите прояснить во время приёма?",
      uk: "Які запитання ви хочете уточнити під час прийому?",
    },
    allowedFollowupTypes: ["clarification", "missing_information"],
    completionRule:
      "Complete when patient priorities/questions are clear and concise.",
  },
};

export const ADAPTIVE_CATEGORY_KEYS = new Set(Object.keys(ADAPTIVE_CATEGORIES));

export function isAdaptiveCategoryKey(categoryKey) {
  return ADAPTIVE_CATEGORY_KEYS.has(categoryKey);
}

export function getAdaptiveCategoryConfig(categoryKey) {
  return ADAPTIVE_CATEGORIES[categoryKey] || null;
}

export function getAdaptiveSeedPrompt(categoryKey, language, fallbackText = "") {
  const cfg = getAdaptiveCategoryConfig(categoryKey);
  if (!cfg) return fallbackText;
  const code = String(language || "").split("-")[0].toLowerCase();
  return (
    cfg.seedPrompts?.[code] ||
    cfg.seedPrompts?.en ||
    cfg.seedPrompts?.de ||
    fallbackText
  );
}
