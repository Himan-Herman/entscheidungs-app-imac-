/** PWA install hint — detection and local persistence (no PII). */

export const LS_INSTALL_DISMISSED = "medscoutx-install-dismissed";
export const LS_INSTALL_LATER_UNTIL = "medscoutx-install-later-until";
export const LS_INSTALL_INSTALLED = "medscoutx-installed";

/** @deprecated migrated to LS_INSTALL_DISMISSED */
const LEGACY_SESSION_DISMISS = "medscoutx_pwa_install_dismissed";

export const INSTALL_LATER_MS = 7 * 24 * 60 * 60 * 1000;

export function isStandaloneDisplay() {
  if (typeof window === "undefined") return true;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  } catch {
    /* ignore */
  }
  if (typeof window.navigator !== "undefined" && window.navigator.standalone === true) {
    return true;
  }
  return false;
}

export function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|EdgiOS|FxiOS|OPR/i.test(ua);
}

export function isMacOSSafari() {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform || "";
  const isMac = /Mac/i.test(platform);
  return isMac && isSafariBrowser() && !isIOSDevice();
}

/** @returns {'ios' | 'macos' | null} */
export function getManualInstallMode() {
  if (isIOSDevice()) return "ios";
  if (isMacOSSafari()) return "macos";
  return null;
}

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function migrateLegacyDismiss() {
  try {
    if (sessionStorage.getItem(LEGACY_SESSION_DISMISS) === "1") {
      writeStorage(LS_INSTALL_DISMISSED, "1");
      sessionStorage.removeItem(LEGACY_SESSION_DISMISS);
    }
  } catch {
    /* ignore */
  }
}

export function markInstalled() {
  writeStorage(LS_INSTALL_INSTALLED, "1");
}

export function dismissForever() {
  writeStorage(LS_INSTALL_DISMISSED, "1");
}

export function dismissLater() {
  writeStorage(LS_INSTALL_LATER_UNTIL, String(Date.now() + INSTALL_LATER_MS));
}

export function shouldShowInstallHint() {
  if (typeof window === "undefined") return false;
  migrateLegacyDismiss();

  if (isStandaloneDisplay()) {
    markInstalled();
    return false;
  }

  if (readStorage(LS_INSTALL_INSTALLED) === "1") return false;
  if (readStorage(LS_INSTALL_DISMISSED) === "1") return false;

  const until = readStorage(LS_INSTALL_LATER_UNTIL);
  if (until) {
    const ts = Number(until);
    if (!Number.isNaN(ts) && Date.now() < ts) return false;
  }

  return true;
}

/**
 * Is the person in the middle of accepting a practice invitation?
 *
 * That is a one-time, focused task — often done on a phone, by somebody who
 * rarely uses apps — and the install hint is a dialog that slides over the
 * page's only button and takes the keyboard focus. On this path it waits.
 * It is postponed, not dismissed: nothing is written, and it can appear on any
 * later page as before.
 *
 * The sign-in, registration and check-your-inbox pages count only while they
 * are part of the invitation (`next=/patient-invitation`); anywhere else they
 * behave exactly as they always did.
 *
 * @param {string} pathname
 * @param {string} [search]
 */
export function isInvitationTaskRoute(pathname, search = "") {
  if (pathname === "/patient-invitation") return true;
  if (!["/login", "/register", "/check-email"].includes(pathname)) return false;
  return new URLSearchParams(search).get("next") === "/patient-invitation";
}
