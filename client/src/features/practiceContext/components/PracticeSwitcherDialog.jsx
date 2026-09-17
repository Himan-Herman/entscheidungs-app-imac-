import { useMemo, useState } from "react";
import FocusModal from "../../patientPractices/components/FocusModal.jsx";
import { usePracticeContexts } from "../hooks/usePracticeContexts.js";
import { filterPracticeContexts, sortPracticeContexts } from "../lib/practiceContextList.js";
import PracticeAvatar from "./PracticeAvatar.jsx";
import { patientContextLabel } from "../lib/patientContextLabel.js";

const SEARCH_THRESHOLD = 6;

/**
 * Switch to another connected practice.
 *
 * Built on the existing FocusModal, which already provides the focus trap, the
 * Escape handling and — importantly — focus restoration to the control that
 * opened it. The same responsive dialog serves desktop and mobile rather than a
 * separate bottom-sheet stack that would have to be maintained and tested twice.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onSelect: (linkId: string) => void,
 *   currentLinkId: string,
 *   t: Record<string, string>,
 * }} props
 */
export default function PracticeSwitcherDialog({ open, onClose, onSelect, currentLinkId, t }) {
  const { contexts, loading } = usePracticeContexts();
  const [query, setQuery] = useState("");

  const list = useMemo(
    () => sortPracticeContexts(filterPracticeContexts(contexts, query, t)),
    // `t` belongs here: getMessages() builds a fresh object per call, so the
    // search would keep using the previous language's wording otherwise. The
    // list is a handful of entries, so recomputing costs nothing.
    [contexts, query, t],
  );

  const showSearch = contexts.length >= SEARCH_THRESHOLD;

  return (
    <FocusModal
      open={open}
      onClose={onClose}
      titleId="practice-switcher-title"
      title={t.switchTitle}
    >
      {showSearch ? (
        <div className="practice-chooser__search">
          <label htmlFor="practice-switch-search">{t.searchLabel}</label>
          <input
            id="practice-switch-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            autoComplete="off"
          />
        </div>
      ) : null}

      {loading ? (
        <p className="practice-context__state" role="status" aria-live="polite">
          {t.loading}
        </p>
      ) : null}

      <ul className="practice-switcher__list">
        {list.map((c) => {
          const isCurrent = c.linkId === currentLinkId;
          const name = c.practice?.displayName || t.unnamedPractice;
          const details = [c.practice?.specialty, c.practice?.city].filter(Boolean).join(" · ");
          const forWhom = patientContextLabel(c.patientProfileName, t);

          return (
            <li key={c.linkId}>
              <button
                type="button"
                className={`practice-switcher__option${
                  isCurrent ? " practice-switcher__option--current" : ""
                }`}
                // The current practice is stated, not merely highlighted.
                aria-current={isCurrent ? "true" : undefined}
                aria-label={[
                  name,
                  forWhom,
                  details,
                  isCurrent ? t.switchCurrent : null,
                  c.unreadCount > 0
                    ? t.unreadAria.replace("{count}", String(c.unreadCount))
                    : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
                onClick={() => (isCurrent ? onClose() : onSelect(c.linkId))}
              >
                <PracticeAvatar practice={c.practice} />
                <span className="practice-switcher__body">
                  <span className="practice-card__name">{name}</span>
                  <span className="practice-card__for">{forWhom}</span>
                  {details ? <span className="practice-card__details">{details}</span> : null}
                  {isCurrent ? (
                    <span className="practice-switcher__current-label">{t.switchCurrent}</span>
                  ) : null}
                </span>
                {c.unreadCount > 0 ? (
                  <span className="practice-card__badge" aria-hidden="true">
                    {c.unreadCount > 99 ? "99+" : c.unreadCount} {t.unreadShort}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </FocusModal>
  );
}
