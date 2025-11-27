import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function VerifyEmail() {
  const [msg, setMsg] = useState("Bitte warten…");
  const navigate = useNavigate();

  useEffect(() => {
    async function verify() {
      const qs = new URLSearchParams(window.location.search);
      const token = qs.get("token");

      if (!token) {
        setMsg("❌ Ungültiger Link.");
        return;
      }

      try {
        const resp = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/auth/verify-email?token=${token}`
        );
        const data = await resp.json();

        if (resp.ok && data.ok) {
          setMsg("✅ Deine E-Mail wurde erfolgreich bestätigt! 🎉");

          // Weiterleitung nach Login-Seite
          setTimeout(() => navigate("/login"), 2000);
        } else {
          setMsg("❌ Link ungültig oder abgelaufen.");
        }
      } catch (err) {
        console.error(err);
        setMsg("❌ Unerwarteter Fehler. Bitte versuche es später erneut.");
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
