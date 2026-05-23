import { formatLanguageDisplayName } from "../../../i18n/intlLocale.js";
import { useLanguage } from "../../../i18n/LanguageContext";

/**
 * @param {{
 *   session: import('../types.js').InterpreterSession;
 *   statusLabel: string;
 *   labels: object;
 * }} props
 */
export default function InterpreterLiveHeader({ session, statusLabel, labels: t }) {
  const { language: uiLanguage } = useLanguage();
  const patientLabel =
    formatLanguageDisplayName(uiLanguage, session.patientLanguage) ||
    session.patientLanguage ||
    "—";
  const doctorLabel =
    formatLanguageDisplayName(uiLanguage, session.doctorLanguage) ||
    session.doctorLanguage ||
    "—";
  const title =
    session.conversationTitle?.trim() || t.room.heading;

  return (
    <header className="interpreter-live__header">
      <h1 className="medical-interpreter-page__title">{title}</h1>
      <p className="interpreter-live__languages">
        {t.room.languagesLabel
          .replace("{{patient}}", patientLabel)
          .replace("{{doctor}}", doctorLabel)}
      </p>
      <p className="interpreter-live__status interpreter-live__status--header" aria-hidden="true">
        {statusLabel}
      </p>
    </header>
  );
}
