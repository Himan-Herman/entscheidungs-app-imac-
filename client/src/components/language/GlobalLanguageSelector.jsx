import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, Globe } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getMessages } from "../../i18n/translations/index.js";
import {
  HEADER_SELECTABLE_LOCALE_CODES,
  LOCALE_OPTIONS,
} from "../../i18n/localeConfig";
import "./GlobalLanguageSelector.css";

export default function GlobalLanguageSelector({
  label,
  compact = false,
  className = "",
  /** When true, every listed locale is clickable (otherwise only de + en). */
  allowAllLocales = false,
  /** Locales users may select; others stay visible but disabled. */
  selectableLocaleCodes = HEADER_SELECTABLE_LOCALE_CODES,
}) {
  const { language, setLanguage } = useLanguage();
  const copy = useMemo(() => getMessages(language).header, [language]);
  const common = useMemo(() => getMessages(language).common, [language]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const listId = useId();

  const ariaLabel = label ?? copy.languageLabel;

  const filteredOptions = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return LOCALE_OPTIONS;
    return LOCALE_OPTIONS.filter(
      (o) =>
        o.nativeName.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q),
    );
  }, [filter]);

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

  useEffect(() => {
    if (!open) setFilter("");
  }, [open]);

  useEffect(() => {
    if (open && searchRef.current) {
      const id = window.requestAnimationFrame(() =>
        searchRef.current?.focus(),
      );
      return () => window.cancelAnimationFrame(id);
    }
    return undefined;
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return undefined;
    }

    const mq = window.matchMedia("(max-width: 860px)");

    function placeMenu() {
      const trigger = triggerRef.current;
      if (!mq.matches || !trigger) {
        setMenuStyle(null);
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const pad = 12;
      const width = Math.min(280, vw - pad * 2);
      const top = rect.bottom + 6;
      const rightPx = Math.max(pad, vw - rect.right);
      const leftEdge = vw - rightPx - width;

      if (leftEdge >= pad) {
        setMenuStyle({
          position: "fixed",
          top: `${top}px`,
          right: `${rightPx}px`,
          left: "auto",
          width: `${width}px`,
          zIndex: 1101,
        });
      } else {
        setMenuStyle({
          position: "fixed",
          top: `${top}px`,
          left: `${pad}px`,
          right: "auto",
          width: `${width}px`,
          zIndex: 1101,
        });
      }
    }

    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    mq.addEventListener("change", placeMenu);

    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
      mq.removeEventListener("change", placeMenu);
    };
  }, [open]);

  const current =
    LOCALE_OPTIONS.find((o) => o.code === language) ??
    LOCALE_OPTIONS.find((o) => o.code === "en") ??
    LOCALE_OPTIONS[0];

  const selectableSet = useMemo(() => {
    if (allowAllLocales) return null;
    const codes =
      selectableLocaleCodes?.length > 0
        ? selectableLocaleCodes
        : HEADER_SELECTABLE_LOCALE_CODES;
    return new Set(codes.map((c) => c.toLowerCase()));
  }, [allowAllLocales, selectableLocaleCodes]);

  function isSelectable(code) {
    if (!selectableSet) return true;
    return selectableSet.has(code.toLowerCase());
  }

  function select(code) {
    if (!isSelectable(code)) return;
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
          className={`gls__menu${menuStyle ? " gls__menu--viewport" : ""}`}
          role="listbox"
          aria-labelledby={`${listId}-trigger`}
          style={menuStyle ?? undefined}
        >
          <li role="presentation" className="gls__search-row">
            <input
              ref={searchRef}
              type="search"
              className="gls__search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={common.languageSearchPlaceholder}
              aria-label={common.languageSearchPlaceholder}
              autoComplete="off"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            />
          </li>
          {filteredOptions.map((opt) => {
            const enabled = isSelectable(opt.code);
            return (
              <li key={opt.code} role="presentation">
                <button
                  id={`${listId}-opt-${opt.code}`}
                  type="button"
                  role="option"
                  aria-selected={language === opt.code}
                  aria-disabled={!enabled}
                  disabled={!enabled}
                  className={`gls__option ${language === opt.code ? "is-active" : ""} ${!enabled ? "is-disabled" : ""}`.trim()}
                  onClick={() => select(opt.code)}
                >
                  <span className="gls__option-label">{opt.nativeName}</span>
                  <span className="gls__option-code" aria-hidden>
                    {opt.code}
                  </span>
                </button>
              </li>
            );
          })}
          {filteredOptions.length === 0 ? (
            <li role="presentation" className="gls__empty">
              {common.languageSearchNoResults}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
