import "./ProvenanceBadge.css";

/**
 * Where one medical record came from, from the patient's point of view.
 *
 * Three states, never blurred into each other:
 *   patient_global      → the patient's own data
 *   practice_contextual → recorded in one named care relationship
 *   anything else       → explicitly "unavailable", NEVER silently global
 *
 * The context link id is used to look the practice up; it is never rendered and
 * never written into a data attribute.
 *
 * @param {{
 *   practiceContextState?: string | null,
 *   dataScope?: string | null,
 *   contextPracticePatientLinkId?: string | null,
 *   archivedPractice?: { displayName?: string|null, specialty?: string|null, archivedAt?: string|null } | null,
 *   source?: string | null,
 *   language?: string,
 *   resolve: (linkId: string | null | undefined) => { resolved: boolean, label: string },
 *   t: Record<string, any>,
 * }} props
 */
export default function ProvenanceBadge({
  practiceContextState,
  dataScope,
  contextPracticePatientLinkId,
  archivedPractice,
  source,
  language,
  resolve,
  t,
}) {
  const p = t?.provenance ?? {};
  // The server states the context; dataScope is the fallback for a response
  // from before that field existed.
  const state = practiceContextState
    ?? (dataScope === "patient_global" ? "none" : dataScope === "practice_contextual" ? "active" : null);

  // A practice that was deleted. Named where a snapshot exists, and honest
  // about being former either way — never shown as if it were still active.
  if (state === "archived") {
    const name = archivedPractice?.displayName?.trim();
    const label = name
      ? (p.archivedWith || "{practice}").replace("{practice}", name)
      : p.archived;
    const when = formatArchivedAt(archivedPractice?.archivedAt, language);
    return (
      <span className="provenance-badge provenance-badge--archived" aria-label={label}>
        <span className="provenance-badge__dot" aria-hidden="true" />
        {label}
        {when ? (
          <span className="provenance-badge__meta">
            {" · "}
            {(p.archivedOn || "{date}").replace("{date}", when)}
          </span>
        ) : null}
      </span>
    );
  }

  if (state === "none") {
    // The record model distinguishes a manual entry from a personal device
    // import. Where it does not, we say the neutral thing rather than invent a
    // more specific origin.
    const label =
      source === "import" ? p.deviceImport : source === "manual" ? p.selfEntered : p.own;
    return (
      <span className="provenance-badge provenance-badge--own">
        <span className="provenance-badge__dot" aria-hidden="true" />
        {label || p.own}
      </span>
    );
  }

  if (state === "active") {
    const { resolved, label } = resolve(contextPracticePatientLinkId);
    if (resolved) {
      return (
        <span className="provenance-badge provenance-badge--practice">
          <span className="provenance-badge__dot" aria-hidden="true" />
          {(p.contextWith || "{practice}").replace("{practice}", label)}
        </span>
      );
    }
    return (
      <span className="provenance-badge provenance-badge--unknown" title={p.unavailableHint}>
        <span className="provenance-badge__dot" aria-hidden="true" />
        {p.contextUnavailable}
      </span>
    );
  }

  // Unclassified legacy data. Saying "your own data" here would be a claim we
  // cannot support, so the badge stays honest about not knowing.
  return (
    <span className="provenance-badge provenance-badge--unknown" title={p.unavailableHint}>
      <span className="provenance-badge__dot" aria-hidden="true" />
      {p.contextUnavailable}
    </span>
  );
}

/**
 * The archive date, or nothing.
 *
 * A date that cannot be localised is left out rather than shown raw: an
 * unreadable timestamp next to a practice name is noise, not information.
 */
function formatArchivedAt(value, language) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(language || "de", {
      year: "numeric", month: "2-digit", day: "2-digit",
    });
  } catch {
    return "";
  }
}
