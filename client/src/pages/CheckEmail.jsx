import { useState } from "react";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";

export default function CheckEmail() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const { language } = useLanguage();

  const copy = language === "en"
    ? {
        badge: "Secure MedScoutX login",
        title: "Please confirm your email",
        text: "We just sent you a verification email. Open your inbox and click the confirmation button to activate your account.",
        tip: "Tip:",
        tipText: "Check your spam or promotions folder if the email is not visible right away.",
        resend: "Send email again",
        resending: "Sending email...",
        success: "We sent the email again.",
        error: "Something went wrong. Please try again later.",
        network: "Network error. Please check your connection and try again.",
        missing: "No email for verification was found. Please register again.",
        footer: "If you did not use MedScoutX yourself, you can ignore this message. Your account will only be activated after you confirm the link.",
        language: "Language",
      }
    : {
        badge: "Sicherer MedScoutX-Login",
        title: "Bitte E-Mail bestätigen",
        text: "Wir haben dir gerade eine Bestätigungsmail geschickt. Öffne dein Postfach und klicke auf den Button \"E-Mail jetzt bestätigen\", damit dein Konto aktiviert wird.",
        tip: "Tipp:",
        tipText: "Schau auch im Spam- oder Werbungsordner nach, falls die Mail nicht sofort sichtbar ist.",
        resend: "E-Mail erneut senden",
        resending: "Sende E-Mail...",
        success: "Wir haben dir die E-Mail erneut gesendet.",
        error: "Leider ist ein Fehler aufgetreten. Bitte versuche es später noch einmal.",
        network: "Netzwerkfehler. Bitte prüfe deine Verbindung und versuche es erneut.",
        missing: "Keine E-Mail für die Bestätigung gefunden. Bitte registriere dich neu.",
        footer: "Wenn du MedScoutX nicht selbst benutzt hast, kannst du diese Nachricht ignorieren. Dein Konto wird nur aktiviert, wenn du den Link bestätigst.",
        language: "Sprache",
      };

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

          <LanguageSwitcher label={copy.language} compact />
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
