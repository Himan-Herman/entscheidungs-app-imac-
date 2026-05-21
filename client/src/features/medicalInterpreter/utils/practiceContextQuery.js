import { useSearchParams } from "react-router-dom";

/**
 * Practice id from ?practiceId= (same convention as /practice/inbox, telemedicine, etc.).
 * @returns {string}
 */
export function usePracticeIdFromQuery() {
  const [searchParams] = useSearchParams();
  return String(searchParams.get("practiceId") || "").trim();
}

/**
 * @param {string} practiceId
 * @param {string} path
 */
export function practiceInterpreterPath(path, practiceId) {
  const base = path.startsWith("/") ? path : `/${path}`;
  if (!practiceId) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}practiceId=${encodeURIComponent(practiceId)}`;
}
