import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getMessages } from "../../i18n/translations/index.js";
import { authFetch } from "../../api/authFetch.js";

export default function AccountPersonalPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.accountPortal ?? getMessages("en").accountPortal;
  }, [language]);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    email: "",
    phone: "",
    displayName: "",
    genderOrSalutation: "",
    preferredPatientLanguage: "",
    preferredDoctorLanguage: "",
    emergencyNote: "",
    addressLine: "",
    postalCode: "",
    city: "",
    country: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/account/patient-settings");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      const u = j.user || {};
      const p = j.profile || {};
      setForm({
        firstName: u.firstName || "",
        lastName: u.lastName || "",
        dateOfBirth: u.dateOfBirth ? String(u.dateOfBirth).slice(0, 10) : "",
        email: u.email || "",
        phone: p.phone || "",
        displayName: p.displayName || "",
        genderOrSalutation: p.genderOrSalutation || "",
        preferredPatientLanguage: p.preferredPatientLanguage || "",
        preferredDoctorLanguage: p.preferredDoctorLanguage || "",
        emergencyNote: p.emergencyNote || "",
        addressLine: p.addressLine || "",
        postalCode: p.postalCode || "",
        city: p.city || "",
        country: p.country || "",
      });
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.title = `${t.personalTitle} — MedScoutX`;
  }, [t.personalTitle]);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setOk(false);
    try {
      const res = await authFetch("/api/account/patient-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth || null,
          phone: form.phone || null,
          displayName: form.displayName || null,
          genderOrSalutation: form.genderOrSalutation || null,
          preferredPatientLanguage: form.preferredPatientLanguage || null,
          preferredDoctorLanguage: form.preferredDoctorLanguage || null,
          emergencyNote: form.emergencyNote || null,
          addressLine: form.addressLine || null,
          postalCode: form.postalCode || null,
          city: form.city || null,
          country: form.country || null,
        }),
      });
      if (!res.ok) throw new Error();
      setOk(true);
      void load();
    } catch (e2) {
      if (e2?.message === "SESSION_EXPIRED") return;
      setError(t.saveError);
    } finally {
      setSaving(false);
    }
  }

  function upd(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  if (loading) return <p className="account-portal-card__empty">{t.saving}</p>;

  return (
    <div className="account-portal-page">
      <h1 className="account-portal-page__title">{t.personalTitle}</h1>
      <p className="account-portal-page__lead">{t.personalIntro}</p>
      {error ? <p className="account-portal__error">{error}</p> : null}
      {ok ? <p className="account-portal__ok">{t.save}</p> : null}

      <form className="account-portal-form" onSubmit={onSubmit}>
        <label className="account-portal-form__field">
          E-mail
          <input value={form.email} disabled className="account-portal-form__input" />
        </label>
        <label className="account-portal-form__field">
          {language === "de" ? "Vorname" : "First name"}
          <input className="account-portal-form__input" value={form.firstName} onChange={(e) => upd("firstName", e.target.value)} />
        </label>
        <label className="account-portal-form__field">
          {language === "de" ? "Nachname" : "Last name"}
          <input className="account-portal-form__input" value={form.lastName} onChange={(e) => upd("lastName", e.target.value)} />
        </label>
        <label className="account-portal-form__field">
          {language === "de" ? "Geburtsdatum" : "Date of birth"}
          <input type="date" className="account-portal-form__input" value={form.dateOfBirth} onChange={(e) => upd("dateOfBirth", e.target.value)} />
        </label>
        <label className="account-portal-form__field">
          {language === "de" ? "Anzeigename (optional)" : "Display name (optional)"}
          <input className="account-portal-form__input" value={form.displayName} onChange={(e) => upd("displayName", e.target.value)} />
        </label>
        <label className="account-portal-form__field">
          {language === "de" ? "Telefon" : "Phone"}
          <input className="account-portal-form__input" value={form.phone} onChange={(e) => upd("phone", e.target.value)} />
        </label>
        <label className="account-portal-form__field">
          {language === "de" ? "Anrede / Geschlecht (frei)" : "Salutation / gender (optional)"}
          <input className="account-portal-form__input" value={form.genderOrSalutation} onChange={(e) => upd("genderOrSalutation", e.target.value)} />
        </label>
        <label className="account-portal-form__field">
          {language === "de" ? "Bevorzugte Patientensprache" : "Preferred patient language"}
          <input className="account-portal-form__input" value={form.preferredPatientLanguage} onChange={(e) => upd("preferredPatientLanguage", e.target.value)} placeholder="de / en" />
        </label>
        <label className="account-portal-form__field">
          {language === "de" ? "Bevorzugte Arztsprache" : "Preferred doctor language"}
          <input className="account-portal-form__input" value={form.preferredDoctorLanguage} onChange={(e) => upd("preferredDoctorLanguage", e.target.value)} placeholder="de / en" />
        </label>
        <label className="account-portal-form__field">
          {language === "de" ? "Notiz Kontakt / Notfall (optional, nicht medizinisch)" : "Emergency / contact note (optional, non-medical)"}
          <textarea className="account-portal-form__textarea" rows={3} value={form.emergencyNote} onChange={(e) => upd("emergencyNote", e.target.value)} />
        </label>
        <label className="account-portal-form__field">
          {language === "de" ? "Adresse" : "Address"}
          <textarea className="account-portal-form__textarea" rows={2} value={form.addressLine} onChange={(e) => upd("addressLine", e.target.value)} />
        </label>
        <div className="account-portal-form__row">
          <label className="account-portal-form__field">
            PLZ / ZIP
            <input className="account-portal-form__input" value={form.postalCode} onChange={(e) => upd("postalCode", e.target.value)} />
          </label>
          <label className="account-portal-form__field">
            {language === "de" ? "Ort" : "City"}
            <input className="account-portal-form__input" value={form.city} onChange={(e) => upd("city", e.target.value)} />
          </label>
        </div>
        <label className="account-portal-form__field">
          {language === "de" ? "Land" : "Country"}
          <input className="account-portal-form__input" value={form.country} onChange={(e) => upd("country", e.target.value)} />
        </label>

        <button type="submit" className="account-portal__btn account-portal__btn--primary" disabled={saving}>
          {saving ? t.saving : t.save}
        </button>
      </form>
    </div>
  );
}
