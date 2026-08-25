import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Inbox } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  fetchMyPractices,
  fetchPatientNotifications,
  fetchPracticeNotifications,
} from "../api/notificationCenterApi.js";
import "../styles/NotificationCenter.css";

/**
 * The one central notification entry in the header.
 *
 * WHAT IT IS
 * ----------
 * A view onto the inbox the current mode already has, not a third inbox. The
 * badge counts exactly one thing — unread (patient) or new (practice) inbox
 * items — and the panel shows the newest few plus a link to the real inbox,
 * where filtering, paging and working through items already live.
 *
 * Open follow-ups are shown in practice mode as their OWN number with its own
 * link into the Phase 5B patient overview. They are never added to the badge:
 * "unread" and "still to do" are different questions, and one number cannot
 * answer both without lying about at least one of them.
 *
 * MODE SAFETY
 * -----------
 * Patient and practice have separate endpoints. On any switch — patient to
 * practice, or practice A to practice B — the previous result is dropped
 * BEFORE the new request starts and the in-flight request is aborted, so a
 * late response can never paint one context's data into another's header. The
 * generation counter is the second half of that guarantee: abort is
 * best-effort, an ignored generation is not.
 */

/** Below this width a dropdown is worse than the real inbox, so we go there. */
const COMPACT_MAX_WIDTH = 640;

function fmt(template, count) {
  return String(template ?? "").replace("{count}", String(count));
}

