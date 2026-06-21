import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../api/authFetch.js";
import { readUserMode, USER_MODES } from "../utils/userMode.js";
import {
  patientInitials,
  practiceInitials,
  resolvePatientName,
} from "../utils/accountIdentity.js";

/**
 * Resolves the lightweight identity shown in the header account avatar:
 * full display name, avatar image, and normalized dotted initials.
 *
 * Data sources (reuse existing endpoints):
 *  - patient  → GET /api/account/patient-settings  (name + avatarUrl)
 *  - practice → GET /api/practices                 (practiceName + logoUrl)
 *
 * Image paths served by the API (`/api/...`) require the Authorization header,
 * so a plain <img src> would 401. We fetch them via authFetch and expose an
 * object URL instead; external http(s) URLs are used directly. A tiny
 * localStorage cache (path + initials + name, never the blob) paints initials
 * instantly while the image and a fresh copy load in the background.
 *
 * @param {boolean} isLoggedIn
 * @param {string} userMode  USER_MODES.PATIENT | USER_MODES.PRACTICE
 */
const CACHE_PREFIX = "medscoutx_identity_";
export const IDENTITY_CHANGED_EVENT = "medscoutx_identity_changed";

function readCache(mode) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + mode);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(mode, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + mode, JSON.stringify(value));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

const EMPTY = { displayName: "", imagePath: "", initials: "" };

export function useAccountIdentity(isLoggedIn, userMode) {
  const mode = userMode === USER_MODES.PRACTICE ? "practice" : "patient";
  const [identity, setIdentity] = useState(() =>
    isLoggedIn ? readCache(mode) ?? EMPTY : EMPTY,
  );
  const [imageSrc, setImageSrc] = useState("");
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!isLoggedIn) {
      setIdentity(EMPTY);
      return;
    }

    const myReq = ++reqIdRef.current;
    setLoading(true);

    // Paint cached value immediately (if any) while we refresh.
    const cached = readCache(mode);
    if (cached) setIdentity(cached);

    try {
      let next = EMPTY;

      if (mode === "practice") {
        const res = await authFetch("/api/practices");
        if (!res.ok) throw new Error("request_failed");
        const j = await res.json().catch(() => ({}));
        const list = Array.isArray(j?.practices) ? j.practices : [];
        const wantedId = new URLSearchParams(window.location.search).get(
          "practiceId",
        );
        const active =
          (wantedId && list.find((p) => p.id === wantedId)) || list[0] || null;
        const name = (active?.practiceName || "").trim();
        next = {
          displayName: name,
          imagePath: (active?.logoUrl || "").trim(),
          initials: practiceInitials(name, "PR"),
        };
      } else {
        const res = await authFetch("/api/account/patient-settings");
        if (!res.ok) throw new Error("request_failed");
        const j = await res.json().catch(() => ({}));
        const user = j?.user || {};
        const profile = j?.profile || {};
        next = {
          displayName: resolvePatientName(user, profile),
          imagePath: (j?.avatarUrl || "").trim(),
          initials: patientInitials(user, profile, "P"),
        };
      }

      if (reqIdRef.current !== myReq) return; // a newer request superseded us
      setIdentity(next);
      writeCache(mode, next);
    } catch {
      // SESSION_EXPIRED already redirects in authFetch; otherwise keep cache.
      if (reqIdRef.current === myReq && !cached) setIdentity(EMPTY);
    } finally {
      if (reqIdRef.current === myReq) setLoading(false);
    }
  }, [isLoggedIn, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh on area switch or after the user uploads/removes their image.
  useEffect(() => {
    function onChange() {
      void load();
    }
    window.addEventListener("medscoutx_user_mode_changed", onChange);
    window.addEventListener(IDENTITY_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener("medscoutx_user_mode_changed", onChange);
      window.removeEventListener(IDENTITY_CHANGED_EVENT, onChange);
    };
  }, [load]);

  // Resolve the image path to a usable <img> src.
  const imagePath = identity?.imagePath || "";
  useEffect(() => {
    if (!imagePath) {
      setImageSrc("");
      return undefined;
    }
    if (/^https?:\/\//i.test(imagePath)) {
      setImageSrc(imagePath); // external URL — usable directly
      return undefined;
    }

    let cancelled = false;
    let objectUrl = "";
    (async () => {
      try {
        const res = await authFetch(imagePath);
        if (!res.ok) throw new Error("image_failed");
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
      } catch {
        if (!cancelled) setImageSrc(""); // fall back to initials
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imagePath]);

  const roleFallbackInitials = mode === "practice" ? "PR" : "P";

  return {
    displayName: identity?.displayName || "",
    image: imageSrc,
    initials: identity?.initials || "",
    roleFallbackInitials,
    isPractice: mode === "practice",
    loading,
    reload: load,
  };
}

export { readUserMode };
