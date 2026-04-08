import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(null);
  const navigate = useNavigate();
  const { language } = useLanguage();

  const copy = language === "en"
    ? {
        title: "Create a new password",
        text: "Please enter a new secure password.",
        label: "New password",
        placeholder: "At least 8 characters",
        hint: "Password must be at least 8 characters. A number and symbol are recommended.",
        save: "Save password",
        saving: "Saving...",
        invalidLink: "Invalid or missing link.",
        shortPassword: "The password must be at least 8 characters long.",
        unknownError: "Unknown error.",
        requestError: "Error: ",
        success: "Your password was reset successfully. Redirecting...",
        network: "Network error. Please try again later.",
        language: "Language",
      }
    : {
        title: "Neues Passwort setzen",
        text: "Bitte gib ein neues, sicheres Passwort ein.",
        label: "Neues Passwort",
        placeholder: "Mindestens 8 Zeichen",
        hint: "Passwort mindestens 8 Zeichen - idealerweise mit Zahl und Sonderzeichen.",
        save: "Passwort speichern",
        saving: "Speichere...",
        invalidLink: "Ungültiger oder fehlender Link.",
        shortPassword: "Das Passwort muss mindestens 8 Zeichen lang sein.",
        unknownError: "Unbekannter Fehler.",
        requestError: "Fehler: ",
        success: "Dein Passwort wurde erfolgreich zurückgesetzt. Weiterleitung...",
        network: "Netzwerkfehler. Bitte später erneut versuchen.",
        language: "Sprache",
      };

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
        background:
          "linear-gradient(135deg, #0f172a 0%, #0f766e 45%, #22c55e 100%)",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          backgroundColor: "#ffffff",
          borderRadius: 24,
          boxShadow: "0 18px 45px rgba(15,23,42,0.35)",
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
          <LanguageSwitcher label={copy.language} compact />
        </div>

        <h1
          style={{
            margin: "0 0 10px 0",
            fontSize: 26,
            lineHeight: 1.2,
            color: "#020617",
          }}
        >
          {copy.title}
        </h1>

        <p
          style={{
            margin: "0 0 18px 0",
            fontSize: 14,
            color: "#4b5563",
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
              backgroundColor: isSuccess
                ? "rgba(22,163,74,0.08)"
                : "rgba(220,38,38,0.06)",
              color: isSuccess ? "#166534" : "#b91c1c",
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
              color: "#111827",
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
              border: "1px solid #e5e7eb",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          <p
            style={{
              fontSize: 12,
              color: "#6b7280",
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
