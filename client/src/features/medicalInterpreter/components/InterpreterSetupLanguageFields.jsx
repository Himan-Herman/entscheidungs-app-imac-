import { useId, useMemo, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { formatLanguageDisplayName } from "../../../i18n/intlLocale.js";
import { isRtlLanguage } from "../../../i18n/localeConfig.js";
import {
  INTERPRETER_SETUP_LANGUAGE_OPTIONS,
} from "../constants/setupLanguages.js";

/**
 * @param {import('../../../i18n/localeConfig.js').typeof LOCALE_OPTIONS[number]} opt
 * @param {string} uiLanguage
 */
function optionLabel(opt, uiLanguage) {
  const display = formatLanguageDisplayName(uiLanguage, opt.code) || opt.code;
  if (display === opt.nativeName) return opt.nativeName;
  return `${opt.nativeName} — ${display}`;
}

/**
 * @param {{
 *   patientLanguage: string;
 *   doctorLanguage: string;
 *   onPatientLanguage: (v: string) => void;
 *   onDoctorLanguage: (v: string) => void;
 *   languageError: string;
 *   labels: object;
 * }} props
 */
export default function InterpreterSetupLanguageFields({
  patientLanguage,
  doctorLanguage,
  onPatientLanguage,
  onDoctorLanguage,
  languageError,
  labels: t,
}) {
  const { language: uiLanguage } = useLanguage();
  const [filterQuery, setFilterQuery] = useState("");
  const patientId = useId();
  const doctorId = useId();
  const filterId = useId();
  const errorId = useId();

  const filteredOptions = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return INTERPRETER_SETUP_LANGUAGE_OPTIONS;
    return INTERPRETER_SETUP_LANGUAGE_OPTIONS.filter((opt) => {
      const label = optionLabel(opt, uiLanguage).toLowerCase();
      return label.includes(q) || opt.code.includes(q);
    });
  }, [filterQuery, uiLanguage]);

  const renderOptions = (options) =>
    options.map((opt) => (
      <option
        key={opt.code}
        value={opt.code}
        dir={isRtlLanguage(opt.code) ? "rtl" : "ltr"}
        lang={opt.code}
        className="interpreter-setup__language-option-native"
      >
        {optionLabel(opt, uiLanguage)}
      </option>
    ));

  return (
    <fieldset className="interpreter-setup__fieldset">
      <legend className="interpreter-setup__legend">{t.languages.heading}</legend>
      <p className="interpreter-setup__hint">{t.languages.intro}</p>

      <div className="interpreter-setup__language-filter">
        <label className="interpreter-setup__label" htmlFor={filterId}>
          {t.languages.searchLabel}
        </label>
        <input
          id={filterId}
          type="search"
          className="interpreter-setup__language-filter-input"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder={t.languages.searchPlaceholder}
          aria-label={t.aria.languageSearch}
          autoComplete="off"
        />
        {filterQuery.trim() && filteredOptions.length === 0 ? (
          <p className="interpreter-setup__hint" role="status">
            {t.languages.searchEmpty}
          </p>
        ) : null}
      </div>

      <div className="interpreter-setup__field">
        <label className="interpreter-setup__label" htmlFor={patientId}>
          {t.languages.patientLabel}
        </label>
        <span className="interpreter-setup__hint" id={`${patientId}-hint`}>
          {t.languages.patientHint}
        </span>
        <select
          id={patientId}
          className="interpreter-setup__select"
          value={patientLanguage}
          onChange={(e) => onPatientLanguage(e.target.value)}
          aria-required="true"
          aria-invalid={languageError ? true : undefined}
          aria-describedby={
            languageError ? `${patientId}-hint ${errorId}` : `${patientId}-hint`
          }
          aria-label={t.aria.languagePatient}
        >
          <option value="">{t.languages.selectEmpty}</option>
          {renderOptions(filteredOptions)}
        </select>
      </div>

      <div className="interpreter-setup__field">
        <label className="interpreter-setup__label" htmlFor={doctorId}>
          {t.languages.doctorLabel}
        </label>
        <span className="interpreter-setup__hint" id={`${doctorId}-hint`}>
          {t.languages.doctorHint}
        </span>
        <select
          id={doctorId}
          className="interpreter-setup__select"
          value={doctorLanguage}
          onChange={(e) => onDoctorLanguage(e.target.value)}
          aria-required="true"
          aria-invalid={languageError ? true : undefined}
          aria-describedby={
            languageError ? `${doctorId}-hint ${errorId}` : `${doctorId}-hint`
          }
          aria-label={t.aria.languageDoctor}
        >
          <option value="">{t.languages.selectEmpty}</option>
          {renderOptions(filteredOptions)}
        </select>
      </div>

      {languageError ? (
        <p id={errorId} className="interpreter-setup__error" role="alert">
          {languageError}
        </p>
      ) : null}
    </fieldset>
  );
}
