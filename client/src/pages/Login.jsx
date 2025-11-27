import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const verifyStatus = params.get("verify"); // ok, invalid, missing, error …

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

      if (data.error === "EMAIL_NOT_VERIFIED") {
        // E-Mail für CheckEmail merken
        localStorage.setItem("pending_verification_email", email.trim().toLowerCase());
      
        setError("Bitte bestätige zuerst deine E-Mail.");
        navigate("/check-email");
        return;
      }
      

      if (!res.ok) throw new Error(data.error || "Login fehlgeschlagen.");

      localStorage.setItem("medscout_user_id", data.userId);
      if (data.token) localStorage.setItem("medscout_token", data.token);

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

      {/* Verify-Meldungen */}
      {verifyStatus === "ok" && (
        <p style={{ color: "green" }}>
          Deine E-Mail wurde erfolgreich bestätigt! Du kannst dich jetzt einloggen.
        </p>
      )}

      {verifyStatus === "invalid" && (
        <p style={{ color: "red" }}>
          Der Bestätigungslink ist ungültig oder abgelaufen.
        </p>
      )}

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
