/**
 * Deterministic pre-visit intake steps (frontend-only MVP).
 * Title/explanation: keyed by locale for the patient-facing intake flow.
 */

export const PRE_VISIT_SESSION_KEY = "medscoutx_previsit_session";

/** Keys aligned with the agreed payload shape for PDF/API later */
export const PRE_VISIT_QUESTION_STEPS = [
  {
    key: "appointmentReason",
    title: {
      de: "Aktueller Anlass des Termins",
      en: "Reason for this appointment",
      fr: "Motif actuel du rendez-vous",
      es: "Motivo actual de la cita",
      it: "Motivo attuale dell'appuntamento",
      tr: "Bu randevunun güncel nedeni",
      ru: "Текущая причина этого визита",
      uk: "Поточна причина цього візиту",
    },
    explanation: {
      de: "Worum geht es bei diesem Besuch? Kurz in eigenen Worten.",
      en: "What is this visit about? Briefly, in your own words.",
      fr: "De quoi s'agit-il pour cette consultation ? Décrivez-le brièvement avec vos propres mots.",
      es: "¿De qué trata esta consulta? Descríbalo brevemente con sus propias palabras.",
      it: "Di cosa si tratta in questa visita? Descrivilo brevemente con parole tue.",
      tr: "Bu muayene neyle ilgili? Kendi sözlerinizle kısaca anlatın.",
      ru: "С чем связан этот визит? Кратко опишите своими словами.",
      uk: "З чим пов’язаний цей візит? Коротко опишіть своїми словами.",
    },
  },
  {
    key: "symptomsOwnWords",
    title: {
      de: "Symptome in Ihren eigenen Worten",
      en: "Symptoms in your own words",
      fr: "Symptômes avec vos propres mots",
      es: "Síntomas con sus propias palabras",
      it: "Sintomi con parole tue",
      tr: "Semptomlar kendi sözlerinizle",
      ru: "Симптомы своими словами",
      uk: "Симптоми своїми словами",
    },
    explanation: {
      de: "Was nehmen Sie wahr (z. B. Schmerz, Druck, Einschränkung)?",
      en: "What do you notice (e.g. pain, pressure, limitation)?",
      fr: "Que ressentez-vous ou qu'observez-vous (par ex. douleur, pression, limitation) ?",
      es: "¿Qué nota o percibe (p. ej. dolor, presión, limitación)?",
      it: "Che cosa noti o percepisci (ad es. dolore, pressione, limitazione)?",
      tr: "Ne fark ediyor veya hissediyorsunuz (ör. ağrı, baskı, kısıtlılık)?",
      ru: "Что вы замечаете или ощущаете (например, боль, давление, ограничение)?",
      uk: "Що ви помічаєте або відчуваєте (наприклад, біль, тиск, обмеження)?",
    },
  },
  {
    key: "onsetAndCourse",
    title: {
      de: "Beginn und Verlauf",
      en: "Onset and course over time",
      fr: "Début et évolution",
      es: "Inicio y evolución",
      it: "Inizio e decorso",
      tr: "Başlangıç ve zaman içindeki seyir",
      ru: "Начало и развитие во времени",
      uk: "Початок і розвиток у часі",
    },
    explanation: {
      de: "Seit wann bestehen die Beschwerden? Wie haben sie sich entwickelt?",
      en: "When did symptoms start? How have they changed since then?",
      fr: "Depuis quand les symptômes existent-ils ? Comment ont-ils évolué depuis ?",
      es: "¿Desde cuándo existen los síntomas? ¿Cómo han cambiado desde entonces?",
      it: "Da quando sono presenti i sintomi? Come sono cambiati nel tempo?",
      tr: "Semptomlar ne zamandan beri var? O zamandan beri nasıl değişti?",
      ru: "С какого времени есть симптомы? Как они изменялись с тех пор?",
      uk: "Відколи є симптоми? Як вони змінювалися відтоді?",
    },
  },
  {
    key: "medications",
    title: {
      de: "Aktuelle Medikamente",
      en: "Current medications",
      fr: "Médicaments actuels",
      es: "Medicamentos actuales",
      it: "Farmaci attuali",
      tr: "Güncel ilaçlar",
      ru: "Текущие лекарства",
      uk: "Поточні ліки",
    },
    explanation: {
      de: "Welche Medikamente nehmen Sie ein (Name, Dosis, wie oft)?",
      en: "Which medicines do you take (name, dose, how often)?",
      fr: "Quels médicaments prenez-vous (nom, dose, fréquence) ?",
      es: "¿Qué medicamentos toma (nombre, dosis, frecuencia)?",
      it: "Quali farmaci assumi (nome, dose, frequenza)?",
      tr: "Hangi ilaçları kullanıyorsunuz (ad, doz, sıklık)?",
      ru: "Какие лекарства вы принимаете (название, дозировка, как часто)?",
      uk: "Які ліки ви приймаєте (назва, дозування, як часто)?",
    },
  },
  {
    key: "preExistingConditions",
    title: {
      de: "Bekannte Vorerkrankungen",
      en: "Known pre-existing conditions",
      fr: "Antécédents connus",
      es: "Enfermedades previas conocidas",
      it: "Patologie pregresse note",
      tr: "Bilinen hastalık geçmişi",
      ru: "Известные хронические заболевания",
      uk: "Відомі хронічні захворювання",
    },
    explanation: {
      de: "Welche Diagnosen oder chronischen Erkrankungen sind bekannt?",
      en: "Which diagnoses or chronic conditions are known?",
      fr: "Quels diagnostics ou problèmes chroniques sont déjà connus ?",
      es: "¿Qué diagnósticos o enfermedades crónicas son conocidos?",
      it: "Quali diagnosi o condizioni croniche sono note?",
      tr: "Hangi tanılar veya kronik hastalıklar biliniyor?",
      ru: "Какие диагнозы или хронические заболевания вам известны?",
      uk: "Які діагнози або хронічні захворювання вам відомі?",
    },
  },
  {
    key: "relevantDocuments",
    title: {
      de: "Relevante Unterlagen",
      en: "Relevant documents",
      fr: "Documents pertinents",
      es: "Documentos relevantes",
      it: "Documenti rilevanti",
      tr: "İlgili belgeler",
      ru: "Важные документы",
      uk: "Важливі документи",
    },
    explanation: {
      de: "Welche Befunde oder Unterlagen möchten Sie erwähnen (z. B. Labor, Vor-Befunde)?",
      en: "Which results or documents should be mentioned (e.g. labs, prior reports)?",
      fr: "Quels résultats ou documents souhaitez-vous mentionner (par ex. analyses, comptes rendus antérieurs) ?",
      es: "¿Qué resultados o documentos quiere mencionar (p. ej. análisis, informes previos)?",
      it: "Quali referti o documenti vuoi indicare (ad es. esami di laboratorio o referti precedenti)?",
      tr: "Hangi sonuçları veya belgeleri belirtmek istersiniz (ör. laboratuvar, önceki raporlar)?",
      ru: "Какие результаты или документы вы хотите указать (например, анализы, предыдущие заключения)?",
      uk: "Які результати або документи ви хочете зазначити (наприклад, аналізи, попередні висновки)?",
    },
  },
  {
    key: "patientQuestions",
    title: {
      de: "Fragen an die Ärztin / den Arzt",
      en: "Questions you want to ask",
      fr: "Questions que vous souhaitez poser",
      es: "Preguntas que quiere hacer",
      it: "Domande che vuoi porre",
      tr: "Sormak istediğiniz sorular",
      ru: "Вопросы, которые вы хотите задать",
      uk: "Запитання, які ви хочете поставити",
    },
    explanation: {
      de: "Was möchten Sie im Gespräch unbedingt klären?",
      en: "What do you want to clarify during the consultation?",
      fr: "Que souhaitez-vous absolument clarifier pendant la consultation ?",
      es: "¿Qué quiere aclarar sí o sí durante la consulta?",
      it: "Che cosa vuoi chiarire assolutamente durante la visita?",
      tr: "Görüşmede özellikle neyi netleştirmek istiyorsunuz?",
      ru: "Что вы обязательно хотите уточнить во время консультации?",
      uk: "Що ви обов’язково хочете уточнити під час консультації?",
    },
  },
];

export function createEmptyAnswers() {
  return {
    appointmentReason: "",
    symptomsOwnWords: "",
    onsetAndCourse: "",
    medications: "",
    preExistingConditions: "",
    relevantDocuments: "",
    patientQuestions: "",
  };
}

/** Pick localized string; fallback exact → en → de → first available */
export function pickLocalized(record, lang) {
  if (!record || typeof record !== "object") return "";
  const code = String(lang || "").split("-")[0].toLowerCase();
  if (record[code]) return record[code];
  if (code !== "de" && record.en) return record.en;
  if (record.de) return record.de;
  if (record.en) return record.en;
  const first = Object.values(record).find(Boolean);
  return first ?? "";
}
