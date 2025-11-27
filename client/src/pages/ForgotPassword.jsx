// client/src/pages/ForgotPassword.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

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

      if (d.ok) {
        setMsg(
          "Wenn die E-Mail existiert, wurde ein Link zum Zurücksetzen versendet."
        );
      } else {
        setMsg("Fehler – bitte später erneut versuchen.");
      }
    } catch {
      setMsg("Netzwerkfehler – bitte später erneut versuchen.");
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
        <h1 style={{ marginBottom: 12 }}>Passwort zurücksetzen</h1>

        <p style={{ fontSize: 14, marginBottom: 20 }}>
          Gib deine E-Mail-Adresse ein. Wir senden dir einen Link zum Zurücksetzen.
        </p>

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
            E-Mail
          </label>
          <input
            type="email"
            placeholder="deinname@mail.de"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              marginBottom: 16,
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
            {busy ? "Senden…" : "Link anfordern"}
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
          Zurück zum Login
        </button>
      </div>
    </main>
  );
}
