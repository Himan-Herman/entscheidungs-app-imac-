import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  isRtlLanguage,
  isSupportedLanguage,
  LANGUAGE_STORAGE_KEY,
  resolveInitialLanguage,
  SUPPORTED_LANGUAGE_CODES,
} from "./localeConfig";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    if (typeof window === "undefined") {
      return "de";
    }
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return resolveInitialLanguage(stored, window.navigator.language);
  });

  const setLanguage = useCallback((next) => {
    const code = typeof next === "string" ? next.toLowerCase() : "";
    setLanguageState(isSupportedLanguage(code) ? code : "en");
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = isRtlLanguage(language) ? "rtl" : "ltr";
    root.dataset.msTextDir = isRtlLanguage(language) ? "rtl" : "ltr";
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      /* ignore quota / private mode */
    }
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      supportedLanguages: SUPPORTED_LANGUAGE_CODES,
    }),
    [language, setLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside <LanguageProvider>");
  }

  return context;
}
