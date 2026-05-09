import { useMemo } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getMessages } from "../../i18n/translations/index.js";
import "./LegalTranslationBanner.css";

export default function LegalTranslationBanner() {
  const { language } = useLanguage();
  const text = useMemo(() => getMessages(language).common?.legalTranslationNotice, [language]);

  if (!text) return null;

  return (
    <p className="ms-legal-ui-notice" role="note">
      {text}
    </p>
  );
}
