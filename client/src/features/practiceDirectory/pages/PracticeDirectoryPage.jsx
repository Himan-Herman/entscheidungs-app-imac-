import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { searchMedScoutXPractices } from "../api/practiceDirectoryApi.js";
import "../../../styles/PracticeDirectoryPage.css";

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
        <p className="pdir-card__row">
          <span className="pdir-card__label">{t.labelLanguages}:</span>{" "}
          {supportedLanguages.join(", ")}
        </p>
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

  const [practices, setPractices] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

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
    [q, specialty, city, bookingOnly, t],
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

          <button
            type="submit"
            className="pdir-form__submit"
            disabled={loading}
          >
            {loading ? t.searching : t.searchButton}
          </button>
        </form>

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
