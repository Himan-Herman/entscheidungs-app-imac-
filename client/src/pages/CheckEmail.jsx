// pages/CheckEmail.jsx
import { useState } from "react";

export default function CheckEmail() {
  const [msg, setMsg] = useState("");

  async function resend() {
    const email = localStorage.getItem("pending_verification_email");
    if (!email) return setMsg("Keine E-Mail gefunden.");
    const r = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const d = await r.json();
    setMsg(d.ok ? "Mail erneut gesendet." : (d.error || "Fehler."));
  }

  return (
    <div className="container">
      <h1>Bitte E-Mail bestätigen</h1>
      <p>Wir haben dir einen Bestätigungslink geschickt. Erst danach kannst du dich einloggen.</p>
      <button onClick={resend}>E-Mail erneut senden</button>
      {msg && <p>{msg}</p>}
    </div>
  );
}
