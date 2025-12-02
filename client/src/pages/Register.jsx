import React, { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Register.css";

const pwdRule =
  /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_\-+=[{\]}:;,.?~]{8,}$/;

export default function Register() {
  const navigate = useNavigate();
  const [fieldErrors, setFieldErrors] = useState({});


  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    date_of_birth: "",
    accept_terms: false,
    accept_privacy: false,
    accept_med_disclaimer: false,
    doctor_alert_consent: false,
    phone: "",
    postal_code: "",
    country: "",
    address_line: "",
    city: "",
    gender: "",
    // neue Bestätigung: über 18
    over18_confirmed: false,
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // Altersberechnung aus Geburtsdatum
  const isMinor = useMemo(() => {
    if (!form.date_of_birth) return false;
    const dob = new Date(form.date_of_birth);
    if (Number.isNaN(dob.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age < 18;
  }, [form.date_of_birth]);

  const valid = useMemo(() => {
    const emailOk = /\S+@\S+\.\S+/.test(form.email);
    const pwdOk = pwdRule.test(form.password);
    const nameOk = form.first_name.trim() && form.last_name.trim();
    const dobOk = !!form.date_of_birth;
    const ageOk = dobOk && !isMinor && form.over18_confirmed;
    const consentOk =
      form.accept_terms && form.accept_privacy && form.accept_med_disclaimer;

    return emailOk && pwdOk && nameOk && dobOk && ageOk && consentOk;
  }, [form, isMinor]);

  async function submit(e) {
    e.preventDefault();
    setErr("");

    // Spezifische Checks für Alter
    if (!form.date_of_birth) {
      setErr("Bitte gib dein Geburtsdatum an.");
      return;
    }

    if (isMinor) {
      setErr(
        "Du bist noch nicht volljährig. MedScoutX darf nur von Personen ab 18 Jahren genutzt werden."
      );
      return;
    }

    if (!form.over18_confirmed) {
      setErr("Bitte bestätige, dass du mindestens 18 Jahre alt bist.");
      return;
    }

    // Validierung aller Pflichtfelder
const newErrors = {};

if (!form.email.trim()) newErrors.email = "E-Mail ist erforderlich.";
if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = "Ungültige E-Mail-Adresse.";

if (!pwdRule.test(form.password))
  newErrors.password = "Passwort erfüllt die Anforderungen nicht.";

if (!form.first_name.trim())
  newErrors.first_name = "Vorname ist erforderlich.";

if (!form.last_name.trim())
  newErrors.last_name = "Nachname ist erforderlich.";

if (!form.date_of_birth)
  newErrors.date_of_birth = "Bitte Geburtsdatum angeben.";

if (isMinor)
  newErrors.date_of_birth = "Du musst mindestens 18 Jahre alt sein.";

if (!form.over18_confirmed)
  newErrors.over18_confirmed = "Bitte bestätigen.";

// Adresse
if (!form.address_line.trim()) newErrors.address_line = "Pflichtfeld.";
if (!form.postal_code.trim()) newErrors.postal_code = "Pflichtfeld.";
if (!form.city.trim()) newErrors.city = "Pflichtfeld.";
if (!form.country.trim()) newErrors.country = "Pflichtfeld.";

// AGB / Datenschutz / Disclaimer
if (!form.accept_terms || !form.accept_privacy || !form.accept_med_disclaimer) {
  newErrors.accept_terms = "Bitte zustimmen.";
}

if (Object.keys(newErrors).length > 0) {
  setFieldErrors(newErrors);

  // Scroll to first invalid field
  const firstKey = Object.keys(newErrors)[0];
  const el = document.getElementById(firstKey);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus();
  }

  setErr("Bitte Pflichtfelder prüfen.");
  return;
}

setFieldErrors({});


    setBusy(true);
    try {
      const payload = {
        user: {
          email: form.email,
          password: form.password,
          first_name: form.first_name,
          last_name: form.last_name,
          date_of_birth: form.date_of_birth,
        },
        profile: {
          phone: form.phone || null,
          postal_code: form.postal_code || null,
          country: form.country || null,
          address_line: form.address_line || null,
          city: form.city || null,
          gender: form.gender || null,
        },
        consent: {
          terms_accepted: form.accept_terms,
          privacy_accepted: form.accept_privacy,
          medical_disclaimer_accepted: form.accept_med_disclaimer,
          doctor_alert_consent: form.doctor_alert_consent,
          // über 18 wird aktuell nur im Frontend geprüft
        },
      };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "EMAIL_EXISTS") {
          setErr("Diese E-Mail ist bereits registriert.");
        } else {
          setErr(data.error || "Registrierung fehlgeschlagen.");
        }
        setBusy(false);
        return;
      }

      const data = await res.json();

      localStorage.setItem("pending_verification_email", payload.user.email);
      localStorage.setItem("pending_verification_user_id", data.user_id);
      navigate("/check-email", { replace: true });
    } catch (e2) {
      setErr(e2.message ?? "Fehler.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="register-page" role="main">
      <section
        className="register-container"
        aria-labelledby="register-heading"
      >
        <div className="alert-bar" role="note">
          <strong>Hinweis:</strong> MedScoutX ist kein Notfalldienst
          (112 / 116117)!
        </div>

        <h1 id="register-heading" className="h1">
          Registrieren
        </h1>
        <p className="required-hint">
  <span className="req">*</span> Pflichtfeld
</p>


<form className="form" onSubmit={submit} noValidate>
  {/* E-Mail */}
  <div className="field">
    <label htmlFor="email" className="label">
      E-Mail{" "}
      <span className="req" aria-hidden="true">
        *
      </span>
      <span className="sr-only"> (Pflichtfeld)</span>
    </label>

    <input
      id="email"
      type="email"
      required
      placeholder="z. B. name@example.com"
      autoComplete="email"
      value={form.email}
      onChange={e => setField("email", e.target.value)}
      aria-invalid={!!fieldErrors.email}
      aria-describedby="email-hint"
      className={`input ${fieldErrors.email ? "input-error" : ""}`}
    />

    <small id="email-hint" className="hint">
      Wir verwenden deine E-Mail für dein Konto und wichtige Hinweise.
    </small>

    {fieldErrors.email && (
      <p className="field-error" role="alert">
        {fieldErrors.email}
      </p>
    )}
  </div>



          {/* Passwort */}
<div className="field">
  <label htmlFor="password" className="label">
    Passwort{" "}
    <span className="req" aria-hidden="true">
      *
    </span>
    <span className="sr-only"> (Pflichtfeld)</span>
  </label>
  <input
    id="password"
    type="password"
    required
    placeholder="Mind. 8 Zeichen, Zahl &amp; Buchstabe"
    autoComplete="new-password"
    value={form.password}
    onChange={e => setField("password", e.target.value)}
    aria-describedby="pwd-hint"
    aria-invalid={!!fieldErrors.password}
    className={`input ${fieldErrors.password ? "input-error" : ""}`}
    pattern={pwdRule.source}
    title="Mindestens 8 Zeichen, mindestens 1 Buchstabe und 1 Zahl"
  />
  <small id="pwd-hint" className="hint">
    Mindestens 8 Zeichen, inklusive Zahl &amp; Buchstabe.
  </small>
  {fieldErrors.password && (
    <p className="field-error" role="alert">
      {fieldErrors.password}
    </p>
  )}
</div>


          {/* Name */}
<div className="grid-2">
  <div className="field">
    <label htmlFor="first_name" className="label">
      Vorname{" "}
      <span className="req" aria-hidden="true">
        *
      </span>
      <span className="sr-only"> (Pflichtfeld)</span>
    </label>
    <input
      id="first_name"
      className={`input ${
        fieldErrors.first_name ? "input-error" : ""
      }`}
      placeholder="z. B. Max"
      autoComplete="given-name"
      required
      value={form.first_name}
      onChange={e => setField("first_name", e.target.value)}
      aria-invalid={!!fieldErrors.first_name}
    />
    {fieldErrors.first_name && (
      <p className="field-error" role="alert">
        {fieldErrors.first_name}
      </p>
    )}
  </div>

  <div className="field">
    <label htmlFor="last_name" className="label">
      Nachname{" "}
      <span className="req" aria-hidden="true">
        *
      </span>
      <span className="sr-only"> (Pflichtfeld)</span>
    </label>
    <input
      id="last_name"
      className={`input ${
        fieldErrors.last_name ? "input-error" : ""
      }`}
      placeholder="z. B. Mustermann"
      autoComplete="family-name"
      required
      value={form.last_name}
      onChange={e => setField("last_name", e.target.value)}
      aria-invalid={!!fieldErrors.last_name}
    />
    {fieldErrors.last_name && (
      <p className="field-error" role="alert">
        {fieldErrors.last_name}
      </p>
    )}
  </div>
</div>


          {/* Geburtsdatum */}
<div className="field">
  <label htmlFor="dob" className="label">
    Geburtsdatum{" "}
    <span className="req" aria-hidden="true">
      *
    </span>
    <span className="sr-only"> (Pflichtfeld)</span>
  </label>
  <input
    id="date_of_birth"
    type="date"
    className={`input ${
      fieldErrors.date_of_birth ? "input-error" : ""
    }`}
    placeholder="TT.MM.JJJJ"
    autoComplete="bday"
    required
    value={form.date_of_birth}
    onChange={e => setField("date_of_birth", e.target.value)}
    aria-invalid={!!fieldErrors.date_of_birth}
  />

  {fieldErrors.date_of_birth && (
    <p className="field-error" role="alert">
      {fieldErrors.date_of_birth}
    </p>
  )}

  {/* Zusatzhinweis bei Minderjährigen (falls du ihn behalten willst) */}
  {isMinor && !fieldErrors.date_of_birth && (
    <div className="minor-note" role="alert" aria-live="assertive">
      <strong>Hinweis:</strong> Du bist noch nicht volljährig. MedScoutX darf
      nur von Personen ab 18 Jahren genutzt werden.
    </div>
  )}
</div>


          {/* Geschlecht (optional) */}
          <div className="field">
            <label htmlFor="gender" className="label">
              Geschlecht
            </label>
            <select
              id="gender"
              className="input"
              value={form.gender}
              onChange={e => setField("gender", e.target.value)}
            >
              <option value="">Bitte wählen …</option>
              <option value="weiblich">Weiblich</option>
              <option value="männlich">Männlich</option>
              <option value="divers">Divers</option>
              <option value="keine_angabe">Keine Angabe</option>
            </select>
          </div>

          

          {/* Einwilligungen */}
<fieldset className="consents">
  <legend className="legend">Einwilligungen</legend>

  {/* 18+ Bestätigung */}
  <label className="check">
    <input
      type="checkbox"
      required
      checked={form.over18_confirmed}
      onChange={e => setField("over18_confirmed", e.target.checked)}
      aria-required="true"
    />
    <span>
      Ich bestätige, dass ich mindestens 18 Jahre alt bin
      <span className="req" aria-hidden="true"> *</span>
    </span>
  </label>

  {/* EINZIGE GESAMT-RECHTSKLAUSEL */}
  <label className="check">
    <input
      type="checkbox"
      required
      checked={form.accept_terms}
      onChange={e => {
        // Diese Checkbox setzt ALLE drei früheren Zustimmungen gemeinsam
        setField("accept_terms", e.target.checked);
        setField("accept_privacy", e.target.checked);
        setField("accept_med_disclaimer", e.target.checked);
      }}
      aria-required="true"
    />
    <span>
      Ich habe die{" "}
      <Link to="/agb" aria-label="Allgemeine Geschäftsbedingungen öffnen">
        AGB
      </Link>
      {", "}
      <Link
        to="/datenschutz?public=1"
        aria-label="Datenschutzerklärung öffnen"
      >
         Datenschut &
      </Link>
      {" "}und den{" "}
      <Link
        to="/disclaimer?public=1"
        aria-label="Medizinischen Disclaimer öffnen"
      >
         Disclaimer
      </Link>{" "}
      gelesen und stimme diesen hiermit zu.
      <span className="req" aria-hidden="true"> *</span>
      <span className="sr-only"> (Pflichtfeld)</span>
    </span>
  </label>

  {/* Arzt-Benachrichtigung (optional) */}
  
</fieldset>


          {/* Fehlermeldung */}
          {err && (
            <p className="error" role="alert" aria-live="assertive">
              {err}
            </p>
          )}

          {/* Buttons */}
          <div className="form-actions">
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
          </div>
        </form>

        {/* Footer mit rechtlichen Links */}
        <div className="legal-links" aria-label="Rechtliche Informationen">
          <Link to="/impressum?public=1">Impressum</Link>
          <span className="sep">·</span>
          <Link to="/datenschutz?public=1">Datenschutz</Link>
          <span className="sep">·</span>
          <Link to="/disclaimer?public=1">Disclaimer</Link>
          <span className="sep">·</span>
          <Link to="/agb?from=register">AGB</Link>
        </div>
      </section>
    </main>
  );
}
