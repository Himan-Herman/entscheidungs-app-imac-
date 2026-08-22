import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPracticeContexts } from "../api/practiceDirectoryApi.js";

/**
 * Loads the patient's own practice contexts.
 *
 * Patient-global data: it describes the relationships themselves, not any one
 * practice's content, so it is NOT tied to an active context and a practice
 * switch must not invalidate it.
 */
export function usePracticeContexts() {
  const [contexts, setContexts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticeContexts();
      if (!aliveRef.current) return;
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setContexts(Array.isArray(data.contexts) ? data.contexts : []);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      if (aliveRef.current) {
        setContexts([]);
        setError("load_failed");
      }
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void load();
    return () => {
      aliveRef.current = false;
    };
  }, [load]);

  return { contexts, loading, error, reload: load };
}
