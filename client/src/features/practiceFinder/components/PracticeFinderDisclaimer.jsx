export default function PracticeFinderDisclaimer({ notice, sub }) {
  return (
    <aside className="pf-disclaimer" role="note" aria-labelledby="pf-disclaimer-title">
      <p id="pf-disclaimer-title" className="pf-disclaimer__title">
        {notice}
      </p>
      {sub ? <p className="pf-disclaimer__sub">{sub}</p> : null}
    </aside>
  );
}