export default function NotificationCenter({ isLoggedIn, isPractice }) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const t = useMemo(() => getMessages(language).notificationCenter ?? {}, [language]);

  /**
   * A stored notice title is written in one language and never revisited, so
   * showing it raw puts German text into a French header. The inbox pages
   * already solve this by preferring the translated catalogue and keeping the
   * stored text only as a fallback; the same resolution is used here rather
   * than a second one.
   *
   * The practice side has no such catalogue today — its own inbox page renders
   * the stored title too — so a practice notice still shows what was stored.
   */
  const inboxTitles = useMemo(
    () => (isPractice ? null : getMessages(language).patientInbox?.titles ?? null),
    [language, isPractice],
  );
  const titleOf = useCallback(
    (item) => inboxTitles?.[item.titleKey || item.type] || item.title,
    [inboxTitles],
  );

  const [open, setOpen] = useState(false);
  const [state, setState] = useState("idle"); // idle | loading | ready | error | unavailable
  const [summary, setSummary] = useState(null);
  const [practiceId, setPracticeId] = useState("");

  const panelRef = useRef(null);
  const toggleRef = useRef(null);
  const generationRef = useRef(0);
  /** Set when Escape closed the panel, so focus returns to where it came from. */
  const restoreFocusRef = useRef(false);
  const abortRef = useRef(null);

  const inboxPath = isPractice ? "/practice/inbox" : "/patient/inbox";

  // The practice the header speaks for. The URL wins when it names one, which
  // is what makes an A → B switch observable here at all.
  const urlPracticeId = useMemo(
    () => new URLSearchParams(location.search).get("practiceId") || "",
    [location.search],
  );

  useEffect(() => {
    if (!isLoggedIn || !isPractice) {
      setPracticeId("");
      return undefined;
    }
    if (urlPracticeId) {
      setPracticeId(urlPracticeId);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { ok, data } = await fetchMyPractices().catch(() => ({ ok: false, data: {} }));
      if (cancelled) return;
      const rows = ok && Array.isArray(data.practices) ? data.practices : [];
      if (rows.length > 0) {
        setPracticeId(rows[0].id);
        return;
      }
      // Practice mode without a practice — someone flipped the switch who has
      // none. There is nothing to load and nothing went wrong, so say so
      // rather than leaving a spinner running forever.
      setSummary(null);
      setState("empty");
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, isPractice, urlPracticeId]);

  const load = useCallback(async () => {
    if (!isLoggedIn) return;
    if (isPractice && !practiceId) return;

    // Drop the old context first — a stale panel is worse than an empty one.
    setSummary(null);
    setState("loading");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const generation = (generationRef.current += 1);
    const isCurrent = () => generationRef.current === generation;

    try {
      const { ok, status, data } = isPractice
        ? await fetchPracticeNotifications(practiceId, controller.signal)
        : await fetchPatientNotifications(controller.signal);
      if (!isCurrent()) return;
      if (!ok) {
        // 404 is the inbox feature being switched off. There is nothing to
        // show and nothing went wrong, so the entry simply is not there.
        setState(status === 404 ? "unavailable" : "error");
        return;
      }
      setSummary(data);
      setState("ready");
    } catch {
      // An abort is the expected outcome of a switch, not a failure.
      if (controller.signal.aborted || !isCurrent()) return;
      setState("error");
    }
  }, [isLoggedIn, isPractice, practiceId]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  // A mode or practice switch must not leave the old panel hanging open.
  //
  // "Switch" means one practice replacing another. The first id arriving after
  // load is not a switch, and closing on it would slam the panel shut in the
  // user's face whenever they open it before /api/practices has answered.
  const lastPracticeRef = useRef("");
  useEffect(() => {
    const previous = lastPracticeRef.current;
    lastPracticeRef.current = practiceId;
    if (previous && practiceId && previous !== practiceId) setOpen(false);
  }, [practiceId]);

  useEffect(() => {
    setOpen(false);
  }, [isPractice, location.pathname]);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(e) {
      const target = e.target;
      if (panelRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      // Focus is restored AFTER the panel is gone, not here. Calling focus()
      // synchronously puts it on the toggle while the panel is still mounted;
      // React then unmounts the panel, the browser sees focus inside a removed
      // subtree and drops it to <body>. The keyboard user is left with no
      // position at all, which is exactly what Escape must not do.
      restoreFocusRef.current = true;
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector("a, button")?.focus();
  }, [open, state]);

  // The panel has been removed by the time this runs, so the toggle is a
  // stable target and focus stays where a keyboard user expects it.
  useEffect(() => {
    if (open || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    toggleRef.current?.focus();
  }, [open]);

  if (!isLoggedIn || state === "unavailable") return null;

  const count = isPractice ? (summary?.newInboxCount ?? 0) : (summary?.unreadInboxCount ?? 0);
  const items = Array.isArray(summary?.items) ? summary.items : [];
  // Absent, not zero, when this role may not read follow-ups — so the panel
  // gives no hint that follow-ups are kept here at all.
  const reminderCount = isPractice ? summary?.openReminderCount : undefined;
  const remindersPath = summary?.remindersPath;

  const countLabel = isPractice
    ? count === 1
      ? t.newOne
      : fmt(t.newLabel, count)
    : count === 1
      ? t.unreadOne
      : fmt(t.unreadLabel, count);

  function handleToggle() {
    if (typeof window !== "undefined" && window.innerWidth <= COMPACT_MAX_WIDTH) {
      // On a phone the real inbox is the better surface; same destination the
      // panel's own link would take, just without the cramped middle step.
      navigate(inboxPath);
      return;
    }
    setOpen((v) => !v);
    if (!open) load();
  }

  function go(path) {
    setOpen(false);
    if (path) navigate(path);
  }

  return (
    <div className="ms-notif">
      <button
        ref={toggleRef}
        type="button"
        className={`ms-notif__toggle${open ? " is-open" : ""}`}
        aria-expanded={open ? "true" : "false"}
        aria-controls="ms-notif-panel"
        aria-haspopup="dialog"
        aria-label={count > 0 ? fmt(t.toggleAriaWithCount, count) : t.toggleAria}
        title={t.toggleLabel}
        onClick={handleToggle}
      >
        <Inbox size={20} strokeWidth={2.25} aria-hidden="true" />
        {count > 0 && (
          // The number itself carries the meaning; colour only reinforces it.
          <span className="ms-notif__badge" aria-hidden="true">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          id="ms-notif-panel"
          className="ms-notif__panel"
          role="dialog"
          aria-label={isPractice ? t.panelTitlePractice : t.panelTitle}
        >
          <div className="ms-notif__head">
            <span className="ms-notif__title">
              {isPractice ? t.panelTitlePractice : t.panelTitle}
            </span>
            {count > 0 && <span className="ms-notif__count">{countLabel}</span>}
          </div>

          {state === "loading" && <p className="ms-notif__msg">{t.loading}</p>}

          {state === "error" && (
            <p className="ms-notif__msg">
              {t.error}{" "}
              <button type="button" className="ms-notif__linkbtn" onClick={load}>
                {t.retry}
              </button>
            </p>
          )}

          {(state === "empty" || (state === "ready" && items.length === 0)) && (
            <p className="ms-notif__msg">
              {t.empty}
              <span className="ms-notif__hint">{t.emptyHint}</span>
            </p>
          )}

          {state === "ready" && items.length > 0 && (
            <ul className="ms-notif__list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="ms-notif__item"
                    onClick={() => go(item.targetUrl || inboxPath)}
                  >
                    <span className="ms-notif__item-title">{titleOf(item)}</span>
                    {item.patientLabel && (
                      <span className="ms-notif__item-meta">{item.patientLabel}</span>
                    )}
                    {item.unread && (
                      <span className="ms-notif__item-state">{t.itemUnread}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button type="button" className="ms-notif__all" onClick={() => go(inboxPath)}>
            {t.showAll}
          </button>

          {reminderCount !== undefined && (
            // Deliberately below the divider and never counted in the badge:
            // this is work in the patient overview, not mail in the inbox.
            <div className="ms-notif__reminders">
              <span className="ms-notif__reminders-head">{t.remindersHeading}</span>
              <span className="ms-notif__reminders-count">
                {reminderCount === 0
                  ? t.remindersNone
                  : reminderCount === 1
                    ? t.remindersOne
                    : fmt(t.remindersCount, reminderCount)}
              </span>
              {reminderCount > 0 && remindersPath && (
                <button
                  type="button"
                  className="ms-notif__linkbtn"
                  onClick={() => go(remindersPath)}
                >
                  {t.remindersLink}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
