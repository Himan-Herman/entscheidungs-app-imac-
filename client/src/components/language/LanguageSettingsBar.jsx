import { useMemo } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getMessages } from "../../i18n/translations";
import GlobalLanguageSelector from "./GlobalLanguageSelector";
import { HEADER_SELECTABLE_LOCALE_CODES } from "../../i18n/localeConfig";
import "./LanguageSettingsBar.css";

/**
 * Inline language control for patient/practice hubs and settings areas.
 */
export default function LanguageSettingsBar({ className = "" }) {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).languageSettings || getMessages("en").languageSettings,
    [language],
  );
  const header = useMemo(() => getMessages(language).header, [language]);

  return (
    <section
      className={`language-settings-bar ${className}`.trim()}
      aria-labelledby="language-settings-title"
    >
      <div className="language-settings-bar__text">
        <h2 id="language-settings-title" className="language-settings-bar__title">
          {t.panelTitle}
        </h2>
        <p className="language-settings-bar__hint">{t.panelHint}</p>
        <p className="language-settings-bar__meta">{t.savedHint}</p>
        <p className="language-settings-bar__meta">{t.syncedHint}</p>
      </div>
      <div className="language-settings-bar__control">
        <GlobalLanguageSelector
          label={header.languageLabel}
          selectableLocaleCodes={HEADER_SELECTABLE_LOCALE_CODES}
        />
      </div>
    </section>
  );
}
