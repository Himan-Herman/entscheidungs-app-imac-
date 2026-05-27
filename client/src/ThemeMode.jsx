// src/ThemeMode.jsx
import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";

    const stored = localStorage.getItem("medscout_theme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }

    return "light";
  });

  // Theme im <html>-Tag setzen + in localStorage speichern
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    localStorage.setItem("medscout_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const value = { theme, setTheme, toggleTheme };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}

/** Inline-style palette for login / password / check-email flows */
export function getAuthFlowPalette(theme) {
  const dark = theme === "dark";
  if (dark) {
    return {
      pageBg:
        "linear-gradient(135deg, #020617 0%, #0f172a 55%, #0f172a 100%)",
      cardBg: "rgba(15, 23, 42, 0.94)",
      cardShadow: "0 24px 55px rgba(0,0,0,0.45)",
      title: "#f1f5f9",
      subtitle: "#cbd5e1",
      body: "#cbd5e1",
      label: "#f1f5f9",
      hint: "#cbd5e1",
      inputBg: "rgba(2, 6, 23, 0.5)",
      inputBorder: "rgba(148, 163, 184, 0.35)",
      inputColor: "#f1f5f9",
      footerMuted: "#94a3b8",
      linkMuted: "#94a3b8",
      linkAccent: "#5eead4",
      badgeBg: "rgba(56, 189, 248, 0.14)",
      badgeColor: "#7dd3fc",
      tipBoxBg: "rgba(30, 41, 59, 0.85)",
      tipBoxColor: "#cbd5e1",
      footerNote: "#64748b",
      successBannerBg: "rgba(34, 197, 94, 0.14)",
      successBannerColor: "#86efac",
      errorBannerBg: "rgba(248, 113, 113, 0.12)",
      errorBannerColor: "#fca5a5",
      warnBannerBg: "rgba(251, 191, 36, 0.12)",
      warnBannerColor: "#fcd34d",
      verifyInvalidBg: "rgba(220, 38, 38, 0.12)",
      verifyInvalidColor: "#fca5a5",
      verifyErrorBg: "rgba(30, 41, 59, 0.65)",
      verifyErrorColor: "#fcd34d",
      sessionBannerBg: "rgba(251, 191, 36, 0.12)",
      sessionBannerColor: "#fcd34d",
      resetOkBg: "rgba(34, 197, 94, 0.14)",
      resetOkColor: "#86efac",
    };
  }
  return {
    pageBg:
      "linear-gradient(135deg, #0f172a 0%, #0f766e 45%, #22c55e 100%)",
    cardBg: "#ffffff",
    cardShadow: "0 18px 45px rgba(15,23,42,0.35)",
    title: "#020617",
    subtitle: "#4b5563",
    body: "#4b5563",
    label: "#111827",
    hint: "#6b7280",
    inputBg: "#ffffff",
    inputBorder: "#e5e7eb",
    inputColor: "#0f172a",
    footerMuted: "#6b7280",
    linkMuted: "#6b7280",
    linkAccent: "#0f766e",
    badgeBg: "rgba(37,99,235,0.08)",
    badgeColor: "#1d4ed8",
    tipBoxBg: "#f1f5f9",
    tipBoxColor: "#475569",
    footerNote: "#9ca3af",
    successBannerBg: "rgba(22,163,74,0.12)",
    successBannerColor: "#166534",
    errorBannerBg: "rgba(248,113,113,0.08)",
    errorBannerColor: "#b91c1c",
    warnBannerBg: "rgba(217,119,6,0.12)",
    warnBannerColor: "#9a3412",
    verifyInvalidBg: "rgba(220,38,38,0.06)",
    verifyInvalidColor: "#b91c1c",
    verifyErrorBg: "rgba(248,250,252,0.8)",
    verifyErrorColor: "#b45309",
    sessionBannerBg: "rgba(217,119,6,0.12)",
    sessionBannerColor: "#9a3412",
    resetOkBg: "rgba(22,163,74,0.08)",
    resetOkColor: "#166534",
  };
}

export function useAuthFlowPalette() {
  const { theme } = useTheme();
  return getAuthFlowPalette(theme);
}
