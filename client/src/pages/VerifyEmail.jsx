import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function VerifyEmail() {
  const [status, setStatus] = useState("Prüfe Bestätigung...");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("Kein Token gefunden.");
      return;
    }

    fetch(`http://localhost:3000/api/auth/verify?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setStatus("✅ E-Mail erfolgreich bestätigt!");
          setTimeout(() => navigate("/login"), 2000);
        } else {
          setStatus("❌ Bestätigung fehlgeschlagen: " + data.error);
        }
      })
      .catch(() => setStatus("❌ Serverfehler, bitte später versuchen."));
  }, [searchParams, navigate]);

  return (
    <main style={{ padding: "2rem" }}>
      <h1>E-Mail Bestätigung</h1>
      <p>{status}</p>
    </main>
  );
}
