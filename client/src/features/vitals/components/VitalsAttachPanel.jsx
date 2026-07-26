import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { fetchVitals } from "../api/vitalsApi.js";
import {
  buildVitalsSnapshot,
  formatSnapshotLines,
} from "../lib/vitalsSnapshot.js";

/**
 * Opt-in: attach the patient's current measurements to the Pre-Visit document.
 *
 * Explicit, revocable consent (Art. 9 GDPR) — default OFF. Once the patient opts in,
 * the snapshot is assembled and attached automatically; they never retype anything.
 * Renders nothing when the vitals module is disabled or the patient has no readings,
 * so the Pre-Visit page is unchanged for everyone else.
 *
 * Documentation only — no diagnosis, no assessment, no interpretation.
 */
export default function VitalsAttachPanel({ t, typeLabels, locale, onChange }) {
  const [available, setAvailable] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchVitals({ limit: 200 });
      if (res.status === 404 && data?.error === "feature_disabled") return;
      if (!res.ok || !data?.ok) throw new Error("load_failed");
      const snap = buildVitalsSnapshot(data.entries);
      if (snap) {
        setSnapshot(snap);
        setAvailable(true);
      }
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      // Stay silent and hidden: this panel is optional and must never block the document.
      setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Withdraw the attachment if this panel ever unmounts while opted in.
  useEffect(() => () => { onChange?.(null); }, [onChange]);

  function handleToggle(next) {
    setChecked(next);
    setError("");
    try {
      onChange?.(next ? snapshot : null);
    } catch {
      setChecked(false);
      setError(t.attachError);
    }
  }

  if (loading || !available || !t) return null;

  const lines = formatSnapshotLines(snapshot, {
    typeLabels,
    locale,
    importedLabel: t.importedLabel,
  });

  return (
    <section className="vitals-attach" aria-labelledby="vitals-attach-heading">
      <h2 id="vitals-attach-heading" className="vitals-attach__heading">
        <Activity size={18} aria-hidden="true" />
        {t.heading}
      </h2>
      <p className="vitals-attach__intro">{t.intro}</p>

      <label className="vitals-attach__check">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <span>{t.consent}</span>
      </label>

      {checked && (
        <div className="vitals-attach__preview">
          <p className="vitals-attach__preview-title">{t.previewTitle}</p>
          <ul className="vitals-attach__list">
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <p className="vitals-attach__note">{t.minimisationNote}</p>
        </div>
      )}

      {error && <p className="vitals-attach__error" role="alert">{error}</p>}
    </section>
  );
}
