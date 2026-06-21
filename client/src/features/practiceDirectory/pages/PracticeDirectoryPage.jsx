import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { searchMedScoutXPractices } from "../api/practiceDirectoryApi.js";
import "../../../styles/PracticeDirectoryPage.css";

// Curated set of common languages offered as filter chips. Display names come from i18n
// (t.languageNames); values are the codes stored in each practice's supportedLanguages.
const FILTER_LANGUAGES = ["de", "en", "tr", "ar", "ru", "uk", "pl", "fr", "es", "it"];

function langLabel(t, code) {
  return t.languageNames?.[code] || code.toUpperCase();
}

function PracticeCard({ practice, t, onRequest }) {
  const {
    practiceName,
    specialties,
    city,
    postalCode,
    address,
    phone,
    email,
    supportedLanguages,
    bookingAvailable,
  } = practice;

  return (
    <div className="pdir-card">
      <div className="pdir-card__header">
        <h3 className="pdir-card__name">{practiceName}</h3>
        {bookingAvailable && (
          <span className="pdir-card__badge">{t.badgeBooking}</span>
        )}
      </div>

      {specialties && specialties.length > 0 && (
        <p className="pdir-card__row">
          <span className="pdir-card__label">{t.labelSpecialtyCard}:</span>{" "}
          {specialties.join(", ")}
        </p>
      )}

      {(city || postalCode) && (
        <p className="pdir-card__row">
          <span className="pdir-card__label">{t.labelCity}:</span>{" "}
          {[postalCode, city].filter(Boolean).join(" ")}
        </p>
      )}

      {address && (
        <p className="pdir-card__row">
          <span className="pdir-card__label">{t.labelAddress}:</span>{" "}
          {address}
        </p>
      )}

      {phone && (
        <p className="pdir-card__row">
          <span className="pdir-card__label">{t.labelPhone}:</span>{" "}
          <a className="pdir-card__link" href={`tel:${phone}`}>
            {phone}
          </a>
        </p>
      )}

      {email && (
        <p className="pdir-card__row">
          <span className="pdir-card__label">{t.labelEmail}:</span>{" "}
          <a className="pdir-card__link" href={`mailto:${email}`}>
            {email}
          </a>
        </p>
      )}

      {supportedLanguages && supportedLanguages.length > 0 && (
        <div className="pdir-card__row pdir-card__row--langs">
          <span className="pdir-card__label">{t.labelLanguages}:</span>{" "}
          <span className="pdir-lang-badges">
            {supportedLanguages.map((code) => (
              <span className="pdir-lang-badge" key={code}>
                {langLabel(t, code)}
              </span>
            ))}
          </span>
        </div>
      )}

      {bookingAvailable && (
        <button
          type="button"
          className="pdir-card__request-btn"
          onClick={() => onRequest(practice)}
        >
          {t.requestAppointment}
        </button>
      )}
    </div>
  );
}

export default function PracticeDirectoryPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t =
    getMessages(language).practiceDirectory ||
    getMessages("en").practiceDirectory;

  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [bookingOnly, setBookingOnly] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState([]);

  const [practices, setPractices] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const toggleLanguage = useCallback((code) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }, []);

  const handleReset = useCallback(() => {
    setQ("");
    setSpecialty("");
    setCity("");
    setBookingOnly(false);
    setSelectedLanguages([]);
    setPractices([]);
    setTotal(null);
    setError("");
    setSearched(false);
  }, []);

  const handleSearch = useCallback(
    async (e) => {
      if (e) e.preventDefault();
      setLoading(true);
      setError("");
      try {
        const { res, data } = await searchMedScoutXPractices({
          q,
          specialty,
          city,
          bookingOnly,
          languages: selectedLanguages,
        });
        if (!res.ok) {
          setError(t.loadError);
          setPractices([]);
          setTotal(null);
        } else {
          setPractices(data.practices ?? []);
          setTotal(data.total ?? 0);
        }
      } catch {
        setError(t.loadError);
        setPractices([]);
        setTotal(null);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    },
    [q, specialty, city, bookingOnly, selectedLanguages, t],
  );

  function handleRequest(practice) {
    navigate(`/patient/appointments?practiceId=${practice.id}`);
  }

  return (
    <main className="pdir-page">
      <div className="pdir-page__inner">
        <Link to="/patient/practice" className="pdir-page__back">
          ← {t.backHub}
        </Link>

        <h1 className="pdir-page__heading">{t.heading}</h1>
        <p className="pdir-page__sub">{t.sub}</p>

        <form className="pdir-form" onSubmit={handleSearch} noValidate>
          <div className="pdir-form__row">
            <label className="pdir-form__label" htmlFor="pdir-q">
              {t.labelQ}
            </label>
            <input
              id="pdir-q"
              type="search"
              className="pdir-form__input"
              placeholder={t.placeholderQ}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="pdir-form__row">
            <label className="pdir-form__label" htmlFor="pdir-specialty">
              {t.labelSpecialty}
            </label>
            <input
              id="pdir-specialty"
              type="text"
              className="pdir-form__input"
              placeholder={t.placeholderSpecialty}
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            />
          </div>

          <div className="pdir-form__row">
            <label className="pdir-form__label" htmlFor="pdir-city">
              {t.labelCity}
            </label>
            <input
              id="pdir-city"
              type="text"
              className="pdir-form__input"
              placeholder={t.placeholderCity}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="pdir-form__row">
            <span className="pdir-form__label" id="pdir-lang-label">
              {t.labelLanguagesFilter}
            </span>
            {t.languagesFilterHint && (
              <span className="pdir-form__hint">{t.languagesFilterHint}</span>
            )}
            <div
              className="pdir-lang-chips"
              role="group"
              aria-labelledby="pdir-lang-label"
            >
              {FILTER_LANGUAGES.map((code) => {
                const selected = selectedLanguages.includes(code);
                return (
                  <button
                    type="button"
                    key={code}
                    className={`pdir-lang-chip${selected ? " pdir-lang-chip--selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => toggleLanguage(code)}
                  >
                    {langLabel(t, code)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pdir-form__row pdir-form__row--checkbox">
            <label className="pdir-form__checkbox-label">
              <input
                type="checkbox"
                className="pdir-form__checkbox"
                checked={bookingOnly}
                onChange={(e) => setBookingOnly(e.target.checked)}
              />
              {t.labelBookingOnly}
            </label>
          </div>

          <div className="pdir-form__actions">
            <button
              type="submit"
              className="pdir-form__submit"
              disabled={loading}
            >
              {loading ? t.searching : t.searchButton}
            </button>
            <button
              type="button"
              className="pdir-form__reset"
              onClick={handleReset}
              disabled={loading}
            >
              {t.resetFilters}
            </button>
          </div>
        </form>

        <p className="pdir-page__profile-note" role="note">
          {t.profileNote}
        </p>

        <section className="pdir-results" aria-live="polite">
          {error && <p className="pdir-results__error">{error}</p>}

          {!error && !searched && !loading && (
            <p className="pdir-results__empty">{t.empty}</p>
          )}

          {!error && searched && !loading && practices.length === 0 && (
            <p className="pdir-results__empty">{t.noResults}</p>
          )}

          {!error && practices.length > 0 && (
            <>
              <h2 className="pdir-results__heading">
                {t.resultsHeading}
                <span className="pdir-results__count"> ({total})</span>
              </h2>
              <ul className="pdir-results__list">
                {practices.map((p) => (
                  <li key={p.id}>
                    <PracticeCard practice={p} t={t} onRequest={handleRequest} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
