import { useMemo, useState } from "react";
import GlobalLanguageSelector from "../components/language/GlobalLanguageSelector";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";

export default function CheckEmail() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const { language } = useLanguage();

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
        background:
          "linear-gradient(135deg, #0f172a 0%, #0f766e 45%, #22c55e 100%)",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "#ffffff",
          borderRadius: "24px",
          boxShadow: "0 18px 45px rgba(15,23,42,0.35)",
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
              backgroundColor: "rgba(34,197,94,0.08)",
              color: "#0f766e",
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
            color: "#020617",
          }}
        >
          {copy.title}
        </h1>

        <p
          style={{
            margin: "0 0 16px 0",
            fontSize: "14px",
            lineHeight: 1.7,
            color: "#4b5563",
          }}
        >
          {copy.text}
        </p>

        <div
          style={{
            marginBottom: 18,
            padding: "10px 12px",
            borderRadius: 12,
            backgroundColor: "#f1f5f9",
            fontSize: "13px",
            color: "#475569",
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
              color: isSuccess ? "#16a34a" : "#b91c1c",
            }}
          >
            {msg}
          </p>
        )}

        <p
          style={{
            marginTop: 20,
            fontSize: "11px",
            color: "#9ca3af",
            lineHeight: 1.6,
          }}
        >
          {copy.footer}
        </p>
      </div>
    </main>
  );
}
