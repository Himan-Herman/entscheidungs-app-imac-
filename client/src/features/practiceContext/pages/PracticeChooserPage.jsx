import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePracticeContexts } from "../hooks/usePracticeContexts.js";
import {
  filterPracticeContexts,
  sortPracticeContexts,
  splitByRelationship,
} from "../lib/practiceContextList.js";
import { readLastUsedPracticeLinkId } from "../lib/lastUsedPractice.js";
import PracticeCard from "../components/PracticeCard.jsx";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import "../practiceContext.css";

/** Show the search field only once a list is long enough to need it. */
const SEARCH_THRESHOLD = 6;

/**
 * The patient's practices — the entry point to every practice-scoped area.
 *
 * Stays a chooser, not a gate: /patient remains patient-global, and nothing
 * here claims ownership of the patient's own data.
 */
export default function PracticeChooserPage() {
  const { contexts, loading, error, reload } = usePracticeContexts();
  const { language } = useLanguage();
  const t = getMessages(language).practiceContext || getMessages("en").practiceContext;

  const [query, setQuery] = useState("");
  const lastUsed = useMemo(() => readLastUsedPracticeLinkId(), []);

  const { active, former } = useMemo(() => {
    const filtered = filterPracticeContexts(contexts, query, t);
    const sorted = sortPracticeContexts(filtered, { lastUsedLinkId: lastUsed });
    return splitByRelationship(sorted);
    // `t` belongs here — see the note in PracticeSwitcherDialog.
  }, [contexts, query, lastUsed, t]);

  const showSearch = contexts.length >= SEARCH_THRESHOLD;
  const nothingMatched = query.trim() !== "" && active.length === 0 && former.length === 0;

  return (
    <div className="practice-chooser">
      <header className="practice-chooser__header">
        <h1 className="practice-chooser__title">{t.chooserTitle}</h1>
        <p className="practice-chooser__intro">{t.chooserIntro}</p>
      </header>

      {loading ? (
        <p className="practice-context__state" role="status" aria-live="polite">
          {t.loading}
        </p>
      ) : null}

      {error ? (
        <div className="practice-context__state" role="alert">
          <p>{t.errorBody}</p>
          <button type="button" onClick={reload} className="practice-chooser__retry">
            {t.retry}
          </button>
        </div>
      ) : null}

      {!loading && !error && contexts.length === 0 ? (
        // No invented "add practice" button: that flow is not built yet, and a
        // control that does nothing is worse than none.
        <div className="practice-chooser__empty">
          <p className="practice-chooser__empty-title">{t.emptyTitle}</p>
          <p>{t.emptyBody}</p>
        </div>
      ) : null}

      {showSearch ? (
        <div className="practice-chooser__search">
          <label htmlFor="practice-search">{t.searchLabel}</label>
          <input
            id="practice-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            autoComplete="off"
          />
        </div>
      ) : null}

      {nothingMatched ? (
        <p className="practice-context__state" role="status">
          {t.searchNoResults}
        </p>
      ) : null}

      {active.length > 0 ? (
        <ul className="practice-card__list" aria-label={t.chooserTitle}>
          {active.map((c) => (
            <PracticeCard key={c.linkId} context={c} t={t} href={`/patient/practice/${c.linkId}`} />
          ))}
        </ul>
      ) : null}

      {/*
        Cross-practice functions that are not yet scoped to one relationship.
        Kept reachable rather than orphaned; each moves into the practice
        context as its API gains a link scope.
      */}
      {!loading && !error ? (
        <p className="practice-chooser__crosslink">
          <Link to="/patient/practice-overview">{t.crossPracticeLink}</Link>
        </p>
      ) : null}

      {former.length > 0 ? (
        <section className="practice-chooser__former">
          <h2 className="practice-chooser__section-title">{t.formerTitle}</h2>
          <p className="practice-chooser__section-hint">{t.formerHint}</p>
          <ul className="practice-card__list" aria-label={t.formerTitle}>
            {former.map((c) => (
              <PracticeCard
                key={c.linkId}
                context={c}
                t={t}
                href={`/patient/practice/${c.linkId}`}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
