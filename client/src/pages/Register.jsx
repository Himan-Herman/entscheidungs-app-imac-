import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Register.css";

const pwdRule =
  /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_\-+=[{\]}:;,.?~]{8,}$/; 

export default function Register() {
  const navigate = useNavigate(); // 
  const [form, setForm] = useState({
    email: "", password: "",
    first_name: "", last_name: "", date_of_birth: "",
    accept_terms: false,
    accept_privacy: false,
    accept_med_disclaimer: false,
    doctor_alert_consent: false,
    phone: "", postal_code: "", country: "",   
    address_line: "", city: "",
    gender: "", // "weiblich" | "männlich" | "divers" | "keine_angabe"

    insurance_type: "" 
  });
  
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const MAX_DOCTORS = 5;

  
  const [doctors, setDoctors] = useState([
    { name: "", specialty: "", clinic_name: "", email_secure: "", phone: "", address: "", allow_alerts: false }
  ]);
  const [doctorMsg, setDoctorMsg] = useState("");
  
  function addDoctor() {
    if (doctors.length >= MAX_DOCTORS) {
      setDoctorMsg(`Maximal ${MAX_DOCTORS} Ärzte möglich.`);
      return;
    }
    setDoctorMsg("");
    setDoctors(d => [...d, { name: "", specialty: "", clinic_name: "", email_secure: "", phone: "", address: "", allow_alerts: false }]);
    // optional: Fokus auf neues Feld
    setTimeout(() => {
      const el = document.getElementById(`doc-name-${doctors.length}`);
      el?.focus();
    }, 0);
  }
  function removeDoctor(idx) {
    setDoctors(d => d.filter((_, i) => i !== idx));
    setDoctorMsg("");
  }
  function setDoctor(idx, key, value) {
    setDoctors(d => d.map((doc, i) => (i === idx ? { ...doc, [key]: value } : doc)));
  }
  


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
      const doctorsClean = doctors
      .filter(d => d.name || d.specialty || d.clinic_name || d.email_secure || d.phone || d.address)
      .slice(0, MAX_DOCTORS);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
            insurance_type: form.insurance_type || null,
            address_line: form.address_line || null,
            city: form.city || null,
            gender: form.gender || null,
          },
          consent: {
            terms_accepted: form.accept_terms,
            privacy_accepted: form.accept_privacy,
            medical_disclaimer_accepted: form.accept_med_disclaimer,
            doctor_alert_consent: form.doctor_alert_consent
          },
          doctors: doctorsClean
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
    <main className="container">
      <section className="register-container">
      <div className="alert-bar" role="note">
        <strong>Hinweis:</strong> MedScout ist kein Notfalldienst (112 / 116117)!
      </div>

      <h1 className="h1">Registrieren</h1>

      <form className="form" onSubmit={submit} noValidate>
      
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
              placeholder="z. B. Max"
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
              placeholder="z. B. Mustermann"
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
        <div className="field">
  <label htmlFor="gender" className="label">Geschlecht</label>
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
  <small className="hint">Optional. Hilft bei passenderen Hinweisen.</small>
</div>


<div className="field">
<label className="label">Adresse <span className="req" aria-hidden="true">*</span><span className="sr-only"> (Pflichtfeld)</span></label>
  <div className="grid-4">
    <input
      className="input"
      id="address_line"
      placeholder="Straße & Nr. (z. B. Musterstraße 12)"
      autoComplete="address-line1"
      value={form.address_line}
      onChange={e => setField("address_line", e.target.value)}
      required />
    <input
      className="input"
      id="postal_code2"
      placeholder="PLZ (z. B. 45127)"
      autoComplete="postal-code"
      value={form.postal_code}
      
      onChange={e => setField("postal_code", e.target.value)}
      required/>
    <input
      className="input"
      id="city"
      placeholder="Ort (z. B. Essen)"
      autoComplete="address-level2"
      value={form.city}
      onChange={e => setField("city", e.target.value)}
      required/>
    <input
      className="input"
      id="country2"
      placeholder="Land (z. B. Deutschland)"
      autoComplete="country-name"
      value={form.country}
      onChange={e => setField("country", e.target.value)}
      required/>
  </div>
