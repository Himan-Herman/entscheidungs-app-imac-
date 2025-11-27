// src/pages/Login.jsx (oder wo du sie liegen hast)
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // Query-Parameter aus der URL lesen, z. B. /login?verify=ok
  const params = new URLSearchParams(location.search);
  const verifyStatus = params.get("verify"); // "ok" | "invalid" | "missing" | "error" | null

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      // 1) E-Mail ist noch nicht verifiziert
      if (data.error === "EMAIL_NOT_VERIFIED") {
        // E-Mail merken, damit CheckEmail.jsx weiß, wohin resend gehen soll
        localStorage.setItem(
          "pending_verification_email",
          email.trim().toLowerCase()
        );

        setError("Bitte bestätige zuerst deine E-Mail.");
        navigate("/check-email");
        return;
      }

      // 2) Andere Login-Fehler
      if (!res.ok) {
        throw new Error(data.error || "Login fehlgeschlagen.");
      }

      // 3) Erfolg → User-ID & Token speichern
      if (data.userId) {
        localStorage.setItem("medscout_user_id", data.userId);
      }
      if (data.token) {
        localStorage.setItem("medscout_token", data.token);
      }

      // 4) Weiterleitung in die App (Intro → dann Startseite)
      navigate("/intro", { replace: true });
    } catch (err) {
      setError(err.message || "Fehler beim Login.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <h1>Login</h1>

      {/* Hinweis nach E-Mail-Bestätigung */}
      {verifyStatus === "ok" && (
        <p style={{ color: "green" }}>
          Deine E-Mail wurde erfolgreich bestätigt! Du kannst dich jetzt einloggen.
        </p>
      )}

      {/* Hinweis bei ungültigem/abgelaufenem Link */}
      {verifyStatus === "invalid" && (
        <p style={{ color: "red" }}>
          Der Bestätigungslink ist ungültig oder abgelaufen. Bitte registriere dich erneut
          oder fordere eine neue Bestätigungs-E-Mail an.
        </p>
      )}

      {/* Optional: weitere Fälle */}
      {verifyStatus === "missing" && (
        <p style={{ color: "red" }}>
          Es wurde kein gültiger Bestätigungslink gefunden.
        </p>
      )}
      {verifyStatus === "error" && (
        <p style={{ color: "red" }}>
          Es ist ein Fehler bei der E-Mail-Bestätigung aufgetreten. Bitte versuche es erneut.
        </p>
      )}

      {/* Laufende Fehler (z. B. falsches Passwort) */}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <input
        type="email"
        placeholder="E-Mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        type="password"
        placeholder="Passwort"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <button type="submit" disabled={busy}>
        {busy ? "..." : "Einloggen"}
      </button>
    </form>
  );
}
