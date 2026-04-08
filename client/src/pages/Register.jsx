import React, { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";
import "../styles/Register.css";

const pwdRule =
  /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_\-+=[{\]}:;,.?~]{8,}$/;

export default function Register() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    accept_terms: false,
    accept_privacy: false,
    accept_med_disclaimer: false,
    over18_confirmed: false,
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const copy = language === "en"
    ? {
        alert: "Notice:",
        alertText: "MedScoutX is not an emergency service (112 / 911).",
        title: "Create account",
        required: "Required field",
        email: "Email",
        emailHint: "We use your email for your account and important updates.",
        password: "Password",
        passwordPlaceholder: "At least 8 characters, number and letter",
        passwordHint: "At least 8 characters, including a number and a letter.",
        firstName: "First name",
        lastName: "Last name",
        birthDate: "Date of birth",
        minorTitle: "Notice:",
        minorText: "You are not yet of legal age. MedScoutX may only be used by people aged 18 and over.",
        gender: "Gender",
        genderPlaceholder: "Please choose...",
        genderFemale: "Female",
        genderMale: "Male",
        genderDiverse: "Diverse",
        genderNone: "Prefer not to say",
        consents: "Consents",
        ageConfirm: "I confirm that I am at least 18 years old",
        termsOpen: "Open terms and conditions",
        privacyOpen: "Open privacy policy",
        disclaimerOpen: "Open medical disclaimer",
        legalTextStart: "I have read the",
        legalTextMiddle: "privacy policy",
        legalTextEnd: "and agree to them.",
        submit: "Continue",
        saving: "Saving...",
        cancel: "Cancel",
        imprint: "Imprint",
        privacy: "Privacy",
        disclaimer: "Disclaimer",
        terms: "Terms",
        language: "Language",
        enterBirth: "Please enter your date of birth.",
        underage: "You are not yet of legal age. MedScoutX may only be used by people aged 18 and over.",
        confirmAge: "Please confirm that you are at least 18 years old.",
        checkFields: "Please check all required fields and consents.",
        emailExists: "This email is already registered.",
        failed: "Registration failed.",
        requestError: "Registration error.",
        srRequired: "(required field)",
      }
    : {
        alert: "Hinweis:",
        alertText: "MedScoutX ist kein Notfalldienst (112 / 116117)!",
        title: "Registrieren",
        required: "Pflichtfeld",
        email: "E-Mail",
        emailHint: "Wir verwenden deine E-Mail für dein Konto und wichtige Hinweise.",
        password: "Passwort",
        passwordPlaceholder: "Mind. 8 Zeichen, Zahl und Buchstabe",
        passwordHint: "Mindestens 8 Zeichen, inklusive Zahl und Buchstabe.",
        firstName: "Vorname",
        lastName: "Nachname",
        birthDate: "Geburtsdatum",
        minorTitle: "Hinweis:",
        minorText: "Du bist noch nicht volljährig. MedScoutX darf nur von Personen ab 18 Jahren genutzt werden.",
        gender: "Geschlecht",
        genderPlaceholder: "Bitte wählen...",
        genderFemale: "Weiblich",
        genderMale: "Männlich",
        genderDiverse: "Divers",
        genderNone: "Keine Angabe",
        consents: "Einwilligungen",
        ageConfirm: "Ich bestätige, dass ich mindestens 18 Jahre alt bin",
        termsOpen: "Allgemeine Geschäftsbedingungen öffnen",
        privacyOpen: "Datenschutzerklärung öffnen",
        disclaimerOpen: "Medizinischen Disclaimer öffnen",
        legalTextStart: "Ich habe die",
        legalTextMiddle: "die Datenschutzerklärung",
        legalTextEnd: "und den medizinischen Disclaimer gelesen und stimme diesen hiermit zu.",
        submit: "Weiter",
        saving: "Speichere...",
        cancel: "Abbrechen",
        imprint: "Impressum",
        privacy: "Datenschutz",
        disclaimer: "Disclaimer",
        terms: "AGB",
        language: "Sprache",
        enterBirth: "Bitte gib dein Geburtsdatum an.",
        underage: "Du bist noch nicht volljährig. MedScoutX darf nur von Personen ab 18 Jahren genutzt werden.",
        confirmAge: "Bitte bestätige, dass du mindestens 18 Jahre alt bist.",
        checkFields: "Bitte prüfe alle Pflichtfelder und Zustimmungen.",
        emailExists: "Diese E-Mail ist bereits registriert.",
        failed: "Registrierung fehlgeschlagen.",
        requestError: "Fehler bei der Registrierung.",
        srRequired: "(Pflichtfeld)",
      };

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

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
    const nameOk =
      form.first_name.trim().length > 0 &&
      form.last_name.trim().length > 0;
    const dobOk = !!form.date_of_birth && !isMinor;
    const consentOk =
      form.accept_terms &&
      form.accept_privacy &&
      form.accept_med_disclaimer;

    return emailOk && pwdOk && nameOk && dobOk && consentOk && form.over18_confirmed;
  }, [form, isMinor]);

  async function submit(e) {
    e.preventDefault();
    setErr("");

    if (!form.date_of_birth) {
      setErr(copy.enterBirth);
      return;
    }
    if (isMinor) {
      setErr(copy.underage);
      return;
    }
    if (!form.over18_confirmed) {
      setErr(copy.confirmAge);
      return;
    }
    if (!valid) {
      setErr(copy.checkFields);
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
          setErr(copy.emailExists);
        } else {
          setErr(data.error || copy.failed);
        }
        setBusy(false);
        return;
      }

      const data = await res.json();

      localStorage.setItem("pending_verification_email", payload.user.email);
      localStorage.setItem("pending_verification_user_id", data.user_id);
      navigate("/check-email", { replace: true });
    } catch (e2) {
      setErr(e2.message ?? copy.requestError);
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div className="alert-bar" role="note" style={{ margin: 0, flex: 1 }}>
            <strong>{copy.alert}</strong> {copy.alertText}
          </div>
          <LanguageSwitcher label={copy.language} compact />
        </div>

        <h1 id="register-heading" className="h1">
          {copy.title}
        </h1>

        <p className="required-hint">
          <span className="req">*</span> {copy.required}
        </p>

        <form className="form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="email" className="label">
              {copy.email} <span className="req" aria-hidden="true">*</span>
              <span className="sr-only"> {copy.srRequired}</span>
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              placeholder="name@example.com"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              aria-describedby="email-hint"
            />
            <small id="email-hint" className="hint">
              {copy.emailHint}
            </small>
          </div>

          <div className="field">
            <label htmlFor="password" className="label">
              {copy.password} <span className="req" aria-hidden="true">*</span>
              <span className="sr-only"> {copy.srRequired}</span>
            </label>
            <input
              id="password"
              type="password"
              required
              className="input"
              placeholder={copy.passwordPlaceholder}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              aria-describedby="pwd-hint"
              pattern={pwdRule.source}
              title={copy.passwordHint}
            />
            <small id="pwd-hint" className="hint">
              {copy.passwordHint}
            </small>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="first_name" className="label">
                {copy.firstName} <span className="req" aria-hidden="true">*</span>
                <span className="sr-only"> {copy.srRequired}</span>
              </label>
              <input
                id="first_name"
                className="input"
                placeholder={language === "en" ? "e.g. Alex" : "z. B. Max"}
                autoComplete="given-name"
                required
                value={form.first_name}
                onChange={(e) => setField("first_name", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="last_name" className="label">
                {copy.lastName} <span className="req" aria-hidden="true">*</span>
                <span className="sr-only"> {copy.srRequired}</span>
              </label>
              <input
                id="last_name"
                className="input"
                placeholder={language === "en" ? "e.g. Smith" : "z. B. Mustermann"}
                autoComplete="family-name"
                required
                value={form.last_name}
                onChange={(e) => setField("last_name", e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="dob" className="label">
              {copy.birthDate} <span className="req" aria-hidden="true">*</span>
              <span className="sr-only"> {copy.srRequired}</span>
            </label>
            <input
              id="dob"
              type="date"
              className="input"
              autoComplete="bday"
              required
              value={form.date_of_birth}
              onChange={(e) => setField("date_of_birth", e.target.value)}
              aria-invalid={isMinor ? "true" : "false"}
            />
            {isMinor && (
              <div className="minor-note" role="alert" aria-live="assertive">
                <strong>{copy.minorTitle}</strong> {copy.minorText}
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="gender" className="label">
              {copy.gender}
            </label>
            <select
              id="gender"
              className="input"
              value={form.gender}
              onChange={(e) => setField("gender", e.target.value)}
            >
              <option value="">{copy.genderPlaceholder}</option>
              <option value="weiblich">{copy.genderFemale}</option>
              <option value="männlich">{copy.genderMale}</option>
              <option value="divers">{copy.genderDiverse}</option>
              <option value="keine_angabe">{copy.genderNone}</option>
            </select>
          </div>

          <fieldset className="consents">
            <legend className="legend">{copy.consents}</legend>

            <label className="check">
              <input
                type="checkbox"
                required
                checked={form.over18_confirmed}
                onChange={(e) => setField("over18_confirmed", e.target.checked)}
                aria-required="true"
              />
              <span>
                {copy.ageConfirm} <span className="req" aria-hidden="true">*</span>
              </span>
            </label>

            <label className="check">
              <input
                type="checkbox"
                required
                checked={form.accept_terms}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setField("accept_terms", checked);
                  setField("accept_privacy", checked);
                  setField("accept_med_disclaimer", checked);
                }}
                aria-required="true"
              />
              <span>
                {copy.legalTextStart}{" "}
                <Link to="/agb" aria-label={copy.termsOpen}>
                  {copy.terms}
                </Link>
                {", "}
                <Link to="/datenschutz?public=1" aria-label={copy.privacyOpen}>
                  {copy.legalTextMiddle}
                </Link>{" "}
                {language === "en" ? "and" : "und"}{" "}
                <Link to="/disclaimer?public=1" aria-label={copy.disclaimerOpen}>
                  {copy.disclaimer}
                </Link>{" "}
                {copy.legalTextEnd}
                <span className="req" aria-hidden="true">*</span>
                <span className="sr-only"> {copy.srRequired}</span>
              </span>
            </label>
          </fieldset>

          {err && (
            <p className="error" role="alert" aria-live="assertive">
              {err}
            </p>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !valid}
              aria-disabled={busy || !valid}
            >
              {busy ? copy.saving : copy.submit}
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate("/")}
            >
              {copy.cancel}
            </button>
          </div>
        </form>

        <div className="legal-links" aria-label={language === "en" ? "Legal information" : "Rechtliche Informationen"}>
          <Link to="/impressum?public=1">{copy.imprint}</Link>
          <span className="sep">·</span>
          <Link to="/datenschutz?public=1">{copy.privacy}</Link>
          <span className="sep">·</span>
          <Link to="/disclaimer?public=1">{copy.disclaimer}</Link>
          <span className="sep">·</span>
          <Link to="/agb?from=register">{copy.terms}</Link>
        </div>
      </section>
    </main>
  );
}
