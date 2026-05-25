import { Navigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import LiveTranslationErrorBoundary from "../components/LiveTranslationErrorBoundary.jsx";
import { isLiveMedicalTranslationEnabled } from "../featureFlag.js";
import LiveTranslationPage from "./LiveTranslationPage.jsx";

/** Route entry with error boundary — prevents blank white screen on render crashes. */
export default function LiveTranslationRoute() {
  const { language } = useLanguage();

  if (!isLiveMedicalTranslationEnabled()) {
    return <Navigate to="/patient" replace />;
  }

  return (
    <LiveTranslationErrorBoundary uiLanguage={language}>
      <LiveTranslationPage />
    </LiveTranslationErrorBoundary>
  );
}
