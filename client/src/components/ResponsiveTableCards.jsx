/**
 * Wraps a data table + mobile card list with shared responsive CSS.
 * @param {{ caption?: string, table: import('react').ReactNode, cards: import('react').ReactNode, className?: string }} props
 */
export default function ResponsiveTableCards({ caption, table, cards, className = "" }) {
  return (
    <div className={`ms-responsive-list ${className}`.trim()}>
      <div className="ms-responsive-list__table-wrap practice-patients__table-wrap">
        {table}
      </div>
      <div
        className="ms-responsive-list__cards practice-patients__cards"
        aria-label={caption}
        role={caption ? "list" : undefined}
      >
        {cards}
      </div>
    </div>
  );
}
