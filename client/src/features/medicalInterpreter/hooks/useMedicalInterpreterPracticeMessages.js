import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import { getMessages } from "../../../i18n/translations/index.js";

export function useMedicalInterpreterPracticeMessages() {
  const { language } = useLanguage();
  return getMessages(language).medicalInterpreterPractice;
}