</div>

        
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

        
        <details className="opt-details">
          <summary className="opt-summary">Optionale Angaben</summary>
          <fieldset className="doctors-block">
  <legend className="legend">Ärzte & Behandler (optional)</legend>

  {doctors.map((doc, i) => (
    <div key={i} className="doctor-card">
      <div className="doctor-title">Arzt {i + 1}</div>
      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor={`doc-name-${i}`}>Name des Arztes/der Ärztin</label>
          <input
            id={`doc-name-${i}`}
            className="input"
            placeholder="z. B. Dr. med. Max Mustermann"
            value={doc.name}
            onChange={e => setDoctor(i, "name", e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor={`doc-specialty-${i}`}>Fachrichtung</label>
          <select
            id={`doc-specialty-${i}`}
            className="input"
            value={doc.specialty}
            onChange={e => setDoctor(i, "specialty", e.target.value)}
          >
            <option value="">Bitte wählen …</option>
            <option value="Hausarzt">Hausarzt</option>
            <option value="Internist">Internist</option>
            <option value="Dermatologie">Dermatologie</option>
            <option value="Gynäkologie">Gynäkologie</option>
            <option value="Urologie">Urologie</option>
            <option value="Orthopädie">Orthopädie</option>
            <option value="Pädiatrie">Pädiatrie</option>
            <option value="Kardiologie">Kardiologie</option>
            <option value="HNO">HNO</option>
            <option value="Neurologie">Neurologie</option>
            <option value="Sonstiges">Sonstiges</option>
          </select>
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor={`doc-clinic-${i}`}>Praxis / Klinik</label>
          <input
            id={`doc-clinic-${i}`}
            className="input"
            placeholder="z. B. MVZ Stadtmitte"
            value={doc.clinic_name}
            onChange={e => setDoctor(i, "clinic_name", e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor={`doc-email-${i}`}>E-Mail (bevorzugt sicher)</label>
          <input
            id={`doc-email-${i}`}
            type="email"
            className="input"
            placeholder="praxis@beispiel.de"
            value={doc.email_secure}
            onChange={e => setDoctor(i, "email_secure", e.target.value)}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor={`doc-phone-${i}`}>Telefon</label>
          <input
            id={`doc-phone-${i}`}
            className="input"
            placeholder="+49 …"
            value={doc.phone}
            onChange={e => setDoctor(i, "phone", e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor={`doc-address-${i}`}>Adresse</label>
          <input
            id={`doc-address-${i}`}
            className="input"
            placeholder="Straße Nr., PLZ, Ort"
            value={doc.address}
            onChange={e => setDoctor(i, "address", e.target.value)}
          />
        </div>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={doc.allow_alerts}
          onChange={e => setDoctor(i, "allow_alerts", e.target.checked)}
        />
        <span>Darf im Ernstfall benachrichtigt werden</span>
      </label>

      <div className="doctor-actions">
        <button
          type="button"
          className="btn btn-outline btn-small"
          onClick={() => removeDoctor(i)}
        >
          Entfernen
        </button>
      </div>
    </div>
  ))}

<button
  type="button"
  className="btn btn-primary add-doctor"
  onClick={addDoctor}
  disabled={doctors.length >= MAX_DOCTORS}
  aria-disabled={doctors.length >= MAX_DOCTORS}
>
  + Arzt hinzufügen
</button>

<div className="doctor-limit">
  <span>noch {MAX_DOCTORS - doctors.length} / {MAX_DOCTORS} möglich</span>
  {doctorMsg && <span className="error">{doctorMsg}</span>}
</div>

</fieldset>

          
          <div className="field">
   <label htmlFor="insurance_type" className="label">Versicherungsstatus</label>
   <select
     id="insurance_type"
     className="input"
     value={form.insurance_type}
     onChange={e => setField("insurance_type", e.target.value)}
   >
     <option value="">Bitte wählen …</option>
     <option value="gesetzlich">Gesetzlich</option>
     <option value="privat">Privat</option>
     <option value="sonstiges">Sonstiges</option>
   </select>
   <small className="hint">Keine Nummern im MVP – nur der Status.</small>
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
      </section>
    </main>
  );
}
