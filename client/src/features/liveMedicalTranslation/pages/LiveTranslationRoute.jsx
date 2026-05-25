import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import LiveTranslationErrorBoundary from "../components/LiveTranslationErrorBoundary.jsx";
import LiveTranslationPage from "./LiveTranslationPage.jsx";

/** Route entry with error boundary — prevents blank white screen on render crashes. */
export default function LiveTranslationRoute() {
  const { language } = useLanguage();
  return (
    <LiveTranslationErrorBoundary uiLanguage={language}>
      <LiveTranslationPage />
    </LiveTranslationErrorBoundary>
  );
}
