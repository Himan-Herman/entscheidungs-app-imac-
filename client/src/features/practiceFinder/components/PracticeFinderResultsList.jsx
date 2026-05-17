import PracticeFinderResultCard from "./PracticeFinderResultCard.jsx";
import PracticeFinderSkeleton from "./PracticeFinderSkeleton.jsx";

export default function PracticeFinderResultsList({
  t,
  results,
  loading,
  hasSearched,
  demoMode,
  onLoadMore,
  hasMore,
}) {
  if (loading && !results.length) {
    return <PracticeFinderSkeleton label={t.skeletonAria} />;
  }

  if (hasSearched && !loading && results.length === 0) {
    return (
      <div className="pf-empty" role="status">
        <p className="pf-empty__title">{t.emptyTitle}</p>
        <p className="pf-empty__hint">{t.emptyHint}</p>
      </div>
    );
  }

  if (!results.length) return null;

  return (
    <section className="pf-results" aria-labelledby="pf-results-heading">
      <h2 id="pf-results-heading" className="pf-results__heading">
        {t.resultsHeading}
      </h2>
      {demoMode ? (
        <p className="pf-results__demo" role="status">
          {t.demoBanner}
        </p>
      ) : null}
      <p className="pf-results__sort-note">{t.sortNotice}</p>
      <ul className="pf-results__list">
        {results.map((item) => (
          <li key={item.placeId}>
            <PracticeFinderResultCard item={item} t={t} />
          </li>
        ))}
      </ul>
      {loading && results.length > 0 ? (
        <p className="pf-results__loading-inline" role="status" aria-live="polite">
          {t.searching}
        </p>
      ) : null}
      {hasMore ? (
        <button
          type="button"
          className="pf-btn pf-btn--secondary pf-results__more"
          onClick={onLoadMore}
          disabled={loading}
        >
          {t.loadMore}
        </button>
      ) : null}
    </section>
  );
}
