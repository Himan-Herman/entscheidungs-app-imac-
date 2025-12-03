import React, { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Register.css";

const pwdRule =
  /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_\-+=[{\]}:;,.?~]{8,}$/;

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    // Einwilligungen
    accept_terms: false,
    accept_privacy: false,
    accept_med_disclaimer: false,
    // 18+ Bestätigung
    over18_confirmed: false,
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // Altersberechnung
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

  // Gesamte Gültigkeit – KEEP IT SIMPLE
  const valid = useMemo(() => {
    const emailOk = /\S+@\S+\.\S+/.test(form.email);
    const pwdOk = pwdRule.test(form.password);
    const nameOk =
      form.first_name.trim().length > 0 &&
      form.last_name.trim().length > 0;
    const dobOk = !!form.date_of_birth && !isMinor;
    const consentOk =
      form.accept_terms &&
      form.accept_privacy &&
      form.accept_med_disclaimer;
    const ageConfirmOk = form.over18_confirmed;

    return emailOk && pwdOk && nameOk && dobOk && consentOk && ageConfirmOk;
  }, [form, isMinor]);

  async function submit(e) {
    e.preventDefault();
    setErr("");

    // Minimale Checks, NICHT übertreiben
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
    if (!valid) {
      setErr("Bitte prüfe alle Pflichtfelder und Zustimmungen.");
      return;
    }

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
        // Profil-Daten – aktuell minimal, Rest auf null
        profile: {
          phone: null,
          postal_code: null,
          country: null,
          insurance_type: null,
          address_line: null,
          city: null,
          gender: form.gender || null,
        },
        consent: {
          terms_accepted: form.accept_terms,
          privacy_accepted: form.accept_privacy,
          medical_disclaimer_accepted: form.accept_med_disclaimer,
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

      // NACH REGISTRIERUNG → später Abo-Seite,
      // vorerst wie gehabt:
      navigate("/check-email", { replace: true });
    } catch (e2) {
      setErr(e2.message ?? "Fehler bei der Registrierung.");
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
              className="input"
              placeholder="z. B. name@example.com"
              autoComplete="email"
              value={form.email}
              onChange={e => setField("email", e.target.value)}
              aria-describedby="email-hint"
            />
            <small id="email-hint" className="hint">
              Wir verwenden deine E-Mail für dein Konto und wichtige Hinweise.
            </small>
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
              className="input"
              placeholder="Mind. 8 Zeichen, Zahl &amp; Buchstabe"
              autoComplete="new-password"
              value={form.password}
              onChange={e => setField("password", e.target.value)}
              aria-describedby="pwd-hint"
              pattern={pwdRule.source}
              title="Mindestens 8 Zeichen, mindestens 1 Buchstabe und 1 Zahl"
            />
            <small id="pwd-hint" className="hint">
              Mindestens 8 Zeichen, inklusive Zahl &amp; Buchstabe.
            </small>
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
                className="input"
                placeholder="z. B. Max"
                autoComplete="given-name"
                required
                value={form.first_name}
                onChange={e => setField("first_name", e.target.value)}
              />
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
                className="input"
                placeholder="z. B. Mustermann"
                autoComplete="family-name"
                required
                value={form.last_name}
                onChange={e => setField("last_name", e.target.value)}
              />
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
              id="dob"
              type="date"
              className="input"
              placeholder="TT.MM.JJJJ"
              autoComplete="bday"
              required
              value={form.date_of_birth}
              onChange={e => setField("date_of_birth", e.target.value)}
              aria-invalid={isMinor ? "true" : "false"}
            />
            {isMinor && (
              <div
                className="minor-note"
                role="alert"
                aria-live="assertive"
              >
                <strong>Hinweis:</strong> Du bist noch nicht volljährig.
                MedScoutX darf nur von Personen ab 18 Jahren genutzt werden.
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
                onChange={e =>
                  setField("over18_confirmed", e.target.checked)
                }
                aria-required="true"
              />
              <span>
                Ich bestätige, dass ich mindestens 18 Jahre alt bin{" "}
                <span className="req" aria-hidden="true">
                  *
                </span>
              </span>
            </label>

            {/* EINE gesammelte Rechtsklausel */}
            <label className="check">
              <input
                type="checkbox"
                required
                checked={form.accept_terms}
                onChange={e => {
                  const checked = e.target.checked;
                  setField("accept_terms", checked);
                  setField("accept_privacy", checked);
                  setField("accept_med_disclaimer", checked);
                }}
                aria-required="true"
              />
              <span>
                Ich habe die{" "}
                <Link
                  to="/agb"
                  aria-label="Allgemeine Geschäftsbedingungen öffnen"
                >
                  Allgemeinen Geschäftsbedingungen
                </Link>
                {", "}
                <Link
                  to="/datenschutz?public=1"
                  aria-label="Datenschutzerklärung öffnen"
                >
                  die Datenschutzerklärung
                </Link>{" "}
                und den{" "}
                <Link
                  to="/disclaimer?public=1"
                  aria-label="Medizinischen Disclaimer öffnen"
                >
                  medizinischen Disclaimer
                </Link>{" "}
                gelesen und stimme diesen hiermit zu.
                <span className="req" aria-hidden="true">
                  *
                </span>
                <span className="sr-only"> (Pflichtfeld)</span>
              </span>
            </label>
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
