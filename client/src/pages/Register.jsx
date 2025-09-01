import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Register.css";

const pwdRule =
  /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_\-+=\[{\]}:;,.?~]{8,}$/; // ≥8, 1 Buchstabe, 1 Zahl

export default function Register() {
  const navigate = useNavigate(); // <— BUGFIX: konsistente Benennung
  const [form, setForm] = useState({
    email: "", password: "",
    first_name: "", last_name: "", date_of_birth: "",
    accept_terms: false,
    accept_privacy: false,
    accept_med_disclaimer: false,
    doctor_alert_consent: false,
    phone: "", postal_code: "", country: ""
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const isMinor = useMemo(() => {
    if (!form.date_of_birth) return false;
    const dob = new Date(form.date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age < 18;
  }, [form.date_of_birth]);

  const valid = useMemo(() => {
    const emailOk = /\S+@\S+\.\S+/.test(form.email);
    const pwdOk = pwdRule.test(form.password);
    const nameOk = form.first_name.trim() && form.last_name.trim();
    const dobOk = !!form.date_of_birth;
    const consentOk = form.accept_terms && form.accept_privacy && form.accept_med_disclaimer;
    return emailOk && pwdOk && nameOk && dobOk && consentOk;
  }, [form]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!valid) { setErr("Bitte Pflichtfelder prüfen und Richtlinien akzeptieren."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: {
            email: form.email,
            password: form.password, // Backend hasht
            first_name: form.first_name,
            last_name: form.last_name,
            date_of_birth: form.date_of_birth,
          },
          profile: {
            phone: form.phone || null,
            postal_code: form.postal_code || null,
            country: form.country || null,
          },
          consent: {
            terms_accepted: form.accept_terms,
            privacy_accepted: form.accept_privacy,
            medical_disclaimer_accepted: form.accept_med_disclaimer,
            doctor_alert_consent: form.doctor_alert_consent
          }
        })
      });
      if (!res.ok) throw new Error("Registrierung fehlgeschlagen.");
      const data = await res.json();
      localStorage.setItem("medscout_registered", "true");
      localStorage.setItem("medscout_user_id", data.user_id);
      navigate("/intro", { replace: true }); // <— BUGFIX: navigate statt nav
    } catch (e2) {
      setErr(e2.message ?? "Fehler.");
    } finally { setBusy(false); }
  }

  function setField(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  return (
    <main className="register-container">
      <div className="alert-bar" role="note">
        <strong>Hinweis:</strong> MedScout ist kein Notfalldienst (112 / 116117)!
      </div>

      <h1 className="h1">Registrieren</h1>

      <form className="form" onSubmit={submit} noValidate>
        {/* Pflichtfelder */}
        <div className="field">
          <label htmlFor="email" className="label">
            E-Mail <span className="req" aria-hidden="true">*</span>
            <span className="sr-only"> (Pflichtfeld)</span>
          </label>
          <input
            id="email"
            type="email"
            required
            className="input"
            placeholder="z. B. name@example.com"
            autoComplete="email"
            value={form.email}
            onChange={e => setField("email", e.target.value)}
            aria-describedby="email-hint"
          />
          <small id="email-hint" className="hint">Wir senden ggf. eine Verifizierungs-Mail.</small>
        </div>

        <div className="field">
          <label htmlFor="password" className="label">
            Passwort <span className="req" aria-hidden="true">*</span>
            <span className="sr-only"> (Pflichtfeld)</span>
          </label>
          <input
            id="password"
            type="password"
            required
            className="input"
            placeholder="Mind. 8 Zeichen, Zahl & Buchstabe"
            autoComplete="new-password"
            value={form.password}
            onChange={e => setField("password", e.target.value)}
            aria-describedby="pwd-hint"
            pattern={pwdRule.source}
            title="Mindestens 8 Zeichen, mindestens 1 Buchstabe und 1 Zahl"
          />
          <small id="pwd-hint" className="hint">Mind. 8 Zeichen, inkl. Zahl & Buchstabe.</small>
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="first_name" className="label">
              Vorname <span className="req" aria-hidden="true">*</span><span className="sr-only"> (Pflichtfeld)</span>
            </label>
            <input
              id="first_name"
              className="input"
              placeholder="z. B. Alex"
              autoComplete="given-name"
              required
              value={form.first_name}
              onChange={e => setField("first_name", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="last_name" className="label">
              Nachname <span className="req" aria-hidden="true">*</span><span className="sr-only"> (Pflichtfeld)</span>
            </label>
            <input
              id="last_name"
              className="input"
              placeholder="z. B. Müller"
              autoComplete="family-name"
              required
              value={form.last_name}
              onChange={e => setField("last_name", e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="dob" className="label">
            Geburtsdatum <span className="req" aria-hidden="true">*</span><span className="sr-only"> (Pflichtfeld)</span>
          </label>
          <input
            id="dob"
            type="date"
            className="input"
            placeholder="TT.MM.JJJJ"
            autoComplete="bday"
            required
            value={form.date_of_birth}
            onChange={e => setField("date_of_birth", e.target.value)}
          />
          {isMinor && (
            <div className="minor-note" role="status">
              <strong>Hinweis:</strong> Unter 18: In den Einstellungen bitte Erziehungsberechtigte*n hinterlegen.
            </div>
          )}
        </div>

        {/* Consents */}
        <fieldset className="consents">
          <legend className="legend">Einwilligungen</legend>

          <label className="check">
            <input
              type="checkbox"
              required
              checked={form.accept_terms}
              onChange={e => setField("accept_terms", e.target.checked)}
            />
            <span>AGB akzeptieren <span className="req" aria-hidden="true">*</span></span>
          </label>

          <label className="check">
            <input
              type="checkbox"
              required
              checked={form.accept_privacy}
              onChange={e => setField("accept_privacy", e.target.checked)}
            />
            <span>Datenschutzerklärung akzeptieren <span className="req" aria-hidden="true">*</span></span>
          </label>

          <label className="check">
            <input
              type="checkbox"
              required
              checked={form.accept_med_disclaimer}
              onChange={e => setField("accept_med_disclaimer", e.target.checked)}
            />
            <span>Medizinischer Disclaimer gelesen <span className="req" aria-hidden="true">*</span></span>
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={form.doctor_alert_consent}
              onChange={e => setField("doctor_alert_consent", e.target.checked)}
            />
            <span>„Arzt-Benachrichtigung im Ernstfall“ erlauben (optional)</span>
          </label>
        </fieldset>

        {/* Optional – „Später hinzufügen“ */}
        <details className="opt-details">
          <summary className="opt-summary">Optionale Angaben (später möglich)</summary>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="phone" className="label">Telefon</label>
              <input
                id="phone"
                className="input"
                placeholder="+49 160 1234567"
                autoComplete="tel"
                value={form.phone}
                onChange={e => setField("phone", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="postal_code" className="label">PLZ</label>
              <input
                id="postal_code"
                className="input"
                placeholder="z. B. 45127"
                autoComplete="postal-code"
                value={form.postal_code}
                onChange={e => setField("postal_code", e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="country" className="label">Land</label>
            <input
              id="country"
              className="input"
              placeholder="z. B. Deutschland"
              autoComplete="country-name"
              value={form.country}
              onChange={e => setField("country", e.target.value)}
            />
          </div>
        </details>

        {err && <p className="error" role="alert">{err}</p>}

        <button
  type="submit"
  className="btn btn-primary"
  disabled={busy || !valid}
  aria-disabled={busy || !valid}
>
  {busy ? "Speichere …" : "Weiter"}
</button>

<button
  type="button"
  className="btn btn-ghost"
  onClick={() => navigate("/startseite")}
>
  Abbrechen
</button>


      </form>
    </main>
  );
}
