import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";
import { LOCALE_OPTIONS } from "../../i18n/localeConfig";
import "./GlobalLanguageSelector.css";

export default function GlobalLanguageSelector({
  label,
  compact = false,
  className = "",
}) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listId = useId();

  const ariaLabel = label ?? "Language";

  useEffect(() => {
    if (!open) return undefined;

    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }

    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current =
    LOCALE_OPTIONS.find((o) => o.code === language) ?? LOCALE_OPTIONS[0];

  function select(code) {
    setLanguage(code);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      ref={rootRef}
      className={`gls ${compact ? "gls--compact" : ""} ${className}`.trim()}
    >
      <button
        ref={triggerRef}
        type="button"
        id={`${listId}-trigger`}
        className="gls__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${listId}-listbox`}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <Globe className="gls__globe" strokeWidth={1.75} aria-hidden />
        <span className="gls__current">{current.nativeName}</span>
        <ChevronDown
          className={`gls__chevron ${open ? "is-open" : ""}`}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          id={`${listId}-listbox`}
          className="gls__menu"
          role="listbox"
          aria-labelledby={`${listId}-trigger`}
        >
          {LOCALE_OPTIONS.map((opt) => (
            <li key={opt.code} role="presentation">
              <button
                id={`${listId}-opt-${opt.code}`}
                type="button"
                role="option"
                aria-selected={language === opt.code}
                className={`gls__option ${language === opt.code ? "is-active" : ""}`}
                onClick={() => select(opt.code)}
              >
                <span className="gls__option-label">{opt.nativeName}</span>
                <span className="gls__option-code" aria-hidden>
                  {opt.code}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
