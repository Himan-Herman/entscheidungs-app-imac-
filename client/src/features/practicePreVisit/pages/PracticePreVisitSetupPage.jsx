import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import ResponsiveTableCards from "../../../components/ResponsiveTableCards.jsx";
import { fetchPracticePreVisitSetup } from "../api/practicePreVisitApi.js";
import "../styles/PracticePreVisitSetupPage.css";

export default function PracticePreVisitSetupPage() {
  const [searchParams] = useSearchParams();
  const practiceId = searchParams.get("practiceId") || "";
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practicePreVisit || getMessages("en").practicePreVisit,
    [language],
  );

  const [setup, setSetup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const resolveTitle = useCallback(
    (j) =>
      (j && (j[language] || j.de || j.en || Object.values(j).find(Boolean))) || t.notProvided,
    [language, t.notProvided],
  );

  const load = useCallback(async () => {
    if (!practiceId) {
      setSetup(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticePreVisitSetup(practiceId);
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setSetup(data);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setSetup(null);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    void load();
  }, [load]);

  const chip = (on) => (
    <span className={`ppv-chip ppv-chip--${on ? "on" : "off"}`}>
      {on ? t.statusEnabled : t.statusDisabled}
    </span>
  );

  const templates = setup?.anamnesis?.templates || [];

  const tableNode = (
    <table className="ppv__table">
      <thead>
        <tr>
          <th scope="col">{t.colTemplate}</th>
          <th scope="col">{t.colStatus}</th>
          <th scope="col">{t.colSections}</th>
          <th scope="col">{t.colQuestions}</th>
          <th scope="col">{t.colLinks}</th>
        </tr>
      </thead>
      <tbody>
        {templates.map((tpl) => (
          <tr key={tpl.id}>
            <td>{resolveTitle(tpl.titleJson)}</td>
            <td>{tpl.status === "active" ? t.templateStatusActive : t.templateStatusArchived}</td>
            <td>{tpl.sectionCount}</td>
            <td>{tpl.questionCount}</td>
            <td>{tpl.linkCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const cardsNode = templates.map((tpl) => (
    <div className="ppv-card" key={tpl.id} role="listitem">
      <div className="ppv-card__row">
        <span className="ppv-card__label">{t.colTemplate}</span>
        <span>{resolveTitle(tpl.titleJson)}</span>
      </div>
      <div className="ppv-card__row">
        <span className="ppv-card__label">{t.colStatus}</span>
        <span>{tpl.status === "active" ? t.templateStatusActive : t.templateStatusArchived}</span>
      </div>
      <div className="ppv-card__row">
        <span className="ppv-card__label">{t.colSections}</span>
        <span>{tpl.sectionCount}</span>
      </div>
      <div className="ppv-card__row">
        <span className="ppv-card__label">{t.colQuestions}</span>
        <span>{tpl.questionCount}</span>
      </div>
      <div className="ppv-card__row">
        <span className="ppv-card__label">{t.colLinks}</span>
        <span>{tpl.linkCount}</span>
      </div>
    </div>
  ));

  return (
    <div className="ppv">
      <Link
        className="ppv__back"
        to={practiceId ? `/practice?practiceId=${encodeURIComponent(practiceId)}` : "/practice"}
      >
        {t.backLink}
      </Link>
      <h1 className="ppv__title">{t.heading}</h1>
      <p className="ppv__intro">{t.intro}</p>
      <p className="ppv__note" role="note">
        {t.safetyNote}
      </p>

      {loading ? (
        <p className="ppv__status" aria-live="polite">
          {t.loading}
        </p>
      ) : error ? (
        <p className="ppv__status ppv__status--error" role="alert">
          {error}
        </p>
      ) : !setup ? (
        <p className="ppv__status">{t.loadError}</p>
      ) : (
        <>
          <h2 className="ppv__section-title">{t.statusHeading}</h2>
          <dl className="ppv__grid">
            <div className="ppv__row">
              <span className="ppv__label">{t.statusAnamnesisModule}</span>
              {chip(setup.anamnesis?.moduleEnabled)}
            </div>
            <div className="ppv__row">
              <span className="ppv__label">{t.statusAnamnesisPractice}</span>
              {chip(setup.anamnesis?.practiceEnabled)}
            </div>
            <div className="ppv__row">
              <span className="ppv__label">{t.statusBookingModule}</span>
              {chip(setup.booking?.moduleEnabled)}
            </div>
            <div className="ppv__row">
              <span className="ppv__label">{t.statusBookingEnabled}</span>
              {chip(setup.booking?.bookingEnabled)}
            </div>
            <div className="ppv__row">
              <span className="ppv__label">{t.statusBookingMode}</span>
              <span className="ppv__mode">{setup.booking?.bookingMode || t.notProvided}</span>
            </div>
          </dl>

          <h2 className="ppv__section-title">{t.templatesHeading}</h2>
          <dl className="ppv__grid">
            <div className="ppv__row">
              <span className="ppv__label">{t.templatesCount}</span>
              <span>{setup.anamnesis?.templateCount ?? 0}</span>
            </div>
            <div className="ppv__row">
              <span className="ppv__label">{t.templatesActive}</span>
              <span>{setup.anamnesis?.activeTemplateCount ?? 0}</span>
            </div>
          </dl>
          {templates.length === 0 ? (
            <p className="ppv__status">{t.templatesEmpty}</p>
          ) : (
            <ResponsiveTableCards
              caption={t.templatesHeading}
              table={tableNode}
              cards={cardsNode}
            />
          )}

          <h2 className="ppv__section-title">{t.entryHeading}</h2>
          <div className="ppv__actions">
            {setup.entryPoints?.anamnesis ? (
              <Link
                className="ppv__btn"
                to={`/practice/anamnesis?practiceId=${encodeURIComponent(practiceId)}`}
              >
                {t.entryAnamnesis}
              </Link>
            ) : null}
            {setup.entryPoints?.booking ? (
              <Link
                className="ppv__btn"
                to={`/practice/booking?practiceId=${encodeURIComponent(practiceId)}`}
              >
                {t.entryBooking}
              </Link>
            ) : null}
          </div>
          <p className="ppv__hint">{t.entryHint}</p>
        </>
      )}
    </div>
  );
}
