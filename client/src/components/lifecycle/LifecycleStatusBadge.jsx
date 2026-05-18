/**
 * @param {{ status: string, t: Record<string, string> }} props
 */
export default function LifecycleStatusBadge({ status, t }) {
  const s = String(status || "").toLowerCase();
  let label = t.statusActive;
  let className = "lifecycle-badge lifecycle-badge--active";

  if (s === "archived") {
    label = t.statusArchived;
    className = "lifecycle-badge lifecycle-badge--archived";
  } else if (s === "deleted") {
    label = t.statusDeleted;
    className = "lifecycle-badge lifecycle-badge--deleted";
  } else if (s === "revoked") {
    label = t.statusRevoked;
    className = "lifecycle-badge lifecycle-badge--revoked";
  } else if (s === "shared" || s === "published" || s === "open" || s === "active") {
    label = t.statusActive;
    className = "lifecycle-badge lifecycle-badge--active";
  }

  return (
    <span className={className} role="status">
      {label}
    </span>
  );
}
