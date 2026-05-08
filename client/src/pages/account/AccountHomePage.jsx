import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { getMessages } from "../../i18n/translations/index.js";
import { authFetch } from "../../api/authFetch.js";

export default function AccountHomePage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.accountPortal ?? getMessages("en").accountPortal;
  }, [language]);

  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await authFetch("/api/account/overview");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error("load_failed");
      setData(j);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.loadError);
      setData(null);
    }
  }, [t.loadError]);

  useEffect(() => {
    document.title = `${t.title} — MedScoutX`;
  }, [t.title]);

  useEffect(() => {
    void load();
  }, [load]);

  const prep = data?.recentSessions ?? [];
  const cases = data?.cases ?? [];
  const docs = data?.documentPreviews ?? [];
  const doctors = data?.doctorContacts ?? [];
  const follow = data?.openFollowUps ?? [];

  return (
    <div className="account-portal-page">
      <header className="account-portal-page__hero">
        <h1 className="account-portal-page__title">{t.title}</h1>
        <p className="account-portal-page__subtitle">{t.subtitle}</p>
      </header>

      <section className="account-portal-page__quick" aria-label="Quick actions">
        <Link className="account-portal__btn account-portal__btn--primary" to="/pre-visit">
          {t.quickNewPrep}
        </Link>
        <Link className="account-portal__btn" to="/pre-visit/cases">
          {t.quickTimelines}
        </Link>
        <Link className="account-portal__btn" to="/pre-visit/my-preparations">
          {t.quickPdf}
        </Link>
        <Link className="account-portal__btn" to="/settings/doctor-contacts">
          {t.quickDoctor}
        </Link>
        <Link className="account-portal__btn" to="/account/data">
          {t.quickExport}
        </Link>
      </section>

      {error ? <p className="account-portal__error">{error}</p> : null}

      <div className="account-portal-page__grid">
        <section className="account-portal-card">
          <h2 className="account-portal-card__title">{t.sectionPreparations}</h2>
          {prep.length === 0 ? (
            <p className="account-portal-card__empty">{t.prepNone}</p>
          ) : (
            <ul className="account-portal-card__list">
              {prep.map((s) => (
                <li key={s.id}>
                  <Link to={`/pre-visit/my-preparations`} state={{ focusSessionId: s.id }}>
                    {s.title || "Pre-Visit"} ·{" "}
                    {new Date(s.updatedAt).toLocaleDateString(language === "de" ? "de-DE" : "en-GB")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link className="account-portal-card__more" to="/pre-visit/my-preparations">
            {t.viewAll}
          </Link>
        </section>

        <section className="account-portal-card">
          <h2 className="account-portal-card__title">{t.sectionTimelines}</h2>
          <p className="account-portal-card__meta">
            {t.activeCases}: {data?.activeCasesCount ?? 0}
          </p>
          {cases.length === 0 ? (
            <p className="account-portal-card__empty">{t.caseNone}</p>
          ) : (
            <ul className="account-portal-card__list">
              {cases.map((c) => (
                <li key={c.id}>
                  <Link to={`/pre-visit/cases/${c.id}`}>{c.title}</Link>
                </li>
              ))}
            </ul>
          )}
          <Link className="account-portal-card__more" to="/pre-visit/cases">
            {t.viewAll}
          </Link>
        </section>

        <section className="account-portal-card">
          <h2 className="account-portal-card__title">{t.sectionDocuments}</h2>
          {docs.length === 0 ? (
            <p className="account-portal-card__empty">{t.docNone}</p>
          ) : (
            <ul className="account-portal-card__list">
              {docs.slice(0, 4).map((d) => (
                <li key={d.id}>
                  {d.title || "—"} · {d.pdfDownloaded ? t.statusCreated : t.statusDraft}
                </li>
              ))}
            </ul>
          )}
          <Link className="account-portal-card__more" to="/account/documents">
            {t.viewAll}
          </Link>
        </section>

        <section className="account-portal-card">
          <h2 className="account-portal-card__title">{t.sectionDoctors}</h2>
          {doctors.length === 0 ? (
            <p className="account-portal-card__empty">{t.doctorNone}</p>
          ) : (
            <ul className="account-portal-card__list">
              {doctors.slice(0, 4).map((d) => (
                <li key={d.id}>
                  {d.doctorName}
                  {d.isFavorite ? ` · ${t.favorite}` : ""}
                </li>
              ))}
            </ul>
          )}
          <Link className="account-portal-card__more" to="/account/doctors">
            {t.viewAll}
          </Link>
        </section>

        <section className="account-portal-card account-portal-card--wide">
          <h2 className="account-portal-card__title">{t.pendingFollowUps}</h2>
          {follow.length === 0 ? (
            <p className="account-portal-card__empty">{t.followUpNone}</p>
          ) : (
            <ul className="account-portal-card__list">
              {follow.map((f) => (
                <li key={f.id}>
                  <Link to={`/pre-visit/follow-ups/${f.id}`}>
                    {f.title || f.sessionTitle || "Follow-up"} · {f.status}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link className="account-portal-card__more" to="/pre-visit/follow-ups">
            {t.viewAll}
          </Link>
        </section>
      </div>

      <p className="account-portal-page__footer-note">
        <Link to="/startseite">{t.backHome}</Link>
      </p>
    </div>
  );
}
