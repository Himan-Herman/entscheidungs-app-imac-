import React from "react";
import { useLanguage } from "../i18n/LanguageContext";
import "../styles/LanguageSwitcher.css";

export default function LanguageSwitcher({
  label = "Language",
  className = "",
  compact = false,
}) {
  const { language, setLanguage, supportedLanguages } = useLanguage();

  return (
    <div
      className={`language-switcher ${compact ? "language-switcher--compact" : ""} ${className}`.trim()}
      aria-label={label}
    >
      <span className="language-switcher__label">{label}</span>
      <div className="language-switcher__options" role="group" aria-label={label}>
        {supportedLanguages.map((option) => (
          <button
            key={option}
            type="button"
            className={`language-switcher__button ${language === option ? "is-active" : ""}`}
            onClick={() => setLanguage(option)}
            aria-pressed={language === option}
          >
            {option.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
