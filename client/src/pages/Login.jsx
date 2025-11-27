import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
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
        setError("Bitte bestätige zuerst deine E-Mail.");
        navigate("/check-email");
        return;
      }

      if (!res.ok) throw new Error(data.error || "Login fehlgeschlagen.");

      // 🔐 1) Deine bisherige Logik: Nutzer-ID speichern
      localStorage.setItem("medscout_user_id", data.userId);

      // 🔐 2) NEU: Token speichern (für requireAuth)
      if (data.token) {
        localStorage.setItem("medscout_token", data.token);
      } else {
        console.warn("Login: Kein Token im Backend-Response gefunden.");
      }

      // Weiterleitung
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
