import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchPatientPracticeLinks } from "../../careRelationship/api/patientPracticeLinksApi.js";
import { practiceDisplayLabel } from "../../../utils/groupByPracticeBranding.js";

/**
 * Resolves a record's context to a practice the PATIENT is connected to.
 *
 * The only permitted key is the link id the server put on the record. A practice
 * is never inferred from a specialty, a name, a date, an appointment or a user
 * id — an entry whose link is not among the patient's own connections stays
 * explicitly unresolved rather than being shown as global.
 */
export function usePracticeContextIndex() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPatientPracticeLinks({});
      if (!aliveRef.current) return;
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setLinks(Array.isArray(data.links) ? data.links : []);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      if (aliveRef.current) setError("load_failed");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void load();
    return () => { aliveRef.current = false; };
  }, [load]);

  const byId = useMemo(() => {
    const map = new Map();
    for (const link of links) {
      if (link?.id) map.set(link.id, link);
    }
    return map;
  }, [links]);

  /**
   * @param {string | null | undefined} linkId
   * @returns {{ resolved: boolean, label: string, linkId: string | null }}
   */
  const resolve = useCallback((linkId) => {
    const id = typeof linkId === "string" ? linkId.trim() : "";
    if (!id) return { resolved: false, label: "", linkId: null };
    const link = byId.get(id);
    const label = practiceDisplayLabel(link?.practice);
    // A link we do not hold, or one without a usable name, is NOT resolvable.
    if (!link || !label) return { resolved: false, label: "", linkId: null };
    return { resolved: true, label, linkId: id };
  }, [byId]);

  const activeLinks = useMemo(
    () => links.filter((l) => l.status === "active"),
    [links],
  );
  const inactiveLinks = useMemo(
    () => links.filter((l) => l.status !== "active"),
    [links],
  );

  return { links, activeLinks, inactiveLinks, resolve, loading, error, reload: load };
}
