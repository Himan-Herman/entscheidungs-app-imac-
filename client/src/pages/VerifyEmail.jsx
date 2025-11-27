// client/src/pages/VerifyEmail.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function VerifyEmail() {
  const [msg, setMsg] = useState("Bitte warte, deine E-Mail wird geprüft …");
  const navigate = useNavigate();

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const token = qs.get("token");

    if (!token) {
      setMsg("❌ Kein Bestätigungs-Token gefunden. Bitte registriere dich neu.");
      return;
    }

    async function verify() {
      try {
        const base = import.meta.env.VITE_API_BASE_URL; // z.B. https://api.medscoutx.app
        const url = `${base}/api/auth/verify-email?token=${encodeURIComponent(
          token
        )}`;

        const res = await fetch(url);

        if (!res.ok) {
          console.error("verify-email status:", res.status);
          if (res.status === 400) {
            setMsg(
              "❌ Der Bestätigungslink ist ungültig oder abgelaufen. Bitte registriere dich erneut."
            );
          } else {
            setMsg("❌ Unerwarteter Fehler. Bitte versuche es später erneut.");
          }
          return;
        }

        // Erfolgreich
        setMsg(
          "✅ E-Mail erfolgreich bestätigt. Du wirst jetzt zur Startseite weitergeleitet …"
        );

        // nach 1,5 s zur Startseite
        setTimeout(() => {
          navigate("/startseite");
        }, 1500);
      } catch (err) {
        console.error("verify-email fetch error:", err);
        setMsg(
          "❌ Netzwerkfehler bei der Bestätigung. Bitte versuche es später erneut."
        );
      }
    }

    verify();
  }, [navigate]);

  return (
    <main style={{ padding: 24 }}>
      <h1>E-Mail-Bestätigung</h1>
      <p>{msg}</p>
    </main>
  );
}
