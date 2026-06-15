import { useEffect, useState } from 'react';
import { fetchPracticeSettings } from '../../practiceSettings/api/practiceSettingsApi.js';

/**
 * Loads practice master data for the Meda practice variant and maps it to the
 * EMPTY_PRACTICE_INFO shape used by the setup form.
 *
 * Read-only, best-effort prefill:
 *  - Runs only when a non-empty practiceId is passed (patient variant passes none).
 *  - Uses the existing GET /api/practice/settings endpoint (no new server code).
 *  - On any error / missing data it resolves to data = null and never throws —
 *    the form then simply stays manual (unchanged behaviour).
 *  - doctorName is intentionally NOT prefilled here (would require the team
 *    endpoint + TEAM_VIEW permission) — it stays a manual field for now.
 *
 * @param {string|null|undefined} practiceId
 * @returns {{ practiceData: object|null, loading: boolean }}
 */
export function usePracticeProfilePrefill(practiceId) {
  const [practiceData, setPracticeData] = useState(/** @type {object|null} */ (null));
  const [loading,      setLoading]      = useState(Boolean(practiceId));

  useEffect(() => {
    // No practiceId → nothing to load; keep form manual.
    if (!practiceId) {
      setPracticeData(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    fetchPracticeSettings(practiceId)
      .then(({ res, data }) => {
        if (!active) return;
        const s = (res?.ok && data?.settings) ? data.settings : null;
        if (!s) {
          setPracticeData(null);
          return;
        }

        // Map only practice master data. doctorName is left out on purpose.
        setPracticeData({
          practiceName: String(s.practiceName || '').trim(),
          department:   String(s.specialty    || '').trim(),
          street:       String(s.street || s.address || '').trim(),
          postalCode:   String(s.postalCode   || '').trim(),
          city:         String(s.city         || '').trim(),
          country:      String(s.country      || '').trim(),
          phone:        String(s.phone        || '').trim(),
          email:        String(s.email        || '').trim(),
        });
      })
      .catch(() => {
        if (active) setPracticeData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [practiceId]);

  return { practiceData, loading };
}
