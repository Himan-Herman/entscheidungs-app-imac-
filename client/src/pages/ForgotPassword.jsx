import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const copy = language === "en"
    ? {
        title: "Reset password",
        text: "Enter your email address and we will send you a reset link.",
        email: "Email",
        placeholder: "yourname@mail.com",
        submit: "Request link",
        submitting: "Sending...",
        back: "Back to login",
        badge: "Secure account recovery",
        success: "If the email exists, a reset link has been sent.",
        error: "Something went wrong. Please try again later.",
        network: "Network error. Please try again later.",
        language: "Language",
      }
    : {
        title: "Passwort zurücksetzen",
        text: "Gib deine E-Mail-Adresse ein. Wir senden dir einen Link zum Zurücksetzen.",
        email: "E-Mail",
        placeholder: "deinname@mail.de",
        submit: "Link anfordern",
        submitting: "Senden...",
        back: "Zurück zum Login",
        badge: "Sichere Kontowiederherstellung",
        success: "Wenn die E-Mail existiert, wurde ein Link zum Zurücksetzen versendet.",
        error: "Fehler - bitte später erneut versuchen.",
        network: "Netzwerkfehler - bitte später erneut versuchen.",
        language: "Sprache",
      };

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
        background:
          "linear-gradient(135deg, #0f172a 0%, #0f766e 45%, #22c55e 100%)",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          backgroundColor: "#ffffff",
          padding: 28,
          borderRadius: 20,
          boxShadow: "0 18px 40px rgba(0,0,0,0.25)",
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
              backgroundColor: "rgba(37,99,235,0.08)",
              color: "#1d4ed8",
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

          <LanguageSwitcher label={copy.language} compact />
        </div>

        <h1 style={{ marginBottom: 12 }}>{copy.title}</h1>
        <p style={{ fontSize: 14, marginBottom: 20 }}>{copy.text}</p>

        {msg && (
          <p
            style={{
              fontSize: 13,
              padding: "8px 10px",
              borderRadius: 10,
              backgroundColor: "rgba(22,163,74,0.12)",
              color: "#166534",
              marginBottom: 16,
            }}
          >
            {msg}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label
            style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}
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
              border: "1px solid #e5e7eb",
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
            color: "#0f766e",
            textDecoration: "underline",
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
