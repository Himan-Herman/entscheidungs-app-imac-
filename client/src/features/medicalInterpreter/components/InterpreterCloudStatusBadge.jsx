/**
 * @param {{
 *   variant: 'local' | 'synced' | 'stale' | 'cloudOnly';
 *   label: string;
 * }} props
 */
export default function InterpreterCloudStatusBadge({ variant, label }) {
  return (
    <span
      className={`interpreter-cloud-badge interpreter-cloud-badge--${variant}`}
      title={label}
    >
      <span className="interpreter-cloud-badge__icon" aria-hidden="true">
        {variant === "local" ? "●" : variant === "stale" ? "◐" : "☁"}
      </span>
      <span className="interpreter-cloud-badge__text">{label}</span>
    </span>
  );
}
