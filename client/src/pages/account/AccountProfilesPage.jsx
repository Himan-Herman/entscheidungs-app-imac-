import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getMessages } from "../../i18n/translations/index.js";
import { authFetch } from "../../api/authFetch.js";

export default function AccountProfilesPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.accountPortal ?? getMessages("en").accountPortal;
  }, [language]);

  const [profiles, setProfiles] = useState([]);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    relationLabel: "",
    dateOfBirth: "",
    genderOrSalutation: "",
    preferredPatientLanguage: "",
    preferredDoctorLanguage: "",
  });

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await authFetch("/api/account/family-profiles");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      setProfiles(Array.isArray(j.profiles) ? j.profiles : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.loadError);
    }
  }, [t.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.title = `${t.profilesTitle} — MedScoutX`;
  }, [t.profilesTitle]);

  async function addProfile(e) {
    e.preventDefault();
    try {
      const res = await authFetch("/api/account/family-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          relationLabel: form.relationLabel,
          dateOfBirth: form.dateOfBirth || null,
          genderOrSalutation: form.genderOrSalutation || null,
          preferredPatientLanguage: form.preferredPatientLanguage || null,
          preferredDoctorLanguage: form.preferredDoctorLanguage || null,
        }),
      });
      if (!res.ok) throw new Error();
      setAdding(false);
      setForm({
        displayName: "",
        relationLabel: "",
        dateOfBirth: "",
        genderOrSalutation: "",
        preferredPatientLanguage: "",
        preferredDoctorLanguage: "",
      });
      void load();
    } catch {
      setError(t.saveError);
    }
  }

  async function archiveProfile(id) {
    if (!window.confirm(t.confirmArchiveProfile)) return;
    try {
      const res = await authFetch(`/api/account/family-profiles/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      });
      if (!res.ok) throw new Error();
      void load();
    } catch {
      setError(t.saveError);
    }
  }

  return (
    <div className="account-portal-page">
      <h1 className="account-portal-page__title">{t.profilesTitle}</h1>
      <p className="account-portal-page__lead">{t.profilesIntro}</p>
      <p className="account-portal-page__note">
        <strong>{t.ownProfile}</strong> — {t.ownProfileHintSeePersonal}
      </p>
      {error ? <p className="account-portal__error">{error}</p> : null}

      <button type="button" className="account-portal__btn account-portal__btn--primary" onClick={() => setAdding((a) => !a)}>
        {t.addFamily}
      </button>

      {adding ? (
        <form className="account-portal-form account-portal-form--inline" onSubmit={addProfile}>
          <label className="account-portal-form__field">
            {t.profilesFieldName}
            <input required className="account-portal-form__input" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
          </label>
          <label className="account-portal-form__field">
            {t.relationLabel}
            <input required className="account-portal-form__input" value={form.relationLabel} onChange={(e) => setForm((f) => ({ ...f, relationLabel: e.target.value }))} placeholder={t.profilesRelationPlaceholder} />
          </label>
          <label className="account-portal-form__field">
            {t.profilesFieldDob}
            <input type="date" className="account-portal-form__input" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} />
          </label>
          <button type="submit" className="account-portal__btn">
            {t.save}
          </button>
        </form>
      ) : null}

      <ul className="account-portal-doc-list">
        {profiles.map((p) => (
          <li key={p.id} className="account-portal-doc-list__item">
            <div>
              <span className="account-portal-doc-list__title">{p.displayName}</span>
              <span className="account-portal-doc-list__meta">
                {p.relationLabel}
                {p.dateOfBirth ? ` · ${String(p.dateOfBirth).slice(0, 10)}` : ""}
              </span>
            </div>
            <button type="button" className="account-portal__btn account-portal__btn--small" onClick={() => void archiveProfile(p.id)}>
              {t.archive}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
