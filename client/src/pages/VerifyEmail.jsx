import { useEffect, useState } from "react";

export default function VerifyEmail() {
  const [msg, setMsg] = useState("Bitte warten…");

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const status = qs.get("status");
    if (status === "invalid") setMsg("❌ Link ungültig oder abgelaufen.");
    else if (status === "error") setMsg("❌ Unerwarteter Fehler.");
    else setMsg("✅ Verifizierung erfolgreich. Du wirst weitergeleitet…");
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>E-Mail-Bestätigung</h1>
      <p>{msg}</p>
    </main>
  );
}
