import { useMemo, useState } from "react";
import GlobalLanguageSelector from "../components/language/GlobalLanguageSelector";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { useAuthFlowPalette } from "../ThemeMode";

export default function CheckEmail() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const { language } = useLanguage();
  const p = useAuthFlowPalette();

  const copy = useMemo(() => getMessages(language).checkEmail, [language]);
  const navCopy = useMemo(() => getMessages(language).header, [language]);

  async function resend() {
    const email = localStorage.getItem("pending_verification_email");

    if (!email) {
      setMsg(copy.missing);
      return;
    }

    try {
      setBusy(true);
      setMsg("");

      const r = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await r.json();

      setMsg(d.ok ? copy.success : copy.error);
    } catch (err) {
      console.error(err);
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
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: p.cardBg,
          borderRadius: "24px",
          boxShadow: p.cardShadow,
          padding: "28px 26px 24px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 10px",
              borderRadius: "999px",
              backgroundColor: p.badgeBg,
              color: p.badgeColor,
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                width: 8,
                height: 8,
                borderRadius: "999px",
                backgroundColor: "#22c55e",
              }}
            />
            {copy.badge}
          </div>

          <GlobalLanguageSelector label={navCopy.languageLabel} compact />
        </div>

        <h1
          style={{
            margin: "0 0 8px 0",
            fontSize: "26px",
            lineHeight: 1.2,
            color: p.title,
          }}
        >
          {copy.title}
        </h1>

        <p
          style={{
            margin: "0 0 16px 0",
            fontSize: "14px",
            lineHeight: 1.7,
            color: p.subtitle,
          }}
        >
          {copy.text}
        </p>

        <div
          style={{
            marginBottom: 18,
            padding: "10px 12px",
            borderRadius: 12,
            backgroundColor: p.tipBoxBg,
            fontSize: "13px",
            color: p.tipBoxColor,
          }}
        >
          <strong>{copy.tip}</strong> {copy.tipText}
        </div>

        <button
          type="button"
          onClick={resend}
          disabled={busy}
          style={{
            width: "100%",
            padding: "11px 14px",
            borderRadius: "999px",
            border: "none",
            outline: "none",
            fontSize: "15px",
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            backgroundColor: busy ? "#9ca3af" : "#0f766e",
            color: "#ffffff",
            transition: "transform 0.12s ease, box-shadow 0.12s ease",
            boxShadow: busy
              ? "none"
              : "0 10px 22px rgba(15,118,110,0.4)",
          }}
        >
          {busy ? copy.resending : copy.resend}
        </button>

        {msg && (
          <p
            style={{
              marginTop: 12,
              fontSize: "13px",
              lineHeight: 1.5,
              color: isSuccess ? p.successBannerColor : p.errorBannerColor,
            }}
          >
            {msg}
          </p>
        )}

        <p
          style={{
            marginTop: 20,
            fontSize: "11px",
            color: p.footerNote,
            lineHeight: 1.6,
          }}
        >
          {copy.footer}
        </p>
      </div>
    </main>
  );
}
