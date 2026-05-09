import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { useAuthFlowPalette } from "../ThemeMode";
import {
  writeUserMode,
  PENDING_MODE_KEY,
  USER_MODES,
} from "../utils/userMode.js";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const p = useAuthFlowPalette();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(null);
  const [resetStatus, setResetStatus] = useState(null);

  const copy = useMemo(() => getMessages(language).login, [language]);

  const [sessionExpiredBanner, setSessionExpiredBanner] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const v = params.get("verify");
    const r = params.get("reset");

    setSessionExpiredBanner(params.get("reason") === "session_expired");
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

      try {
        const pending = sessionStorage.getItem(PENDING_MODE_KEY);
        if (pending === USER_MODES.PRACTICE || pending === USER_MODES.PATIENT) {
          writeUserMode(pending);
        }
        sessionStorage.removeItem(PENDING_MODE_KEY);
      } catch {
        /* ignore */
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
            backgroundColor: p.successBannerBg,
            color: p.successBannerColor,
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
            backgroundColor: p.verifyInvalidBg,
            color: p.verifyInvalidColor,
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
            backgroundColor: p.verifyErrorBg,
            color: p.verifyErrorColor,
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
          backgroundColor: p.resetOkBg,
          color: p.resetOkColor,
        }}
      >
        {copy.resetOk}
      </p>
    );
  }

  function renderSessionExpiredMessage() {
    if (!sessionExpiredBanner) return null;

    return (
      <p
        style={{
          margin: "0 0 10px 0",
          fontSize: 13,
          padding: "8px 10px",
          borderRadius: 10,
          backgroundColor: p.sessionBannerBg,
          color: p.sessionBannerColor,
        }}
      >
        {copy.sessionExpired}
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
        background: p.pageBg,
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          backgroundColor: p.cardBg,
          borderRadius: 24,
          boxShadow: p.cardShadow,
          padding: "28px 26px 22px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
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
              backgroundColor: p.badgeBg,
              color: p.badgeColor,
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
            color: p.title,
          }}
        >
          {copy.title}
        </h1>

        <p
          style={{
            margin: "0 0 18px 0",
            fontSize: 14,
            color: p.subtitle,
          }}
        >
          {copy.subtitle}
        </p>

        {renderVerifyMessage()}
        {renderResetMessage()}
        {renderSessionExpiredMessage()}

        {error && (
          <p
            style={{
              margin: "0 0 10px 0",
              fontSize: 13,
              padding: "8px 10px",
              borderRadius: 10,
              backgroundColor: p.errorBannerBg,
              color: p.errorBannerColor,
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
              color: p.label,
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
              border: `1px solid ${p.inputBorder}`,
              backgroundColor: p.inputBg,
              color: p.inputColor,
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
              color: p.label,
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
              border: `1px solid ${p.inputBorder}`,
              backgroundColor: p.inputBg,
              color: p.inputColor,
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
              color: p.linkAccent,
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
            color: p.footerMuted,
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span>
            {copy.noAccount}{" "}
            <Link
              to="/register"
              style={{ color: p.linkAccent, textDecoration: "none" }}
            >
              {copy.register}
            </Link>
          </span>

          <span>
            <Link
              to="/impressum"
              style={{
                color: p.linkMuted,
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
                color: p.linkMuted,
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
