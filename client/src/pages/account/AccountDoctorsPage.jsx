import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { getMessages } from "../../i18n/translations/index.js";
import { authFetch } from "../../api/authFetch.js";
import { formatUiDate } from "../../i18n/intlLocale.js";

export default function AccountDoctorsPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.accountPortal ?? getMessages("en").accountPortal;
  }, [language]);

  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await authFetch("/api/user/doctor-contacts");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error("fail");
      setContacts(Array.isArray(j.contacts) ? j.contacts : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.loadError);
      setContacts([]);
    }
  }, [t.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.title = `${t.doctorsTitle} — MedScoutX`;
  }, [t.doctorsTitle]);

  async function toggleFavorite(c) {
    try {
      const res = await authFetch(`/api/user/doctor-contacts/${encodeURIComponent(c.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !c.isFavorite }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      if (j.contact) {
        setContacts((prev) => prev.map((x) => (x.id === c.id ? j.contact : x)));
      }
    } catch {
      /* ignore */
    }
  }

  async function touch(id) {
    try {
      await authFetch(`/api/user/doctor-contacts/${encodeURIComponent(id)}/touch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      void load();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="account-portal-page">
      <h1 className="account-portal-page__title">{t.doctorsTitle}</h1>
      <p className="account-portal-page__lead">{t.doctorsIntro}</p>
      <p>
        <Link className="account-portal__btn account-portal__btn--primary" to="/settings/doctor-contacts">
          {t.manageInSettings}
        </Link>
      </p>
      {error ? <p className="account-portal__error">{error}</p> : null}

      {contacts.length === 0 ? (
        <p className="account-portal-card__empty">{t.doctorNone}</p>
      ) : (
        <ul className="account-portal-doc-list">
          {contacts.map((c) => (
            <li key={c.id} className="account-portal-doc-list__item">
              <div>
                <span className="account-portal-doc-list__title">{c.doctorName}</span>
                <span className="account-portal-doc-list__meta">
                  {c.practiceName || c.email}
                  {c.lastUsedAt
                    ? ` · ${t.lastUsed}: ${formatUiDate(c.lastUsedAt, language)}`
                    : ""}
                </span>
              </div>
              <div className="account-portal-doc-list__actions">
                <button type="button" className="account-portal__btn account-portal__btn--small" onClick={() => void toggleFavorite(c)}>
                  {c.isFavorite ? `★ ${t.favorite}` : `☆ ${t.favorite}`}
                </button>
                <button type="button" className="account-portal__btn account-portal__btn--small" onClick={() => void touch(c.id)}>
                  {t.touchUse}
                </button>
                <Link className="account-portal__btn account-portal__btn--small" to={`/pre-visit`}>
                  Pre-Visit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
