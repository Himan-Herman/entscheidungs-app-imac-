import { useEffect, useRef } from "react";

/**
 * @returns {import('react').RefObject<boolean>}
 */
export function useMountedRef() {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return mountedRef;
}
