import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  addDays,
  addMonths,
  clampIso,
  daysInMonth,
  formatForInput,
  isWithin,
  maskTyping,
  monthMatrix,
  parseIso,
  parseTyped,
  placeholderFor,
  toIso,
  todayIso,
} from "./dateFieldModel.js";
import "./DateField.css";

/*
 * Labels for the few words the picker itself needs. Month and weekday names
 * come from Intl in the page language, so they are never hand-translated.
 */
const LABELS = {
  de: { open: "Kalender öffnen", dialog: "Datum auswählen", prev: "Vorheriger Monat", next: "Nächster Monat", chooseYear: "Jahr wählen", chooseMonth: "Monat wählen" },
  en: { open: "Open calendar", dialog: "Choose a date", prev: "Previous month", next: "Next month", chooseYear: "Choose year", chooseMonth: "Choose month" },
  fr: { open: "Ouvrir le calendrier", dialog: "Choisir une date", prev: "Mois précédent", next: "Mois suivant", chooseYear: "Choisir l'année", chooseMonth: "Choisir le mois" },
  it: { open: "Apri il calendario", dialog: "Scegli una data", prev: "Mese precedente", next: "Mese successivo", chooseYear: "Scegli l'anno", chooseMonth: "Scegli il mese" },
  es: { open: "Abrir calendario", dialog: "Elegir una fecha", prev: "Mes anterior", next: "Mes siguiente", chooseYear: "Elegir año", chooseMonth: "Elegir mes" },
  ru: { open: "Открыть календарь", dialog: "Выберите дату", prev: "Предыдущий месяц", next: "Следующий месяц", chooseYear: "Выбрать год", chooseMonth: "Выбрать месяц" },
};

const INTL_LOCALE = { de: "de-DE", en: "en-GB", fr: "fr-FR", it: "it-IT", es: "es-ES", ru: "ru-RU" };

const POPOVER_GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * A date input that is fast to type AND fast to pick.
 *
 * TYPING: the field takes digits and places the separators itself —
 * "11091999" becomes "11.09.1999". For a known date this is the fastest path.
 *
 * PICKING: the calendar opens on the YEAR when nothing is chosen yet
 * (`startView="year"`) — for a date of birth that is three taps (year, month,
 * day) instead of a hundred "previous month" clicks. The month/year title in
 * the day view jumps back there at any time.
 *
 * VALUE CONTRACT: `value` and `onChange` speak "YYYY-MM-DD". While the typed
 * text is not (yet) a real date, `onChange` receives "invalid" — so the form's
 * own validation can tell "left empty" from "typed something wrong" without
 * knowing anything about this component.
 *
 * The popover is portalled to <body>: inside a scrolling dialog it would
 * otherwise be clipped at the dialog's edge.
 */
