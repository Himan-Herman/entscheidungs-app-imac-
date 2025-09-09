import { useSearchParams, Link } from "react-router-dom";

export default function Verifiziert() {
  const [sp] = useSearchParams();
  const ok = sp.get("ok") === "1";
  const reason = sp.get("reason");
  return (
    <main style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <h1>{ok ? "E-Mail verifiziert ✅" : "Verifizierung fehlgeschlagen ❌"}</h1>
      {ok ? (
        <>
          <p>Deine E-Mail wurde bestätigt.</p>
          <Link to="/login" className="btn">Weiter zum Login</Link>
        </>
      ) : (
        <>
          <p>Der Link ist ungültig oder abgelaufen{reason ? ` (${reason})` : ""}.</p>
          <Link to="/resend" className="btn">Neuen Link anfordern</Link>
        </>
      )}
    </main>
  );
}
