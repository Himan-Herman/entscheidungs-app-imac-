import { useCallback, useEffect, useState } from "react";
import { usePracticeContext } from "../usePracticeContext.js";
import { useScopedRequest } from "../hooks/useScopedRequest.js";
import {
  fetchScopedErezept,
  updateScopedErezeptStatus,
} from "../api/scopedErezeptApi.js";
import ErezeptCard from "../../erezept/components/ErezeptCard.jsx";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
// The stylesheet the cross-practice prescription page already uses — this is a
// context migration of that view, not a new prescription UI.
import "../../erezept/styles/Erezept.css";

/**
 * e-Prescriptions of one care relationship (Phase 2F.1).
 *
 * Shows the prescriptions THIS practice issued to the patient, and nothing
 * else: not another practice's, and not those of another link to the same
 * practice. `ErezeptEntry.linkId` has no foreign key, so an entry whose link
 * field names nothing cannot appear here either — the server matches on the
 * authorized link's id, and a value that names nothing matches nothing.
 *
 * The patient keeps exactly the right they already had: marking a prescription
 * as taken to the pharmacy or as redeemed. Issuing and cancelling belong to the
 * practice side and are not reachable from here.
 *
 * Nothing on this page interprets a prescription. Medication names, dosages and
 * instructions are rendered as the practice entered them.
 */
export default function PracticeContextErezeptPage() {
  const { linkId, isActiveRelationship } = usePracticeContext();
  const { run } = useScopedRequest(linkId);
  const { language } = useLanguage();
  const t = getMessages(language).erezept || getMessages("en").erezept;
  const tc = getMessages(language).practiceContext || getMessages("en").practiceContext;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const outcome = await run(
        ({ signal }) => fetchScopedErezept(linkId, { signal }),
        ({ res, data }) => {
          if (!res.ok || !data.ok) {
            setEntries([]);
            setError(res.status === 404 ? tc.notFoundBody : t.loadingError);
            return;
          }
          setEntries(Array.isArray(data.entries) ? data.entries : []);
        },
      );
      if (!outcome.applied) return;
    } catch {
      setEntries([]);
      setError(t.loadingError);
    } finally {
      setLoading(false);
    }
  }, [linkId, run, t.loadingError, tc.notFoundBody]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * The list can be a moment out of date, so a refused update is a normal
   * outcome rather than a bug — the server decides again on this request.
   */
  const changeStatus = async (entryId, status) => {
    setSaving(true);
    setError("");
    try {
      await run(
        ({ signal }) => updateScopedErezeptStatus(linkId, entryId, status, { signal }),
        ({ res, data }) => {
          if (!res.ok || !data.ok) {
            setError(t.loadingError);
            load();
            return;
          }
          setEntries((prev) =>
            prev.map((e) => (e.id === data.entry.id ? { ...e, ...data.entry } : e)),
          );
        },
      );
    } catch {
      setError(t.loadingError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="practice-context erx-page">
      <h1 className="practice-context__title">{tc.erezeptTitle}</h1>
      <p className="erx-page__intro">{tc.erezeptScopeNote}</p>
      {/* The product's own wording: a simulated prescription, no TI proof. */}
      <p className="erx-page__disclaimer">{t.disclaimer}</p>

      {loading ? (
        <p className="practice-context__state" role="status" aria-live="polite">
          {t.loading || tc.loading}
        </p>
      ) : null}

      {error ? (
        <p className="practice-context__state" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && entries.length === 0 ? (
        <p className="practice-context__state">{tc.erezeptEmpty}</p>
      ) : null}

      {!loading && entries.length > 0 ? (
        <div className="erx-cards" data-testid="scoped-erezept-list">
          {entries.map((entry) => (
            <ErezeptCard
              key={entry.id}
              entry={entry}
              t={t}
              language={language}
              saving={saving}
              // A relationship that has ended can still be read, not acted on.
              readOnly={!isActiveRelationship}
              // The card supplies the entry id itself — same contract as the
              // cross-practice page, so the component stays untouched.
              onStatusUpdate={changeStatus}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