export default function DateField({
  value,
  onChange,
  min = "1900-01-01",
  max,
  id,
  required = false,
  describedBy,
  startView = "day",
  defaultViewDate,
  inputRef,
  className = "",
  inputClassName = "",
}) {
  const { language } = useLanguage();
  const lang = LABELS[language] ? language : "de";
  const t = LABELS[lang];
  const locale = INTL_LOCALE[lang];

  const autoId = useId();
  const inputId = id || `datefield-${autoId}`;
  const popoverId = `${inputId}-calendar`;

  const today = todayIso();
  const upper = max || null;

  const [text, setText] = useState(() => formatForInput(value, lang));
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("day");
  const [focusDate, setFocusDate] = useState(null);
  const [position, setPosition] = useState(null);
  // A half-typed date is not an error yet — only once it is complete or the
  // user has left the field.
  const [left, setLeft] = useState(false);
  const placed = position !== null;

  const wrapRef = useRef(null);
  const ownInputRef = useRef(null);
  const popoverRef = useRef(null);
  const lastEmitted = useRef(value);

  // A value set from outside (form reset, prefill) replaces the text — but not
  // our own echo, which would reformat what the user is in the middle of typing.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    setText(formatForInput(value, lang));
  }, [value, lang]);

  const emit = useCallback((next) => {
    lastEmitted.current = next;
    onChange?.(next);
  }, [onChange]);

  const setInputNode = useCallback((node) => {
    ownInputRef.current = node;
    if (typeof inputRef === "function") inputRef(node);
    else if (inputRef) inputRef.current = node;
  }, [inputRef]);

  /* ------------------------------------------------------------ typing */

  function onInput(e) {
    const raw = e.target.value;
    // A pasted ISO date ("1960-01-01", e.g. from another system) is taken as
    // it is, not squeezed through the day-month-year mask.
    const pastedIso = parseIso(raw.trim());
    if (pastedIso) {
      const iso = toIso(pastedIso.year, pastedIso.month, pastedIso.day);
      setText(formatForInput(iso, lang));
      setLeft(false);
      emit(iso);
      return;
    }
    const deleting = raw.length < text.length;
    const masked = maskTyping(raw, lang, { deleting });
    setText(masked);
    setLeft(false);
    if (!masked) { emit(""); return; }
    const iso = parseTyped(masked);
    emit(iso || "invalid");
  }

  /* ---------------------------------------------------------- open/close */

  const anchorDate = useCallback(() => {
    const chosen = parseIso(value) ? value : null;
    const fallback = defaultViewDate && parseIso(defaultViewDate) ? defaultViewDate : today;
    return clampIso(chosen || fallback, min, upper);
  }, [value, defaultViewDate, today, min, upper]);

  function openCalendar() {
    const hasValue = Boolean(parseIso(value));
    setFocusDate(anchorDate());
    setView(!hasValue && startView === "year" ? "year" : "day");
    setOpen(true);
  }

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) ownInputRef.current?.focus();
  }, []);

  function choose(iso) {
    if (!isWithin(iso, min, upper)) return;
    setText(formatForInput(iso, lang));
    setLeft(false);
    emit(iso);
    close();
  }

  // Place the popover under the field, or above it when there is no room.
  const place = useCallback((e) => {
    // The year list scrolling inside the popover does not move the field.
    if (e?.target instanceof Node && popoverRef.current?.contains(e.target)) return;
    const anchor = wrapRef.current;
    const pop = popoverRef.current;
    if (!anchor || !pop) return;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(pop.offsetWidth, vw - VIEWPORT_MARGIN * 2);
    const height = pop.offsetHeight;
    const below = vh - r.bottom - VIEWPORT_MARGIN;
    const above = r.top - VIEWPORT_MARGIN;
    const top = below >= height + POPOVER_GAP || below >= above
      ? r.bottom + POPOVER_GAP
      : Math.max(VIEWPORT_MARGIN, r.top - POPOVER_GAP - height);
    const left = Math.min(Math.max(VIEWPORT_MARGIN, r.left), vw - width - VIEWPORT_MARGIN);
    setPosition((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
  }, []);

  useLayoutEffect(() => {
    if (!open) { setPosition(null); return undefined; }
    place();
    // Capture: the dialog around the field scrolls, not only the window.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, view, place]);

  // Outside click closes, without stealing focus from wherever the click went.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (popoverRef.current?.contains(e.target) || wrapRef.current?.contains(e.target)) return;
      close(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open, close]);

  // Escape closes the calendar only — never the dialog the field sits in.
  useEffect(() => {
    const pop = popoverRef.current;
    if (!open || !pop) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (view !== "day") setView("day");
      else close();
    };
    pop.addEventListener("keydown", onKey);
    return () => pop.removeEventListener("keydown", onKey);
  }, [open, view, close, placed]);

  /* ------------------------------------------------------------- views */

  const focus = focusDate ? parseIso(focusDate) : null;

  const monthTitle = useMemo(() => {
    if (!focus) return "";
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" })
      .format(new Date(focus.year, focus.month, 1));
  }, [focus, locale]);

  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    // 2024-01-01 was a Monday.
    return Array.from({ length: 7 }, (_, i) => {
      const s = fmt.format(new Date(2024, 0, 1 + i)).replace(".", "");
      return s.charAt(0).toUpperCase() + s.slice(1, 2);
    });
  }, [locale]);

  const monthNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: "short" });
    return Array.from({ length: 12 }, (_, m) => {
      const s = fmt.format(new Date(2024, m, 1)).replace(".", "");
      return s.charAt(0).toUpperCase() + s.slice(1);
    });
  }, [locale]);

  const fullDate = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    [locale],
  );

  const minYear = Number(String(min || "1900").slice(0, 4));
  const maxYear = upper ? Number(upper.slice(0, 4)) : new Date().getFullYear() + 10;

  // Move keyboard focus to the active cell whenever it changes. Scrolling is
  // done on the year list itself: scrollIntoView would also scroll the page.
  useEffect(() => {
    if (!open || !focusDate || !placed) return;
    const pop = popoverRef.current;
    if (!pop) return;
    const key = view === "day" ? focusDate : view === "month" ? focusDate.slice(0, 7) : focusDate.slice(0, 4);
    const el = pop.querySelector(`[data-key="${key}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    if (view === "year") {
      const list = el.parentElement;
      const top = el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2;
      if (top < list.scrollTop || top > list.scrollTop + list.clientHeight - el.offsetHeight * 2) {
        list.scrollTop = Math.max(0, top);
      }
    }
  }, [open, focusDate, view, placed]);

  function onDayKey(e) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    let next = null;
    if (step) next = addDays(focusDate, step);
    else if (e.key === "PageUp") next = addMonths(focusDate, e.shiftKey ? -12 : -1);
    else if (e.key === "PageDown") next = addMonths(focusDate, e.shiftKey ? 12 : 1);
    else if (e.key === "Home") next = addDays(focusDate, -((new Date(focus.year, focus.month, focus.day).getDay() + 6) % 7));
    else if (e.key === "End") next = addDays(focusDate, 6 - ((new Date(focus.year, focus.month, focus.day).getDay() + 6) % 7));
    if (!next) return;
    e.preventDefault();
    setFocusDate(clampIso(next, min, upper));
  }

  function onGridKey(e, cols, unit) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = unit === "month" ? addMonths(focusDate, step) : addMonths(focusDate, step * 12);
    setFocusDate(clampIso(next, min, upper));
  }

  function shiftMonth(delta) {
    setFocusDate(clampIso(addMonths(focusDate, delta), min, upper));
  }

  const monthStart = focus ? toIso(focus.year, focus.month, 1) : null;
  const canPrev = Boolean(focus) && (!min || addDays(monthStart, -1) >= min);
  const canNext = Boolean(focus) && (!upper || addMonths(monthStart, 1) <= upper);

  let body = null;
  if (open && focus) {
    if (view === "year") {
      const years = [];
      for (let y = minYear; y <= maxYear; y += 1) years.push(y);
      const selectedYear = parseIso(value)?.year;
      body = (
        <>
          <div className="datefield__head">
            <span className="datefield__title datefield__title--static">{t.chooseYear}</span>
          </div>
          <div className="datefield__years" role="listbox" aria-label={t.chooseYear}
            onKeyDown={(e) => onGridKey(e, 4, "year")}>
            {years.map((y) => {
              const isFocus = y === focus.year;
              return (
                <button
                  key={y}
                  type="button"
                  role="option"
                  data-key={String(y)}
                  aria-selected={y === selectedYear}
                  tabIndex={isFocus ? 0 : -1}
                  className={`datefield__cell datefield__cell--wide${y === selectedYear ? " is-selected" : ""}${isFocus ? " is-focus" : ""}`}
                  onClick={() => {
                    setFocusDate(clampIso(toIso(y, focus.month, Math.min(focus.day, 28)), min, upper));
                    setView("month");
                  }}
                >
                  {y}
                </button>
              );
            })}
          </div>
        </>
      );
    } else if (view === "month") {
      const selected = parseIso(value);
      body = (
        <>
          <div className="datefield__head">
            <button type="button" className="datefield__title" onClick={() => setView("year")}
              aria-label={`${t.chooseYear}: ${focus.year}`}>
              {focus.year}
              <Chevron />
            </button>
          </div>
          <div className="datefield__months" role="listbox" aria-label={t.chooseMonth}
            onKeyDown={(e) => onGridKey(e, 3, "month")}>
            {monthNames.map((name, m) => {
              const first = toIso(focus.year, m, 1);
              const last = toIso(focus.year, m, daysInMonth(focus.year, m));
              const disabled = Boolean((upper && first > upper) || (min && last < min));
              const isSel = selected && selected.year === focus.year && selected.month === m;
              const isFocus = m === focus.month;
              return (
                <button
                  key={m}
                  type="button"
                  role="option"
                  data-key={`${focus.year}-${String(m + 1).padStart(2, "0")}`}
                  aria-selected={Boolean(isSel)}
                  disabled={disabled}
                  tabIndex={isFocus ? 0 : -1}
                  className={`datefield__cell datefield__cell--wide${isSel ? " is-selected" : ""}${isFocus ? " is-focus" : ""}`}
                  onClick={() => {
                    setFocusDate(clampIso(toIso(focus.year, m, Math.min(focus.day, 28)), min, upper));
                    setView("day");
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </>
      );
    } else {
      const rows = monthMatrix(focus.year, focus.month);
      body = (
        <>
          <div className="datefield__head">
            <button type="button" className="datefield__title" onClick={() => setView("year")}
              aria-label={`${t.chooseYear}: ${monthTitle}`}>
              {monthTitle}
              <Chevron />
            </button>
            <div className="datefield__nav">
              <button type="button" className="datefield__arrow" onClick={() => shiftMonth(-1)}
                disabled={!canPrev} aria-label={t.prev}>
                <Arrow dir="left" />
              </button>
              <button type="button" className="datefield__arrow" onClick={() => shiftMonth(1)}
                disabled={!canNext} aria-label={t.next}>
                <Arrow dir="right" />
              </button>
            </div>
          </div>
          <table className="datefield__grid" role="grid" aria-label={monthTitle} onKeyDown={onDayKey}>
            <thead>
              <tr>
                {weekdays.map((w, i) => (
                  <th key={i} scope="col" className="datefield__weekday">{w}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((iso, c) => {
                    if (!iso) return <td key={c} />;
                    const p = parseIso(iso);
                    const disabled = !isWithin(iso, min, upper);
                    const isSel = iso === value;
                    const isToday = iso === today;
                    const isFocus = iso === focusDate;
                    return (
                      <td key={c}>
                        <button
                          type="button"
                          data-key={iso}
                          tabIndex={isFocus ? 0 : -1}
                          disabled={disabled}
                          aria-pressed={isSel}
                          aria-current={isToday ? "date" : undefined}
                          aria-label={fullDate.format(new Date(p.year, p.month, p.day))}
                          className={`datefield__cell datefield__day${isSel ? " is-selected" : ""}${isToday ? " is-today" : ""}${isFocus ? " is-focus" : ""}`}
                          onClick={() => choose(iso)}
                        >
                          {p.day}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    }
  }

  const invalid = text !== "" && !parseTyped(text) && (left || text.length >= 10);

  return (
    <div className={`datefield ${className}`.trim()} ref={wrapRef}>
      <input
        id={inputId}
        ref={setInputNode}
        className={`datefield__input ${inputClassName}`.trim()}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholderFor(lang)}
        value={text}
        onChange={onInput}
        onBlur={() => setLeft(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && e.altKey) { e.preventDefault(); openCalendar(); }
        }}
        required={required}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        maxLength={10}
      />
      <button
        type="button"
        className="datefield__toggle"
        onClick={() => (open ? close() : openCalendar())}
        aria-label={t.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
      >
        <CalendarIcon />
      </button>

      {open ? createPortal(
        <div
          id={popoverId}
          ref={popoverRef}
          className={`datefield__popover datefield__popover--${view}`}
          role="dialog"
          aria-label={t.dialog}
          style={position ? { top: position.top, left: position.left } : { visibility: "hidden", top: 0, left: 0 }}
        >
          {body}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function Chevron() {
  return (
    <svg className="datefield__chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Arrow({ dir }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={dir === "left" ? "M10 3.5L5.5 8 10 12.5" : "M6 3.5L10.5 8 6 12.5"} fill="none"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <rect x="3" y="4.5" width="14" height="12.5" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8.5h14M7 2.8v3.4M13 2.8v3.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
