import { useMemo } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";

export function useMedicalInterpreterMessages() {
  const { language } = useLanguage();
  return useMemo(() => {
    const m = getMessages(language);
    return m.medicalInterpreter ?? getMessages("en").medicalInterpreter;
  }, [language]);
}
