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
  HEADER_SELECTABLE_LOCALE_CODES,
  isRtlLanguage,
  isSupportedLanguage,
  LANGUAGE_SOURCE_MANUAL,
  LANGUAGE_SOURCE_STORAGE_KEY,
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

function readStartupSignals() {
  let stored = null;
  let storedSource = null;
  try {
    stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    storedSource = localStorage.getItem(LANGUAGE_SOURCE_STORAGE_KEY);
  } catch {
    /* storage blocked — detect from location */
  }
  let timeZone = null;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    /* no Intl time zone — detect from browser language */
  }
  return {
    stored,
    storedSource,
    timeZone,
    navigatorLanguage: window.navigator.language,
    navigatorLanguages: window.navigator.languages,
  };
}

export function LanguageProvider({ children }) {
  /** source "manual" = picked by the user; anything else = derived from location. */
  const [{ language, source }, setLanguageState] = useState(() => {
    if (typeof window === "undefined") {
      return { language: "de", source: "default" };
    }
    return resolveInitialLanguage(readStartupSignals());
  });
  const profileLoadedRef = useRef(false);

  const setLanguage = useCallback((next) => {
    const code = typeof next === "string" ? next.toLowerCase() : "";
    const resolved = isSupportedLanguage(code) ? code : "en";
    setLanguageState((prev) => {
      if (prev.language !== resolved) {
        queueMicrotask(() => {
          void sendPracticeAnalyticsEvent({
            eventType: "ui_language_changed",
            metadata: { uiLanguage: resolved },
          });
        });
      }
      // Confirming the detected language is a choice too: it must then stick
      // when the user travels, on this device and on their account.
      if (
        (prev.language !== resolved || prev.source !== LANGUAGE_SOURCE_MANUAL) &&
        localStorage.getItem("medscout_token")
      ) {
        void patchUiLanguagePreference(resolved).catch(() => {
          /* localStorage remains source on device */
        });
      }
      return { language: resolved, source: LANGUAGE_SOURCE_MANUAL };
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = isRtlLanguage(language) ? "rtl" : "ltr";
    root.dataset.msTextDir = isRtlLanguage(language) ? "rtl" : "ltr";
  }, [language]);

  // Only a manual choice is remembered. A location-derived language is
  // re-detected on every visit, and any stale automatic value is dropped.
  useEffect(() => {
    try {
      if (source === LANGUAGE_SOURCE_MANUAL) {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
        localStorage.setItem(LANGUAGE_SOURCE_STORAGE_KEY, LANGUAGE_SOURCE_MANUAL);
      } else {
        localStorage.removeItem(LANGUAGE_STORAGE_KEY);
        localStorage.removeItem(LANGUAGE_SOURCE_STORAGE_KEY);
      }
    } catch {
      /* ignore quota / private mode */
    }
  }, [language, source]);

  useEffect(() => {
    if (profileLoadedRef.current) return;
    if (!localStorage.getItem("medscout_token")) return;
    profileLoadedRef.current = true;
    void (async () => {
      try {
        const { res, data } = await fetchUiLanguagePreference();
        // The account only holds a language the user picked (PATCH above),
        // so it is a manual choice and beats the location on every device.
        if (
          res?.ok &&
          data.ok &&
          HEADER_SELECTABLE_LOCALE_CODES.includes(data.locale)
        ) {
          setLanguageState({ language: data.locale, source: LANGUAGE_SOURCE_MANUAL });
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
