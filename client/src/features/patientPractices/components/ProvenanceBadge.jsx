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
 *   dataScope?: string | null,
 *   contextPracticePatientLinkId?: string | null,
 *   source?: string | null,
 *   resolve: (linkId: string | null | undefined) => { resolved: boolean, label: string },
 *   t: Record<string, any>,
 * }} props
 */
export default function ProvenanceBadge({
  dataScope,
  contextPracticePatientLinkId,
  source,
  resolve,
  t,
}) {
  const p = t?.provenance ?? {};

  if (dataScope === "patient_global") {
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

  if (dataScope === "practice_contextual") {
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
