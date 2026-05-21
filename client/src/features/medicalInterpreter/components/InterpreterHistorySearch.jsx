import { useId } from "react";

/**
 * @param {{
 *   value: string;
 *   onChange: (value: string) => void;
 *   resultCount: number;
 *   totalCount: number;
 *   labels: object;
 * }} props
 */
export default function InterpreterHistorySearch({
  value,
  onChange,
  resultCount,
  totalCount,
  labels: t,
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  return (
    <div className="interpreter-history__search">
      <label className="interpreter-history__search-label" htmlFor={inputId}>
        {t.history.searchLabel}
      </label>
      <input
        id={inputId}
        type="search"
        className="interpreter-history__search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.history.searchPlaceholder}
        aria-label={t.aria.searchHistory}
        aria-describedby={hintId}
        autoComplete="off"
      />
      <p id={hintId} className="interpreter-history__search-hint" role="status">
        {value.trim()
          ? t.history.searchResults
              .replace("{{count}}", String(resultCount))
              .replace("{{total}}", String(totalCount))
          : t.history.searchHintLocal}
      </p>
    </div>
  );
}
