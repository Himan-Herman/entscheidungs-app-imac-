import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations/index.js";
import { authFetch } from "../api/authFetch.js";
import PreVisitModuleChrome from "../features/preVisit/components/PreVisitModuleChrome.jsx";
import "../styles/SettingsDoctorContactsPage.css";

const EMPTY_FORM = {
  doctorName: "",
  practiceName: "",
  specialty: "",
  email: "",
  phone: "",
  address: "",
  note: "",
};

function telHref(phone) {
  const raw = String(phone ?? "").trim();
  if (!raw) return "";
  const normalized = raw.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : "";
}

function mapsHref(address) {
  const q = String(address ?? "").trim();
  if (!q) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export default function SettingsDoctorContactsPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const bundle = getMessages(language);
    return (
      bundle.settingsDoctorContacts ??
      getMessages("en").settingsDoctorContacts
    );
  }, [language]);

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM }));
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await authFetch("/api/user/doctor-contacts");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "load_failed");
      }
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setLoadError(t.loadError);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setSaveError("");
    setShowForm(true);
  }

  function openEdit(c) {
    setEditingId(c.id);
    setForm({
      doctorName: c.doctorName ?? "",
      practiceName: c.practiceName ?? "",
      specialty: c.specialty ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      address: c.address ?? "",
      note: c.note ?? "",
    });
    setSaveError("");
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        doctorName: form.doctorName.trim(),
        practiceName: form.practiceName.trim() || null,
        specialty: form.specialty.trim() || null,
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        note: form.note.trim() || null,
      };
      const url = editingId
        ? `/api/user/doctor-contacts/${encodeURIComponent(editingId)}`
        : "/api/user/doctor-contacts";
      const res = await authFetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = data?.error || data?.message || "save_failed";
        throw new Error(code);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      if (e?.message === "email_invalid") setSaveError(t.saveErrorEmail);
      else if (e?.message === "doctorName_invalid") setSaveError(t.saveErrorName);
      else setSaveError(t.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t.deleteConfirm)) return;
    try {
      const res = await authFetch(
        `/api/user/doctor-contacts/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("delete_failed");
      await load();
      if (editingId === id) {
        setShowForm(false);
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
      }
    } catch {
      alert(t.deleteError);
    }
  }

  return (
    <div className="settings-doctors">
      <div className="settings-doctors__inner">
        <PreVisitModuleChrome />
        <header className="settings-doctors__header">
          <h1 className="settings-doctors__title">{t.heading}</h1>
          <p className="settings-doctors__intro">{t.intro}</p>
          <Link className="settings-doctors__back" to="/patient">
            {t.backPatientHub}
          </Link>
        </header>

        {loadError ? (
          <div className="settings-doctors__error-wrap" role="alert">
            <p className="settings-doctors__error">{loadError}</p>
            <button
              type="button"
              className="settings-doctors__btn settings-doctors__btn--ghost"
              onClick={() => void load()}
            >
              {t.retryLoad}
            </button>
          </div>
        ) : null}

        <div className="settings-doctors__toolbar">
          <button
            type="button"
            className="settings-doctors__btn settings-doctors__btn--primary"
            onClick={openAdd}
          >
            {t.addContact}
          </button>
        </div>

        {showForm ? (
          <form
            className="settings-doctors__form"
            onSubmit={handleSubmit}
            aria-labelledby="settings-doctors-form-title"
          >
            <h2 id="settings-doctors-form-title" className="sr-only">
              {editingId ? t.edit : t.addContact}
            </h2>
            <p className="settings-doctors__hint">{t.requiredHint}</p>

            <label className="settings-doctors__label">
              {t.fieldDoctorName} *
              <input
                className="settings-doctors__input"
                value={form.doctorName}
                onChange={(e) => updateField("doctorName", e.target.value)}
                required
                maxLength={120}
                autoComplete="name"
              />
            </label>

            <label className="settings-doctors__label">
              {t.fieldPracticeName}
              <input
                className="settings-doctors__input"
                value={form.practiceName}
                onChange={(e) => updateField("practiceName", e.target.value)}
                maxLength={200}
              />
            </label>

            <label className="settings-doctors__label">
              {t.fieldSpecialty}
              <input
                className="settings-doctors__input"
                value={form.specialty}
                onChange={(e) => updateField("specialty", e.target.value)}
                maxLength={120}
              />
            </label>

            <label className="settings-doctors__label">
              {t.fieldEmail} *
              <input
                className="settings-doctors__input"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
                maxLength={254}
                autoComplete="email"
              />
            </label>

            <label className="settings-doctors__label">
              {t.fieldPhone}
              <input
                className="settings-doctors__input"
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                maxLength={40}
                autoComplete="tel"
              />
            </label>

            <label className="settings-doctors__label">
              {t.fieldAddress}
              <textarea
                className="settings-doctors__textarea"
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                rows={2}
                maxLength={500}
              />
            </label>

            <label className="settings-doctors__label">
              {t.fieldNote}
              <textarea
                className="settings-doctors__textarea"
                value={form.note}
                onChange={(e) => updateField("note", e.target.value)}
                rows={2}
                maxLength={1000}
              />
            </label>

            {saveError ? (
              <p className="settings-doctors__error" role="alert">
                {saveError}
              </p>
            ) : null}

            <div className="settings-doctors__form-actions">
              <button
                type="button"
                className="settings-doctors__btn settings-doctors__btn--ghost"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setForm({ ...EMPTY_FORM });
                  setSaveError("");
                }}
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="settings-doctors__btn settings-doctors__btn--primary"
                disabled={saving}
              >
                {t.save}
              </button>
            </div>
          </form>
        ) : null}

        <section
          className="settings-doctors__list-wrap"
          aria-label={t.heading}
        >
          {loading ? (
            <p className="settings-doctors__muted">{t.loadingContacts}</p>
          ) : contacts.length === 0 ? (
            <p className="settings-doctors__empty">{t.empty}</p>
          ) : (
            <ul className="settings-doctors__list">
              {contacts.map((c) => {
                const cardLabel = `${t.cardAria}: ${c.doctorName}`;
                const phoneLink = telHref(c.phone);
                const addressLink = mapsHref(c.address);
                return (
                <li key={c.id} className="settings-doctors__card">
                  <article aria-label={cardLabel}>
                    <h3 className="settings-doctors__card-title">
                      {c.doctorName}
                    </h3>
                    {c.practiceName ? (
                      <p className="settings-doctors__card-line">{c.practiceName}</p>
                    ) : null}
                    {c.specialty ? (
                      <p className="settings-doctors__card-line settings-doctors__card-line--muted">
                        {c.specialty}
                      </p>
                    ) : null}
                    {c.email ? (
                      <p className="settings-doctors__card-line">
                        <a
                          className="settings-doctors__link"
                          href={`mailto:${encodeURIComponent(c.email)}`}
                          aria-label={`${t.linkEmail}: ${c.doctorName}`}
                        >
                          {c.email}
                        </a>
                      </p>
                    ) : null}
                    {c.phone && phoneLink ? (
                      <p className="settings-doctors__card-line">
                        <a
                          className="settings-doctors__link"
                          href={phoneLink}
                          aria-label={`${t.linkPhone}: ${c.doctorName}`}
                        >
                          {c.phone}
                        </a>
                      </p>
                    ) : null}
                    {c.address && addressLink ? (
                      <p className="settings-doctors__card-line">
                        <a
                          className="settings-doctors__link"
                          href={addressLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${t.linkAddress}: ${c.doctorName}`}
                        >
                          {c.address}
                        </a>
                      </p>
                    ) : null}
                    {c.note ? (
                      <p className="settings-doctors__card-note">{c.note}</p>
                    ) : null}
                    <div className="settings-doctors__card-actions">
                      <button
                        type="button"
                        className="settings-doctors__btn settings-doctors__btn--ghost"
                        onClick={() => openEdit(c)}
                        aria-label={`${t.edit}: ${c.doctorName}`}
                      >
                        {t.edit}
                      </button>
                      <button
                        type="button"
                        className="settings-doctors__btn settings-doctors__btn--danger"
                        onClick={() => void handleDelete(c.id)}
                        aria-label={`${t.delete}: ${c.doctorName}`}
                      >
                        {t.delete}
                      </button>
                    </div>
                  </article>
                </li>
              );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
