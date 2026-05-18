import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  isRtlLanguage,
  isSupportedLanguage,
  LANGUAGE_STORAGE_KEY,
  resolveInitialLanguage,
  SUPPORTED_LANGUAGE_CODES,
} from "./localeConfig";
import { sendPracticeAnalyticsEvent } from "../api/productAnalytics.js";
import {
  fetchUiLanguagePreference,
  patchUiLanguagePreference,
} from "./i18nPreferencesApi.js";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    if (typeof window === "undefined") {
      return "de";
    }
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return resolveInitialLanguage(stored, window.navigator.language);
  });
  const profileLoadedRef = useRef(false);

  const setLanguage = useCallback((next) => {
    const code = typeof next === "string" ? next.toLowerCase() : "";
    const resolved = isSupportedLanguage(code) ? code : "en";
    setLanguageState((prev) => {
      if (prev !== resolved) {
        queueMicrotask(() => {
          void sendPracticeAnalyticsEvent({
            eventType: "ui_language_changed",
            metadata: { uiLanguage: resolved },
          });
        });
        if (localStorage.getItem("medscout_token")) {
          void patchUiLanguagePreference(resolved).catch(() => {
            /* localStorage remains source on device */
          });
        }
      }
      return resolved;
    });
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

  useEffect(() => {
    if (profileLoadedRef.current) return;
    if (!localStorage.getItem("medscout_token")) return;
    profileLoadedRef.current = true;
    void (async () => {
      try {
        const { res, data } = await fetchUiLanguagePreference();
        if (res?.ok && data.ok && isSupportedLanguage(data.locale)) {
          setLanguageState(data.locale);
        }
      } catch {
        /* keep localStorage preference */
      }
    })();
  }, []);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      supportedLanguages: SUPPORTED_LANGUAGE_CODES,
    }),
    [language, setLanguage],
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
