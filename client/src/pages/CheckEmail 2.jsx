// client/src/pages/CheckEmail.jsx
import { useState } from "react";

export default function CheckEmail() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function resend() {
    const email = localStorage.getItem("pending_verification_email");

    if (!email) {
      setMsg("❌ Keine E-Mail für die Bestätigung gefunden. Bitte registriere dich neu.");
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

      if (d.ok) {
        setMsg("✅ Wir haben dir die E-Mail erneut gesendet.");
      } else {
        setMsg("❌ Leider ist ein Fehler aufgetreten. Bitte versuche es später noch einmal.");
      }
    } catch (err) {
      console.error(err);
      setMsg("❌ Netzwerkfehler. Bitte prüfe deine Verbindung und versuche es erneut.");
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
        {/* Badge */}
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
            marginBottom: "10px",
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
          Sicherer MedScoutX-Login
        </div>

        {/* Titel */}
        <h1
          style={{
            margin: "0 0 8px 0",
            fontSize: "26px",
            lineHeight: 1.2,
            color: "#020617",
          }}
        >
          Bitte E-Mail bestätigen ✉️
        </h1>

        {/* Untertitel */}
        <p
          style={{
            margin: "0 0 16px 0",
            fontSize: "14px",
            lineHeight: 1.7,
            color: "#4b5563",
          }}
        >
          Wir haben dir gerade eine Bestätigungs­mail geschickt. 
          <br />
          <strong>Öffne dein Postfach</strong> und klicke auf den Button{" "}
          <em>„E-Mail jetzt bestätigen“</em>, damit dein Konto aktiviert wird.
        </p>

        {/* Info-Box */}
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
          💡 <strong>Tipp:</strong> Schau auch im Spam- oder Werbungsordner nach, 
          falls die Mail nicht sofort sichtbar ist.
        </div>

        {/* Button + Status */}
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
          {busy ? "Sende E-Mail …" : "E-Mail erneut senden"}
        </button>

        {msg && (
          <p
            style={{
              marginTop: 12,
              fontSize: "13px",
              lineHeight: 1.5,
              color: msg.startsWith("✅")
                ? "#16a34a"
                : msg.startsWith("❌")
                ? "#b91c1c"
                : "#334155",
            }}
          >
            {msg}
          </p>
        )}

        {/* Footer klein */}
        <p
          style={{
            marginTop: 20,
            fontSize: "11px",
            color: "#9ca3af",
            lineHeight: 1.6,
          }}
        >
          Wenn du MedScoutX nicht selbst benutzt hast, kannst du diese Nachricht
          ignorieren. Dein Konto wird nur aktiviert, wenn du den Link
          bestätigst.
        </p>
      </div>
    </main>
  );
}
