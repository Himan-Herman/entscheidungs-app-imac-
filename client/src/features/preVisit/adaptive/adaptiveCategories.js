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
      pt: "Descreva brevemente os seus sintomas com as suas próprias palavras (de forma simples, sem termos técnicos).",
      ar: "صِف أعراضك باختصار بكلماتك أنت (بأسلوب بسيط ومن دون مصطلحات تقنية).",
      fa: "علائم خود را کوتاه و با واژه‌های خودتان توضیح دهید (ساده و بدون اصطلاح تخصصی).",
      ckb: "ئاڵامەکانت بە کورتی و بە وشەکانی خۆت وەسف بکە (بە سادەیی و بێ وشەی تەکنیکی).",
      ku: "Belîşanên xwe bi kurtî û bi gotinên xwe şirove bike (bi awayekî hêsan, bê termên teknîkî).",
      el: "Περιγράψτε σύντομα τα συμπτώματά σας με δικά σας λόγια (απλά, χωρίς τεχνικούς όρους).",
      ro: "Descrieți pe scurt simptomele în cuvintele dumneavoastră (simplu, fără termeni tehnici).",
      pl: "Krótko opisz swoje objawy własnymi słowami (prosto, bez specjalistycznych określeń).",
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
      pt: "Descreva o início e a evolução no tempo (quando começou, como mudou, padrão).",
      ar: "صِف البداية والتطور مع الوقت (متى بدأ، كيف تغيّر، وهل هناك نمط).",
      fa: "شروع و روند زمانی را توضیح دهید (چه زمانی شروع شد، چگونه تغییر کرد، آیا الگویی دارد).",
      ckb: "دەستپێکردن و ڕێڕەوی کاتی وەسف بکە (کەی دەستی پێکرد، چۆن گۆڕا، ئایا پاتێرنێکی هەیە).",
      ku: "Destpêk û pêşketina di demê de şirove bike (kengê dest pê kir, çawa guhert, gelo şêweyek heye).",
      el: "Περιγράψτε την έναρξη και την πορεία στον χρόνο (πότε άρχισε, πώς άλλαξε, αν υπάρχει κάποιο μοτίβο).",
      ro: "Descrieți debutul și evoluția în timp (când a început, cum s-a schimbat, model).",
      pl: "Opisz początek i przebieg w czasie (kiedy się zaczęło, jak się zmieniało, czy jest jakiś schemat).",
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
      pt: "Que medicamentos toma? (nome e frequência, se souber)",
      ar: "ما الأدوية التي تتناولها؟ (الاسم وعدد المرات، إذا كنت تعرف)",
      fa: "چه داروهایی مصرف می‌کنید؟ (نام و تعداد دفعات، اگر می‌دانید)",
      ckb: "چی دەرمانێک بەکاردەھێنیت؟ (ناو و چەندجاری بەکارهێنان، ئەگەر بزانیت)",
      ku: "Tu kîjan dermanan dixwî? (nav û çend caran — heke tu dizanî)",
      el: "Ποια φάρμακα λαμβάνετε; (όνομα και συχνότητα, αν το γνωρίζετε)",
      ro: "Ce medicamente luați? (nume și cât de des — dacă știți)",
      pl: "Jakie leki przyjmujesz? (nazwa i jak często — jeśli wiesz)",
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
      pt: "Indique doenças conhecidas apenas tal como as descreve pessoalmente.",
      ar: "اذكر الأمراض المعروفة فقط كما تصفها أنت بنفسك.",
      fa: "بیماری‌های شناخته‌شده را فقط همان‌طور که خودتان توصیف می‌کنید بنویسید.",
      ckb: "تەنیا ئەو نەخۆشییانە بنووسە کە خۆت بە شێوەی خۆت وەسفیان دەکەیت.",
      ku: "Tenê wan nexweşiyên naskirî binivîse wekî ku tu bi xwe rave dikî.",
      el: "Αναφέρετε γνωστές παθήσεις μόνο όπως τις περιγράφετε εσείς οι ίδιοι.",
      ro: "Enumerați afecțiunile cunoscute doar așa cum le descrieți dumneavoastră.",
      pl: "Wypisz znane choroby tylko tak, jak sam je opisujesz.",
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
      pt: "Que perguntas quer esclarecer durante a consulta?",
      ar: "ما الأسئلة التي تريد توضيحها أثناء الموعد؟",
      fa: "چه پرسش‌هایی را می‌خواهید در ویزیت روشن کنید؟",
      ckb: "کام پرسیارانت دەتەوێت لە چاوپێکەوتندا ڕوونیان بکەیتەوە؟",
      ku: "Tu dixwazî di serdanê de kîjan pirsan zelal bikî?",
      el: "Ποιες ερωτήσεις θέλετε να διευκρινίσετε κατά την επίσκεψη;",
      ro: "Ce întrebări doriți să clarificați în cadrul vizitei?",
      pl: "Jakie pytania chcesz wyjaśnić podczas wizyty?",
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
