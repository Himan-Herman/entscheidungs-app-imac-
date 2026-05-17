export default function PracticeFinderSkeleton({ label, count = 3 }) {
  return (
    <div className="pf-skeleton-list" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="pf-skeleton-card" aria-hidden />
      ))}
    </div>
  );
}
