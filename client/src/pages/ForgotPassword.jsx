import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlobalLanguageSelector from "../components/language/GlobalLanguageSelector";
import { PATIENT_UI_SELECTABLE_LOCALE_CODES } from "../i18n/localeConfig";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { useAuthFlowPalette } from "../ThemeMode";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const p = useAuthFlowPalette();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const copy = useMemo(() => getMessages(language).forgotPassword, [language]);
  const navCopy = useMemo(() => getMessages(language).header, [language]);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");

    try {
      const r = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const d = await r.json();
      setMsg(d.ok ? copy.success : copy.error);
    } catch {
      setMsg(copy.network);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: p.pageBg,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          backgroundColor: p.cardBg,
          padding: 28,
          borderRadius: 20,
          boxShadow: p.cardShadow,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 10px",
              borderRadius: 999,
              backgroundColor: p.badgeBg,
              color: p.badgeColor,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: "#22c55e",
              }}
            />
            {copy.badge}
          </div>

          <GlobalLanguageSelector
            label={navCopy.languageLabel}
            compact
            selectableLocaleCodes={PATIENT_UI_SELECTABLE_LOCALE_CODES}
          />
        </div>

        <h1 style={{ marginBottom: 12, color: p.title }}>{copy.title}</h1>
        <p style={{ fontSize: 14, marginBottom: 20, color: p.body }}>
          {copy.text}
        </p>

        {msg && (
          <p
            style={{
              fontSize: 13,
              padding: "8px 10px",
              borderRadius: 10,
              backgroundColor:
                msg === copy.success ? p.successBannerBg : p.errorBannerBg,
              color:
                msg === copy.success ? p.successBannerColor : p.errorBannerColor,
              marginBottom: 16,
            }}
          >
            {msg}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 4,
              display: "block",
              color: p.label,
            }}
          >
            {copy.email}
          </label>
          <input
            type="email"
            placeholder={copy.placeholder}
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${p.inputBorder}`,
              backgroundColor: p.inputBg,
              color: p.inputColor,
              marginBottom: 16,
              boxSizing: "border-box",
            }}
          />

          <button
            type="submit"
            disabled={busy}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 999,
              backgroundColor: busy ? "#9ca3af" : "#0f766e",
              color: "#fff",
              border: "none",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {busy ? copy.submitting : copy.submit}
          </button>
        </form>

        <button
          onClick={() => navigate("/login")}
          style={{
            marginTop: 16,
            background: "none",
            border: "none",
            color: p.linkAccent,
            textDecoration: "none",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {copy.back}
        </button>
      </div>
    </main>
  );
}
