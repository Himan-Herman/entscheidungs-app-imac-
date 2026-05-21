import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import GlobalLanguageSelector from "../components/language/GlobalLanguageSelector";
import { PATIENT_UI_SELECTABLE_LOCALE_CODES } from "../i18n/localeConfig";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { useAuthFlowPalette } from "../ThemeMode";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(null);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const p = useAuthFlowPalette();

  const copy = useMemo(() => getMessages(language).resetPassword, [language]);
  const navCopy = useMemo(() => getMessages(language).header, [language]);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const t = qs.get("token");
    setToken(t);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");

    if (!token) {
      setMsg(copy.invalidLink);
      setBusy(false);
      return;
    }

    if (password.length < 8) {
      setMsg(copy.shortPassword);
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg(copy.requestError + (data.error || copy.unknownError));
        setBusy(false);
        return;
      }

      setMsg(copy.success);

      setTimeout(() => {
        navigate("/login?reset=ok");
      }, 1500);
    } catch {
      setMsg(copy.network);
    } finally {
      setBusy(false);
    }
  }

  const isSuccess = msg === copy.success;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: p.pageBg,
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          backgroundColor: p.cardBg,
          borderRadius: 24,
          boxShadow: p.cardShadow,
          padding: "28px 26px 22px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 18,
          }}
        >
          <GlobalLanguageSelector
            label={navCopy.languageLabel}
            compact
            selectableLocaleCodes={PATIENT_UI_SELECTABLE_LOCALE_CODES}
          />
        </div>

        <h1
          style={{
            margin: "0 0 10px 0",
            fontSize: 26,
            lineHeight: 1.2,
            color: p.title,
          }}
        >
          {copy.title}
        </h1>

        <p
          style={{
            margin: "0 0 18px 0",
            fontSize: 14,
            color: p.subtitle,
          }}
        >
          {copy.text}
        </p>

        {msg && (
          <p
            style={{
              margin: "0 0 14px 0",
              fontSize: 13,
              padding: "8px 10px",
              borderRadius: 10,
              backgroundColor: isSuccess ? p.successBannerBg : p.errorBannerBg,
              color: isSuccess ? p.successBannerColor : p.errorBannerColor,
            }}
          >
            {msg}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: p.label,
              marginBottom: 4,
            }}
          >
            {copy.label}
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            placeholder={copy.placeholder}
            style={{
              width: "100%",
              padding: "10px 12px",
              marginBottom: 6,
              borderRadius: 12,
              border: `1px solid ${p.inputBorder}`,
              backgroundColor: p.inputBg,
              color: p.inputColor,
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          <p
            style={{
              fontSize: 12,
              color: p.hint,
              marginTop: 4,
              marginBottom: 16,
            }}
          >
            {copy.hint}
          </p>

          <button
            type="submit"
            disabled={busy}
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: 999,
              border: "none",
              outline: "none",
              fontSize: 15,
              fontWeight: 600,
              cursor: busy ? "default" : "pointer",
              backgroundColor: busy ? "#9ca3af" : "#0f766e",
              color: "#ffffff",
              boxShadow: busy
                ? "none"
                : "0 10px 22px rgba(15,118,110,0.45)",
              transition: "transform 0.12s ease, box-shadow 0.12s ease",
            }}
          >
            {busy ? copy.saving : copy.save}
          </button>
        </form>
      </div>
    </main>
  );
}
