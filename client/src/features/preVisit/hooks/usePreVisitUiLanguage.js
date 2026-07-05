import { useMemo } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { PRE_VISIT_LANGUAGE_OPTIONS } from "../constants/languages.js";
import {
  loadPreVisitSession,
  PREVISIT_LOCALE_STORAGE_KEY,
} from "../constants/preVisitSession.js";

const ALLOWED_PREVISIT_UI_LANGUAGES = new Set(
  PRE_VISIT_LANGUAGE_OPTIONS.map((row) => row.id)
);

export function resolvePreVisitUiLanguage(fallbackLanguage, patientLanguage) {
  const direct =
    typeof patientLanguage === "string"
      ? patientLanguage.trim().toLowerCase()
      : "";
  if (ALLOWED_PREVISIT_UI_LANGUAGES.has(direct)) return direct;

  try {
    const stored = sessionStorage.getItem(PREVISIT_LOCALE_STORAGE_KEY);
    if (stored && ALLOWED_PREVISIT_UI_LANGUAGES.has(stored)) return stored;
  } catch {
    /* ignore private mode / unavailable sessionStorage */
  }

  const fromSession = loadPreVisitSession()?.patientLanguage;
  if (fromSession && ALLOWED_PREVISIT_UI_LANGUAGES.has(fromSession)) {
    return fromSession;
  }

  if (ALLOWED_PREVISIT_UI_LANGUAGES.has(fallbackLanguage)) {
    return fallbackLanguage;
  }
  return "de";
}

export function usePreVisitUiLanguage(patientLanguage) {
  const { language } = useLanguage();

  return useMemo(
    () => resolvePreVisitUiLanguage(language, patientLanguage),
    [language, patientLanguage]
  );
}
