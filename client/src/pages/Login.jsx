import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(null);
  const [resetStatus, setResetStatus] = useState(null);

  const copy = language === "en"
    ? {
        badge: "MedScoutX - Secure access",
        title: "Login",
        subtitle: "Sign in with your registered email address to use your MedScoutX features.",
        email: "Email",
        emailPlaceholder: "e.g. yourname@mail.com",
        password: "Password",
        passwordPlaceholder: "Password",
        submitting: "Signing in...",
        submit: "Sign in",
        forgot: "Forgot password?",
        noAccount: "No account yet?",
        register: "Register now",
        imprint: "Imprint",
        privacy: "Privacy",
        emailFirst: "Please confirm your email first.",
        loginFailed: "Login failed.",
        loginError: "Login error.",
        verifyOk: "Your email has been verified successfully. You can sign in now.",
        verifyInvalid: "The verification link is invalid or expired. Please register again.",
        verifyError: "An error occurred while verifying your email. Please try again later.",
        resetOk: "Your password was reset successfully. Please sign in with your new password.",
      }
    : {
        badge: "MedScoutX - Sicherer Zugang",
        title: "Login",
        subtitle: "Melde dich mit deiner registrierten E-Mail an, um deine MedScoutX-Funktionen zu nutzen.",
        email: "E-Mail",
        emailPlaceholder: "z.B. deinname@mail.de",
        password: "Passwort",
        passwordPlaceholder: "Passwort",
        submitting: "Wird eingeloggt...",
        submit: "Einloggen",
        forgot: "Passwort vergessen?",
        noAccount: "Noch kein Konto?",
        register: "Jetzt registrieren",
        imprint: "Impressum",
        privacy: "Datenschutz",
        emailFirst: "Bitte bestätige zuerst deine E-Mail.",
        loginFailed: "Login fehlgeschlagen.",
        loginError: "Fehler beim Login.",
        verifyOk: "Deine E-Mail wurde erfolgreich bestätigt. Du kannst dich jetzt einloggen.",
        verifyInvalid: "Der Bestätigungslink ist ungültig oder abgelaufen. Bitte registriere dich erneut.",
        verifyError: "Beim Bestätigen deiner E-Mail ist ein Fehler aufgetreten. Bitte versuche es später erneut.",
        resetOk: "Dein Passwort wurde erfolgreich zurückgesetzt. Bitte melde dich mit deinem neuen Passwort an.",
      };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const v = params.get("verify");
    const r = params.get("reset");

    if (v) setVerifyStatus(v);
    if (r) setResetStatus(r);
  }, [location.search]);

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
        localStorage.setItem(
          "pending_verification_email",
          email.trim().toLowerCase()
        );
        setError(copy.emailFirst);
        navigate("/check-email");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || copy.loginFailed);
      }

      localStorage.setItem("medscout_user_id", data.userId);
      if (data.token) {
        localStorage.setItem("medscout_token", data.token);
      }

      navigate("/intro", { replace: true });
    } catch (err) {
      setError(err.message || copy.loginError);
    } finally {
      setBusy(false);
    }
  }

  function renderVerifyMessage() {
    if (!verifyStatus) return null;

    const styles = {
      margin: "0 0 10px 0",
      fontSize: 13,
      padding: "8px 10px",
      borderRadius: 10,
    };

    if (verifyStatus === "ok") {
      return (
        <p
          style={{
            ...styles,
            backgroundColor: "rgba(22,163,74,0.08)",
            color: "#166534",
          }}
        >
          {copy.verifyOk}
        </p>
      );
    }

    if (verifyStatus === "invalid" || verifyStatus === "missing") {
      return (
        <p
          style={{
            ...styles,
            backgroundColor: "rgba(220,38,38,0.06)",
            color: "#b91c1c",
          }}
        >
          {copy.verifyInvalid}
        </p>
      );
    }

    if (verifyStatus === "error") {
      return (
        <p
          style={{
            ...styles,
            backgroundColor: "rgba(248,250,252,0.8)",
            color: "#b45309",
          }}
        >
          {copy.verifyError}
        </p>
      );
    }

    return null;
  }

  function renderResetMessage() {
    if (resetStatus !== "ok") return null;

    return (
      <p
        style={{
          margin: "0 0 10px 0",
          fontSize: 13,
          padding: "8px 10px",
          borderRadius: 10,
          backgroundColor: "rgba(22,163,74,0.08)",
          color: "#166534",
        }}
      >
        {copy.resetOk}
      </p>
    );
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
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
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
        </div>

        <h1
          style={{
            margin: "0 0 6px 0",
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
          {copy.subtitle}
        </p>

        {renderVerifyMessage()}
        {renderResetMessage()}

        {error && (
          <p
            style={{
              margin: "0 0 10px 0",
              fontSize: 13,
              padding: "8px 10px",
              borderRadius: 10,
              backgroundColor: "rgba(248,113,113,0.08)",
              color: "#b91c1c",
            }}
          >
            {error}
          </p>
        )}

        <form onSubmit={handleLogin} style={{ marginTop: 8 }}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "#111827",
              marginBottom: 4,
            }}
          >
            {copy.email}
          </label>
          <input
            type="email"
            placeholder={copy.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "10px 12px",
              marginBottom: 12,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "#111827",
              marginBottom: 4,
            }}
          >
            {copy.password}
          </label>
          <input
            type="password"
            placeholder={copy.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "10px 12px",
              marginBottom: 16,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />

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
            {busy ? copy.submitting : copy.submit}
          </button>

          <button
            type="button"
            onClick={() => navigate("/forgot-password")}
            style={{
              marginTop: 10,
              background: "none",
              border: "none",
              color: "#0f766e",
              textDecoration: "underline",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              padding: 0,
            }}
          >
            {copy.forgot}
          </button>
        </form>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "#6b7280",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span>
            {copy.noAccount}{" "}
            <Link
              to="/register"
              style={{ color: "#0f766e", textDecoration: "none" }}
            >
              {copy.register}
            </Link>
          </span>

          <span>
            <Link
              to="/impressum"
              style={{
                color: "#6b7280",
                textDecoration: "none",
                marginRight: 8,
              }}
            >
              {copy.imprint}
            </Link>
            |
            <Link
              to="/datenschutz"
              style={{
                color: "#6b7280",
                textDecoration: "none",
                marginLeft: 8,
              }}
            >
              {copy.privacy}
            </Link>
          </span>
        </div>
      </div>
    </main>
  );
}
