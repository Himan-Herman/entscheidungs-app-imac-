/**
 * Setup — informational only; does not enable cloud or sync (Phase 3.3).
 * @param {{ labels: object; canUseCloud: boolean }} props
 */
export default function InterpreterCloudSetupNote({ labels: t, canUseCloud }) {
  if (!canUseCloud) return null;

  return (
    <section
      className="interpreter-cloud-setup-note"
      aria-labelledby="interp-cloud-setup-note-heading"
    >
      <h2 id="interp-cloud-setup-note-heading" className="interpreter-live__section-title">
        {t.cloud.setupHeading}
      </h2>
      <p className="interpreter-cloud-setup-note__body">{t.cloud.setupBody}</p>
      <p className="interpreter-cloud-setup-note__hint" role="note">
        {t.cloud.setupHint}
      </p>
    </section>
  );
}
